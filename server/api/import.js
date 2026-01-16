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

    // Moxfield returns object: { "Card Name": { quantity: 1, card: {...} } }
    Object.values(data.mainboard).forEach(entry => {
        mainboard.push({
            quantity: entry.quantity,
            name: entry.card.name,
            set: entry.card.set,
            collectorNumber: entry.card.cn,
            isFoil: entry.finish === 'foil' // Moxfield layout might differ slightly
        });
    });

    Object.values(data.sideboard).forEach(entry => {
        sideboard.push({
            quantity: entry.quantity,
            name: entry.card.name,
            set: entry.card.set,
            collectorNumber: entry.card.cn
        });
    });

    // Commanders? Moxfield puts them in 'commanders' object too
    if (data.commanders) {
        Object.values(data.commanders).forEach(entry => {
            // Logic: Check if it's already in mainboard? Usually yes but marked as commander?
            // Or separate? Moxfield removes them from mainboard usually in export view?
            // Actually API usually has them separate.
            // We'll push to sideboard/commander section for our parser
            sideboard.push({
                quantity: entry.quantity,
                name: entry.card.name,
                set: entry.card.set,
                collectorNumber: entry.card.cn,
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

    const response = await axios.get(`https://archidekt.com/api/decks/${id}/`);
    const data = response.data;

    const mainboard = [];
    const sideboard = [];

    data.cards.forEach(card => {
        const entry = {
            quantity: card.quantity,
            name: card.card.oracleCard.name,
            set: card.card.edition.editionCode,
            collectorNumber: card.card.collectorNumber,
            isFoil: card.modifier === 'Foil' // Archidekt modifier
        };

        // Category? "Commander", "Sideboard", "Mainboard"
        // Archidekt uses 'categories': ["Commander"], ["Sideboard"], etc.
        // But categories are user defined? 
        // Standard categories: 'Commander', 'Sideboard', 'Maybeboard'

        if (card.categories.includes('Commander')) {
            sideboard.push({ ...entry, isCommander: true });
        } else if (card.categories.includes('Sideboard')) {
            sideboard.push(entry);
        } else if (card.categories.includes('Maybeboard')) {
            // Skip maybeboard?
        } else {
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
