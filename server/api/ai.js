import express from 'express';

const router = express.Router();

// Use server-side env var for the key
const API_KEY = process.env.GEMINI_API_KEY;

router.post('/generate', async (req, res) => {
    if (!API_KEY) {
        console.error('GEMINI_API_KEY is missing on server.');
        return res.status(500).json({ error: 'Server misconfiguration: AI service unavailable.' });
    }

    try {
        const { model, method = 'generateContent', data, apiVersion = 'v1beta' } = req.body;

        if (!model) {
            return res.status(400).json({ error: 'Model name is required' });
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

        res.json(responseData);

    } catch (error) {
        console.error('[AI Proxy] Internal Error:', error);
        res.status(500).json({ error: 'Internal Proxy Error', details: error.message });
    }
});

export default router;
