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

        console.log(`[AI Proxy] Forwarding request: POST ${url.replace(API_KEY, 'HIDDEN_KEY')}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        let responseData;
        const responseText = await response.text();

        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error('[AI Proxy] Upstream returned non-JSON response:', response.status, responseText);
            return res.status(response.status).json({
                error: 'Upstream API Error',
                details: responseText || 'No response body',
                status: response.status
            });
        }

        if (!response.ok) {
            console.error('[AI Proxy] Upstream Error:', response.status, JSON.stringify(responseData));
            return res.status(response.status).json(responseData);
        }

        // 2. Calculate & Deduct Cost
        let cost = 0;
        let finalCredits = null;

        const config = await PricingService.getConfig();
        const assumptions = config.assumptions || {};
        const exchangeRate = assumptions.exchangeRate || 15;
        const markup = assumptions.imageMarkup || 1.15;

        // Special handling for high-cost operations like Image Generation (Imagen)
        const isImageGen = model.toLowerCase().includes('imagen');

        if (isImageGen) {
            const isFast = model.toLowerCase().includes('fast');
            const marketCost = isFast ? (assumptions.fastImageCostMarket || 0.01) : (assumptions.imageCostMarket || 0.03);

            // Cost in Credits = (Market $ * Markup) * ExchangeRate (Millions)
            // Example: (0.03 * 1.15) * 6 * 1,000,000 = 207,000 credits
            cost = Math.ceil((marketCost * markup) * exchangeRate * 1000000);
        } else if (responseData.usageMetadata) {
            const { totalTokenCount = 0 } = responseData.usageMetadata;
            cost = Math.ceil(totalTokenCount * exchangeRate);
        }

        if (cost > 0) {
            try {
                const result = await CreditService.deductCredits(req.user.id, cost, `AI: ${method} (${model})`, {
                    model: model,
                    api_version: apiVersion
                });
                finalCredits = result;
            } catch (err) {
                console.error('[AI Proxy] Failed to deduct credits:', err);
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
