import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const knexConfig = require('../../knexfile.cjs');
const knex = require('knex')(knexConfig['development']);

const router = express.Router();

// Get all sets
router.get('/', async (req, res) => {
    try {
        console.log('[API] Fetching sets from DB...');
        const sets = await knex('sets').orderBy('releasedate', 'desc');

        if (sets && sets.length > 0) {
            console.log(`[API] Found ${sets.length} sets in DB.`);

            // Map DB columns (MTGJSON style) to Scryfall style for frontend
            const mappedSets = sets.map(s => ({
                id: s.uuid || s.code, // UUID might not exist in this older schema?
                code: s.code,
                name: s.name,
                released_at: s.releasedate,
                set_type: s.type,
                card_count: s.totalsetsize,
                icon_svg_uri: `https://svgs.scryfall.io/sets/${s.code.toLowerCase()}.svg`, // Inferred
                digital: s.isonlineonly
            }));

            return res.json({ data: mappedSets });
        }

        // Fallback or empty? User wants Postgres first.
        // If empty, return empty and let client handle (or we could fetch from Scryfall here).
        // Since user implies they have data (or we found 836 rows), we return what we have.
        res.json({ data: [] });

    } catch (err) {
        console.error('[API] Error fetching sets:', err);
        res.status(500).json({ error: 'Failed to fetch sets' });
    }
});

// Get cards for a specific set
router.get('/:code/cards', async (req, res) => {
    const { code } = req.params;
    try {
        console.log(`[API] Fetching cards for set ${code}...`);
        // Case insensitive match
        const cards = await knex('cards')
            .whereRaw('LOWER(setcode) = ?', [code.toLowerCase()])
            .orderByRaw("CAST(regexp_replace(number, '[^0-9]', '', 'g') AS INTEGER)") // Sort by number numeric
            .orderBy('number', 'asc'); // secondary sort for variants

        if (!cards || cards.length === 0) {
            console.warn(`[API] No cards found for set ${code}, returning empty array.`);
            // return res.status(404).json({ error: 'No cards found for this set' });
            // Returning empty is safer for UI than 404
            return res.json({ data: [] });
        }

        // Return flattened data
        const mappedCards = cards.map(c => ({
            ...c.data,
            // Ensure local ID or relevant fields overwrite if necessary, 
            // but usually c.data holds the Scryfall object which is what frontend expects.
            // We might want to ensure 'id' matches the UUID from our table if they differ (they shouldn't).
        }));

        res.json({ data: mappedCards });
    } catch (err) {
        console.error(`[API] Error fetching cards for set ${code}:`, err);
        res.status(500).json({ error: 'Failed to fetch set cards' });
    }
});

export default router;
