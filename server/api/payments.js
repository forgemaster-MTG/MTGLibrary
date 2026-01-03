import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize Stripe lazily or with a check to prevent server crash if key is missing
let stripe;
try {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
} catch (err) {
    console.error('Failed to initialize Stripe:', err.message);
}

// Create a Payment Intent
router.post('/create-intent', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe is not configured on the server.' });
    }
    const { amount, currency = 'usd' } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // amount is in dollars, convert to cents
            currency,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                user_id: req.user?.id || 'guest',
                email: req.user?.email || 'guest@example.com'
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('Stripe Error:', error);
        res.status(400).json({ error: error.message });
    }
});

export default router;
