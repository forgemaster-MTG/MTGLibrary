import express from 'express';
import { knex } from '../db.js';
import { cardService } from '../services/cardService.js';

const router = express.Router();

// Simple in-memory cache
let setsCache = {
    data: null,
    lastFetched: 0
};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Get all sets
router.get('/', async (req, res) => {
    try {
        const now = Date.now();
        if (setsCache.data && (now - setsCache.lastFetched < CACHE_DURATION)) {
            console.log(`[API] Sets Cache HIT (${setsCache.data.length} sets)`);
            return res.json({ data: setsCache.data });
        }

        console.log('[API] Fetching sets and calculating unique card counts (Cache Miss)...');
        const sets = await knex('sets').orderBy('releasedate', 'desc');
        console.log(`[API] DB returned ${sets ? sets.length : 0} sets.`);
        if (sets.length > 0) console.log(`[API] First 5 sets: ${sets.slice(0, 5).map(s => s.code).join(', ')}`);

        if (sets && sets.length > 0) {
            // Fetch unique card counts by name from cards table
            const counts = await knex('cards')
                .select(knex.raw('LOWER(setcode) as code'))
                .countDistinct({ count: 'name' })
                .groupByRaw('LOWER(setcode)');

            const countMap = {};
            counts.forEach(function (c) {
                if (c.code) {
                    countMap[c.code.toLowerCase()] = parseInt(c.count);
                }
            });

            // Map DB columns to Scryfall style for frontend
            const mappedSets = sets.map(function (s) {
                const code = s.code.toLowerCase();
                // Use actual unique count if found, otherwise fallback to totalsetsize
                const actualCount = countMap[code] !== undefined ? countMap[code] : s.totalsetsize;

                return {
                    id: s.uuid || s.code,
                    code: s.code,
                    name: s.name,
                    released_at: s.releasedate,
                    set_type: s.type,
                    card_count: actualCount,
                    icon_svg_uri: 'https://svgs.scryfall.io/sets/' + s.code.toLowerCase() + '.svg',
                    digital: s.isonlineonly
                };
            });

            // Update cache
            setsCache = {
                data: mappedSets,
                lastFetched: now
            };

            return res.json({ data: mappedSets });
        }

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

        // Deduplicate cards by collector number to prevent UI "breaking"
        const uniqueCardsMap = {};
        cards.forEach(c => {
            // If we haven't seen this number, or if this version has data
            const existing = uniqueCardsMap[c.number];
            if (!existing || (!existing.data && c.data)) {
                uniqueCardsMap[c.number] = c;
            }
        });

        const dedupedCards = Object.values(uniqueCardsMap);

        // Optional: Trigger background repair for cards with no data
        const needsRepair = dedupedCards.filter(c => !c.data);
        if (needsRepair.length > 0) {
            console.log(`[API] Triggering background repair for ${needsRepair.length} cards in set ${code}`);
            // Don't await, run in background
            cardService.repairCards(needsRepair).catch(console.error);
        }

        // Return data with column fallbacks
        const mappedCards = dedupedCards.map(c => {
            // Helper to get image from data if available
            let image_uri = null;
            if (c.data?.image_uris?.normal) {
                image_uri = c.data.image_uris.normal;
            } else if (c.data?.card_faces?.[0]?.image_uris?.normal) {
                image_uri = c.data.card_faces[0].image_uris.normal;
            }

            return {
                id: c.id,
                name: c.name,
                set: c.setcode,
                number: c.number,
                image_uri: image_uri,
                ...c.data,
                scryfall_id: c.data?.id || c.id
            };
        });

        res.json({ data: mappedCards });
    } catch (err) {
        console.error(`[API] Error fetching cards for set ${code}:`, err);
        res.status(500).json({ error: 'Failed to fetch set cards' });
    }
});

export default router;
