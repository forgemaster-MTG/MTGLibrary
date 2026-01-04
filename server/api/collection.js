import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';
import { cardService } from '../services/cardService.js';

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
        let targetUserIds = [req.user.id];
        let mixedMode = false;

        // Check request specific user or 'all'
        if (req.query.userId && req.query.userId !== req.user.id) {

            if (req.query.userId === 'all') {
                mixedMode = true;
                // Fetch all people who have shared with me globally
                const permissions = await knex('collection_permissions')
                    .where('grantee_id', req.user.id)
                    .whereNull('target_deck_id')
                    .select('owner_id');

                const friendIds = permissions.map(p => p.owner_id);
                targetUserIds = [req.user.id, ...friendIds];
            } else {
                // Specific friend
                targetUserIds = [req.query.userId];

                // Verify Global Permission
                const perm = await knex('collection_permissions')
                    .where({
                        owner_id: req.query.userId,
                        grantee_id: req.user.id
                    })
                    .whereNull('target_deck_id') // Global permission
                    .first();

                if (!perm) {
                    return res.status(403).json({ error: 'Access denied to this collection' });
                }
            }
        }

        const q = knex('user_cards')
            .join('users', 'user_cards.user_id', 'users.id')
            .whereIn('user_cards.user_id', targetUserIds)
            .select('user_cards.*', 'users.username as owner_username', 'users.id as owner_id');

        if (req.query.deck_id) {
            if (req.query.deck_id === 'null' || req.query.deck_id === 'binder') {
                q.whereNull('user_cards.deck_id');
            } else {
                q.where({ 'user_cards.deck_id': req.query.deck_id });
            }
        }

        // simple search
        if (req.query.name) {
            q.whereRaw('user_cards.name ILIKE ?', [`%${req.query.name}%`]);
        }

        // Filter by type line (searches within the data JSON column)
        if (req.query.type_line) {
            const terms = req.query.type_line.split(' ').filter(Boolean);
            terms.forEach(term => {
                // Assuming data is unique to user_cards
                q.whereRaw("user_cards.data->>'type_line' ILIKE ?", [`%${term}%`]);
            });
        }

        // Filter for unused cards (not in a deck)
        if (req.query.unused === 'true') {
            q.whereNull('user_cards.deck_id');
        }

        // Filter by Wishlist
        if (req.query.wishlist !== undefined) {
            // Use array syntax for safety if needed, implies strict equality
            q.where('user_cards.is_wishlist', req.query.wishlist === 'true');
        }

        const rows = await q.orderBy('user_cards.added_at', 'desc');

        // Background repair for cards missing images or data
        const needsRepair = rows.filter(r => !r.image_uri || !r.data);
        if (needsRepair.length > 0) {
            cardService.repairCards(needsRepair, 'user_cards').catch(console.error);
        }

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
        const { scryfall_id, name, set_code, collector_number, finish, count, data, deck_id, targetUserId } = req.body;

        if (!scryfall_id || !name) return res.status(400).json({ error: 'Missing required card fields' });

        let userId = req.user.id;

        // Permission Check for Shared Collection
        if (targetUserId && targetUserId !== req.user.id) {
            const perm = await knex('collection_permissions')
                .where({
                    owner_id: targetUserId,
                    grantee_id: req.user.id
                })
                .whereNull('target_deck_id') // Global permission check
                .whereIn('permission_level', ['contributor', 'editor', 'admin'])
                .first();

            if (!perm) {
                return res.status(403).json({ error: 'You do not have permission to add to this collection.' });
            }
            userId = targetUserId;
        }

        const insert = {
            user_id: userId,
            scryfall_id,
            name,
            set_code: set_code || '???',
            collector_number: collector_number || '0',
            finish: finish || 'nonfoil',
            image_uri: cardService.resolveImage(data) || null,
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

            // 2. Process each card - check for existing and merge or insert
            let inserted = 0;
            let updated = 0;

            for (const c of validCards) {
                const scryfallId = c.scryfall_id || c.id;
                const setCode = c.set_code || c.set || '???';
                const collectorNumber = c.collector_number || '0';
                const finish = c.finish || 'nonfoil';

                // Check for existing card with same attributes
                const existing = await trx('user_cards')
                    .where({
                        user_id: userId,
                        scryfall_id: scryfallId,
                        set_code: setCode,
                        collector_number: collectorNumber,
                        finish: finish
                    })
                    .whereNull('deck_id') // Only merge binder cards
                    .first();

                if (existing) {
                    // Update existing card - increment count
                    const newCount = (existing.count || 1) + (c.count || 1);

                    // Merge tags
                    const existingTags = JSON.parse(existing.tags || '[]');
                    const newTags = JSON.parse(c.tags || '[]');
                    const mergedTags = [...new Set([...existingTags, ...newTags])];

                    await trx('user_cards')
                        .where({ id: existing.id })
                        .update({
                            count: newCount,
                            tags: JSON.stringify(mergedTags),
                            data: c.data || existing.data // Update data if provided
                        });

                    updated++;
                } else {
                    // Insert new card
                    const cardData = c.data || c;
                    await trx('user_cards').insert({
                        user_id: userId,
                        scryfall_id: scryfallId,
                        name: c.name,
                        set_code: setCode,
                        collector_number: collectorNumber,
                        finish: finish,
                        image_uri: cardService.resolveImage(cardData) || c.image_uri || null,
                        count: c.count || 1,
                        data: cardData,
                        deck_id: null,
                        tags: c.tags || '[]'
                    });

                    inserted++;
                }
            }

            console.log(`[collection] Batch import: ${inserted} inserted, ${updated} updated`);
        });

        res.json({ success: true, count: validCards.length });

    } catch (err) {
        console.error('[collection] batch import error', err);
        res.status(500).json({ error: 'batch import failed' });
    }
});

export default router;
