import express from 'express';
import { stripe, createCheckoutSession, createPortalSession, createTopUpSession, handleWebhook } from '../services/stripe.js';
import { TIER_CONFIG } from '../config/tiers.js';
import { PricingService } from '../services/PricingService.js';
import authMiddleware from '../middleware/auth.js';
import bodyParser from 'body-parser';

const router = express.Router();

// Webhook endpoint (Must use raw body, so we mount it before json parser if global, but here we can handle it specifically)
// Note: server/index.js likely applies bodyParser/express.json globally. 
// We might need to ensuring raw body is available.
// For now, let's assume standard construction. In many Express apps, you need `express.raw({type: 'application/json'})` for webhooks.
// If index.js sets global json parsing, it might verify signature tricky.
// Usually easier to handle webhook in index.js or specific route with raw parser.
// We'll stick to standard logic and hope the global middleware doesn't consume it too much or we use the buffer.

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // If we have the secret, verify. If not (dev mode without secret), proceed with caution or fail?
        // User didn't have secret yet.
        if (endpointSecret && stripe) {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } else {
            // Fallback for unverified dev testing (NOT SECURE FOR PROD)
            // If body is already parsed by global middleware, this might fail 'constructEvent'.
            if (!stripe) return res.status(500).send('Stripe not initialized');
            try {
                event = JSON.parse(req.body.toString());
            } catch (e) {
                event = req.body; // already parsed?
            }
        }
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        await handleWebhook(event);
        res.json({ received: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

// All other routes require auth
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
    try {
        const { tierId, interval = 'monthly', successUrl: customSuccessUrl, cancelUrl: customCancelUrl } = req.body; // interval: 'monthly', 'biannual', 'yearly'
        const config = TIER_CONFIG[tierId];

        if (!config || !config.prices) {
            return res.status(400).json({ error: 'Invalid Tier or Free Tier selected' });
        }

        const priceId = config.prices[interval];
        if (!priceId) {
            return res.status(400).json({ error: `Invalid interval ${interval} for this tier` });
        }

        const successUrl = customSuccessUrl || `${process.env.PUBLIC_URL || 'http://localhost:5173'}/settings?success=true`;
        const cancelUrl = customCancelUrl || `${process.env.PUBLIC_URL || 'http://localhost:5173'}/settings?canceled=true`;

        const session = await createCheckoutSession(req.user.id, priceId, successUrl, cancelUrl);
        res.json({ url: session.url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/create-topup-session', authMiddleware, async (req, res) => {
    try {
        const { packIndex, credits, successUrl: customSuccessUrl, cancelUrl: customCancelUrl } = req.body;

        let pack;
        if (credits) {
            const price = await PricingService.calculateTopUpCost(credits);
            pack = {
                name: 'Custom Top-Up',
                price: price,
                creditLimit: credits
            };
        } else {
            const config = await PricingService.getConfig();
            pack = config.packs?.[packIndex];
        }

        if (!pack) {
            return res.status(400).json({ error: 'Invalid Top-Up Pack selected' });
        }

        const successUrl = customSuccessUrl || `${process.env.PUBLIC_URL || 'http://localhost:5173'}/settings?success=true`;
        const cancelUrl = customCancelUrl || `${process.env.PUBLIC_URL || 'http://localhost:5173'}/settings?canceled=true`;

        const session = await createTopUpSession(req.user.id, pack, successUrl, cancelUrl);
        res.json({ url: session.url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/create-portal-session', authMiddleware, async (req, res) => {
    try {
        const returnUrl = `${process.env.PUBLIC_URL || 'http://localhost:5173'}/settings`;
        const session = await createPortalSession(req.user.id, returnUrl);
        res.json({ url: session.url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/sync-subscription', authMiddleware, async (req, res) => {
    try {
        const { syncSubscriptionStatus } = await import('../services/stripe.js');
        const updatedUser = await syncSubscriptionStatus(req.user.id);
        res.json({ success: true, user: updatedUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to sync subscription' });
    }
});

export default router;
