import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Export entire collection
router.get('/export', async (req, res) => {
    try {
        const rows = await knex('user_cards')
            .where({ user_id: req.user.id })
            .orderBy('id', 'desc');
        res.json(rows);
    } catch (err) {
        console.error('[collection] export error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// ... (List endpoint also uses orderBy?)

// List cards
router.get('/', async (req, res) => {
    try {
        const q = knex('user_cards').where({ user_id: req.user.id });

        if (req.query.deck_id) {
            if (req.query.deck_id === 'null' || req.query.deck_id === 'binder') {
                q.whereNull('deck_id');
            } else {
                q.where({ deck_id: req.query.deck_id });
            }
        }

        // simple search
        if (req.query.name) {
            q.whereRaw('name ILIKE ?', [`%${req.query.name}%`]);
        }

        // Filter by type line (searches within the data JSON column)
        if (req.query.type_line) {
            const terms = req.query.type_line.split(' ').filter(Boolean);
            terms.forEach(term => {
                q.whereRaw("data->>'type_line' ILIKE ?", [`%${term}%`]);
            });
        }

        // Filter for unused cards (not in a deck)
        if (req.query.unused === 'true') {
            q.whereNull('deck_id');
        }

        // Filter by Wishlist
        if (req.query.wishlist !== undefined) {
            q.where({ is_wishlist: req.query.wishlist === 'true' });
        }

        const rows = await q.orderBy('id', 'desc').limit(500);
        res.json(rows);
    } catch (err) {
        console.error('[collection] list error', err);
        res.status(500).json({ error: 'db error' });
    }
});



// Add card to collection (or deck)
router.post('/', async (req, res) => {
    try {
        // Body should contain scryfall_id, and other cache data
        const { scryfall_id, name, set_code, collector_number, finish, count, data, deck_id } = req.body;

        if (!scryfall_id || !name) return res.status(400).json({ error: 'Missing required card fields' });

        const insert = {
            user_id: req.user.id,
            scryfall_id,
            name,
            set_code: set_code || '???',
            collector_number: collector_number || '0',
            finish: finish || 'nonfoil',
            image_uri: (data && data.image_uris && data.image_uris.normal) || null,
            count: count || 1,
            data: data || null,
            deck_id: deck_id || null,
            is_wishlist: req.body.is_wishlist || false,
            tags: JSON.stringify(req.body.tags || []),
            price_bought: req.body.price_bought || null
        };

        const [row] = await knex('user_cards').insert(insert).returning('*');
        res.status(201).json(row);
    } catch (err) {
        console.error('[collection] add error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Update card (e.g. move to deck, change count)
router.put('/:id', async (req, res) => {
    try {
        const existing = await knex('user_cards').where({ id: req.params.id }).first();
        if (!existing) return res.status(404).json({ error: 'not found' });
        if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'unauthorized' });

        const { deck_id, count, finish, price_bought, tags } = req.body;
        const update = {};

        // Explicit check for undefined to allow setting to null or 0
        if (deck_id !== undefined) update.deck_id = deck_id;
        if (count !== undefined) update.count = count;
        if (finish !== undefined) update.finish = finish;
        if (req.body.is_wishlist !== undefined) update.is_wishlist = req.body.is_wishlist;
        if (price_bought !== undefined) update.price_bought = price_bought;
        if (tags !== undefined) update.tags = JSON.stringify(tags);

        if (Object.keys(update).length === 0) return res.json(existing);

        const [row] = await knex('user_cards')
            .where({ id: req.params.id })
            .update(update)
            .returning('*');

        res.json(row);
    } catch (err) {
        console.error('[collection] update error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Remove card
router.delete('/:id', async (req, res) => {
    try {
        const existing = await knex('user_cards').where({ id: req.params.id }).first();
        if (!existing) return res.status(404).json({ error: 'not found' });
        if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'unauthorized' });

        await knex('user_cards').where({ id: req.params.id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error('[collection] delete error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Batch Import (Replace or Merge)
router.post('/batch', async (req, res) => {
    // Increase timeout for large imports if needed? Express default is usually fine for <10k rows if batched.
    try {
        const { cards, mode } = req.body; // mode: 'replace' | 'merge'
        const userId = req.user.id;

        if (!Array.isArray(cards)) return res.status(400).json({ error: 'cards must be an array' });

        // Filter and Map
        const validCards = cards.filter(c => c.scryfall_id || c.id);
        if (validCards.length < cards.length) {
            console.warn(`[collection] Batch import skipping ${cards.length - validCards.length} invalid cards (missing id)`);
        }

        await knex.transaction(async (trx) => {
            // 1. If Replace, wipe existing collection AND decks
            if (mode === 'replace') {
                await trx('user_cards').where({ user_id: userId }).del();
                await trx('user_decks').where({ user_id: userId }).del();
            }

            // 2. Prepare inserts
            const inserts = validCards.map(c => ({
                user_id: userId,
                scryfall_id: c.scryfall_id || c.id,
                name: c.name,
                set_code: c.set_code || c.set || '???',
                collector_number: c.collector_number || '0',
                finish: c.finish || 'nonfoil',
                image_uri: (c.data && c.data.image_uris?.normal) || c.image_uri || (c.image_uris?.normal) || null,
                count: c.count || 1,
                data: c.data || c, // Store full object if provided, or the card itself
                deck_id: null
                // added_at removed to match schema
            }));

            // 3. Batch Insert (chunk size 50)
            if (inserts.length > 0) {
                await trx.batchInsert('user_cards', inserts, 50);
            }
        });

        res.json({ success: true, count: cards.length });

    } catch (err) {
        console.error('[collection] batch import error', err);
        res.status(500).json({ error: 'batch import failed' });
    }
});

export default router;
