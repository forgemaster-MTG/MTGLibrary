import express from 'express';
import axios from 'axios';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Public proxy? Or authenticated? Authenticated is safer to prevent abuse.
router.use(authMiddleware);

// POST /api/import/url
// Body: { url: string }
router.post('/url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // Identify Source
        let deckData = null;

        if (url.includes('moxfield.com')) {
            deckData = await fetchMoxfield(url);
        } else if (url.includes('archidekt.com')) {
            deckData = await fetchArchidekt(url);
        } else {
            return res.status(400).json({ error: 'Unsupported website. Currently supporting Moxfield and Archidekt.' });
        }

        res.json(deckData);

    } catch (err) {
        console.error('[import] url error', err.message);
        res.status(500).json({ error: 'Failed to fetch deck from URL' });
    }
});

// --- Fetchers ---

async function fetchMoxfield(url) {
    // URL format: https://www.moxfield.com/decks/VZk4...
    const match = url.match(/decks\/([^/?]+)/);
    if (!match) throw new Error('Invalid Moxfield URL');
    const id = match[1];

    const response = await axios.get(`https://api.moxfield.com/v2/decks/all/${id}`);
    const data = response.data;

    const mainboard = [];
    const sideboard = [];

    // Parse Mainboard
    Object.keys(data.mainboard).forEach(cardName => {
        const item = data.mainboard[cardName];
        mainboard.push({
            quantity: item.quantity,
            name: item.card.name,
            set: item.card.set,
            collectorNumber: item.card.cn,
            isFoil: item.finish === 'foil'
        });
    });

    // Parse Sideboard
    Object.keys(data.sideboard).forEach(cardName => {
        const item = data.sideboard[cardName];
        sideboard.push({
            quantity: item.quantity,
            name: item.card.name,
            set: item.card.set,
            collectorNumber: item.card.cn,
            isFoil: item.finish === 'foil'
        });
    });

    // Parse Commanders (Moxfield puts them in separate object usually, but also mainboard sometimes?)
    // Moxfield V2 'commanders' object contains card names as keys.
    if (data.commanders) {
        Object.keys(data.commanders).forEach(cardName => {
            const item = data.commanders[cardName];
            sideboard.push({
                quantity: item.quantity,
                name: item.card.name,
                set: item.card.set,
                collectorNumber: item.card.cn,
                isFoil: item.finish === 'foil',
                isCommander: true
            });
        });
    }

    return {
        name: data.name,
        mainboard,
        sideboard
    };
}

async function fetchArchidekt(url) {
    // URL format: https://archidekt.com/decks/123456...
    const match = url.match(/decks\/(\d+)/);
    if (!match) throw new Error('Invalid Archidekt URL');
    const id = match[1];

    const response = await axios.get(`https://archidekt.com/api/decks/${id}/`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    // Archidekt API structure usually: { id: ..., cards: [ ... ] }
    // Sometimes response.data IS the deck object, sometimes response.data.results?
    // Let's assume response.data based on typical endpoint behavior.
    const data = response.data;

    const mainboard = [];
    const sideboard = [];

    if (!data.cards) {
        throw new Error('Archidekt deck is private or invalid format.');
    }

    data.cards.forEach(card => {
        const entry = {
            quantity: card.quantity,
            name: card.card.oracleCard.name,
            set: card.card.edition.editionCode,
            collectorNumber: card.card.collectorNumber,
            isFoil: card.modifier === 'Foil'
        };

        // Categories check
        // Archidekt cards have 'categories': ["Commander"], ["Sideboard"], etc.
        const categories = card.categories || [];

        if (categories.includes('Commander')) {
            sideboard.push({ ...entry, isCommander: true });
        } else if (categories.includes('Sideboard')) {
            sideboard.push(entry);
        } else if (categories.includes('Maybeboard')) {
            // Skip maybeboard
        } else {
            // Default to mainboard
            mainboard.push(entry);
        }
    });

    return {
        name: data.name,
        mainboard,
        sideboard
    };
}

export default router;
