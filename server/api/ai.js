import express from 'express';
import auth from '../middleware/auth.js';
import { CreditService } from '../services/CreditService.js';
import { PricingService } from '../services/PricingService.js';

const router = express.Router();

// Use server-side env var for the key, fallback to VITE_ prefixed one if needed
const API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// Protect all AI routes
router.use(auth);

router.post('/generate', async (req, res) => {
    if (API_KEY) {
        console.log(`[AI Proxy] API_KEY loaded. Ends with: ...${API_KEY.slice(-5)} (Total Length: ${API_KEY.length})`);
    } else {
        console.error('[AI Proxy] API_KEY is undefined/empty');
    }

    if (!API_KEY) {
        console.error('GEMINI_API_KEY is missing on server.');
        return res.status(500).json({ error: 'Server misconfiguration: AI service unavailable.' });
    }

    try {
        const { model, method = 'generateContent', data, apiVersion = 'v1beta' } = req.body;

        if (!model) {
            return res.status(400).json({ error: 'Model name is required' });
        }

        // 1. Check Credits (Pre-flight)
        // Estimate minimum cost to prevent abuse. 
        // 100 tokens * 15 rate = 1500 credits. 
        // Let's be lenient and say 100 credits minimum to try.
        const MIN_CREDITS = 100;
        const hasCredits = await CreditService.hasSufficientCredits(req.user.id, MIN_CREDITS);

        if (!hasCredits) {
            return res.status(403).json({
                error: 'Insufficient AI Credits',
                code: 'INSUFFICIENT_CREDITS',
                message: 'You have run out of AI credits. Please upgrade or top-up to continue.'
            });
        }

        // Construct upstream URL
        // Allow apiVersion override but default to v1beta
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:${method}?key=${API_KEY}`;

        // console.log(`[AI Proxy] Forwarding request to ${model}:${method}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('[AI Proxy] Upstream Error:', response.status, JSON.stringify(responseData));
            return res.status(response.status).json(responseData);
        }

        // 2. Calculate & Deduct Cost
        let cost = 0;
        let finalCredits = null;

        if (responseData.usageMetadata) {
            const { totalTokenCount = 0 } = responseData.usageMetadata;

            // Get rate
            const config = await PricingService.getConfig();
            const exchangeRate = config.assumptions?.exchangeRate || 15; // Default 15 credits per token

            cost = Math.ceil(totalTokenCount * exchangeRate);

            if (cost > 0) {
                try {
                    const result = await CreditService.deductCredits(req.user.id, cost, `AI: ${method}`, {
                        model: model,
                        token_count: totalTokenCount,
                        api_version: apiVersion
                    });
                    finalCredits = result;
                } catch (err) {
                    console.error('[AI Proxy] Failed to deduct credits:', err);
                }
            }
        }

        // Attach credit info to response for frontend to update UI
        if (finalCredits) {
            responseData.credits_used = cost;
            responseData.credits_monthly = finalCredits.credits_monthly;
            responseData.credits_topup = finalCredits.credits_topup;
        }

        res.json(responseData);

    } catch (error) {
        console.error('[AI Proxy] Internal Error:', error);
        res.status(500).json({ error: 'Internal Proxy Error', details: error.message });
    }
});

export default router;
