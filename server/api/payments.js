import express from 'express';
import { stripe, createCheckoutSession, createPortalSession, createTopUpSession, handleWebhook } from '../services/stripe.js';
import { TIER_CONFIG } from '../config/tiers.js';
import { PricingService } from '../services/PricingService.js';
import authMiddleware from '../middleware/auth.js';
import bodyParser from 'body-parser';

const router = express.Router();

// Webhook handled in index.js for raw body parsing and public access

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
        const { packIndex, credits, priceId, successUrl: customSuccessUrl, cancelUrl: customCancelUrl } = req.body;

        let pack;
        if (priceId) {
            pack = {
                priceId,
                creditLimit: credits,
                name: 'Top-Up'
            };
        } else if (credits) {
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
