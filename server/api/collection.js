import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';
import { cardService } from '../services/cardService.js';

import { checkLimit, verifyLimit } from '../middleware/usageLimits.js';

const router = express.Router();

router.use(authMiddleware);

const dynamicLimitCheck = (req, res, next) => {
    const resource = req.body.is_wishlist ? 'wishlist' : 'collection';
    const amount = req.body.count || 1;
    return checkLimit(resource, amount)(req, res, next);
};

const batchLimitCheck = async (req, res, next) => {
    try {
        const cards = req.body.cards || [];
        const collectionAmount = cards.filter(c => !c.is_wishlist).reduce((sum, c) => sum + (c.count || 1), 0);
        const wishlistAmount = cards.filter(c => c.is_wishlist).reduce((sum, c) => sum + (c.count || 1), 0);

        const tierId = req.user.override_tier || req.user.subscription_tier || 'free';

        if (collectionAmount > 0) {
            await verifyLimit(req.user.id, tierId, 'collection', collectionAmount);
        }
        if (wishlistAmount > 0) {
            await verifyLimit(req.user.id, tierId, 'wishlist', wishlistAmount);
        }
        next();
    } catch (err) {
        if (err.code === 'LIMIT_REACHED') {
            return res.status(403).json({
                error: err.message,
                code: err.code,
                limit: err.limit,
                current: err.current,
                tier: err.tier
            });
        }
        console.error('[collection] batch limit check error', err);
        res.status(500).json({ error: 'Failed to verify usage limits' });
    }
};

// Export entire library (Collection + Decks)
router.get('/export', async (req, res) => {
    try {
        const cards = await knex('user_cards')
            .where({ user_id: req.user.id })
            .orderBy('id', 'desc');

        const decks = await knex('user_decks')
            .where({ user_id: req.user.id })
            .orderBy('updated_at', 'desc');

        res.json({ cards, decks });
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
        if (req.query.userId && String(req.query.userId) !== String(req.user.id)) {

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
                const targetUserId = req.query.userId;
                targetUserIds = [targetUserId];

                // 1. Check Explicit Permission
                const perm = await knex('collection_permissions')
                    .where({
                        owner_id: targetUserId,
                        grantee_id: req.user.id
                    })
                    .whereNull('target_deck_id')
                    .first();

                // 2. Check Public Status
                const targetUser = await knex('users').where('id', targetUserId).first();
                const isPublic = targetUser && targetUser.is_public_library;

                // 3. Check Friendship
                const isFriend = await knex('user_relationships')
                    .where(b => b.where('requester_id', req.user.id).andWhere('addressee_id', targetUserId))
                    .orWhere(b => b.where('requester_id', targetUserId).andWhere('addressee_id', req.user.id))
                    .andWhere('status', 'accepted')
                    .first();

                // Allow if any condition matches
                if (!perm && !isPublic && !isFriend) {
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
router.post('/', dynamicLimitCheck, async (req, res) => {
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
            finish: finish || 'nonfoil',
            image_uri: req.body.image_uri || cardService.resolveImage(data) || null,
            count: count || 1,
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

        if (deck_id !== undefined) update.deck_id = deck_id;
        if (count !== undefined) update.count = count;
        if (finish !== undefined) update.finish = finish;
        if (req.body.is_wishlist !== undefined) update.is_wishlist = req.body.is_wishlist;
        if (price_bought !== undefined) update.price_bought = price_bought;
        if (tags !== undefined) update.tags = JSON.stringify(tags);

        if (Object.keys(update).length === 0) return res.json(existing);

        const removeTag = async (dId) => {
            if (!dId) return;
            const d = await knex('user_decks').where({ id: dId }).first();
            if (d && d.tags) {
                const t = typeof d.tags === 'string' ? JSON.parse(d.tags) : d.tags;
                if (t.includes('Precon')) {
                    await knex('user_decks').where({ id: dId }).update({ tags: JSON.stringify(t.filter(x => x !== 'Precon')) });
                }
            }
        };

        if (deck_id !== undefined && deck_id !== existing.deck_id) {
            if (existing.deck_id) await removeTag(existing.deck_id);
            if (deck_id) await removeTag(deck_id);
        } else if (count !== undefined && count !== existing.count && existing.deck_id) {
            await removeTag(existing.deck_id);
        }

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

        if (existing.deck_id) {
            const d = await knex('user_decks').where({ id: existing.deck_id }).first();
            if (d && d.tags) {
                const t = typeof d.tags === 'string' ? JSON.parse(d.tags) : d.tags;
                if (t.includes('Precon')) {
                    await knex('user_decks').where({ id: existing.deck_id }).update({ tags: JSON.stringify(t.filter(x => x !== 'Precon')) });
                }
            }
        }

        await knex('user_cards').where({ id: req.params.id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error('[collection] delete error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Batch Delete Cards
router.delete('/batch/delete', async (req, res) => {
    try {
        const { cardIds } = req.body;
        const userId = req.user.id;

        if (!Array.isArray(cardIds)) return res.status(400).json({ error: 'cardIds must be an array' });

        await knex('user_cards')
            .whereIn('id', cardIds)
            .andWhere({ user_id: userId })
            .del();

        res.json({ success: true, count: cardIds.length });
    } catch (err) {
        console.error('[collection] batch delete error', err);
        res.status(500).json({ error: 'batch delete failed' });
    }
});

// Batch Import (Replace or Merge)
router.post('/batch', batchLimitCheck, async (req, res) => {
    try {
        const { cards, decks, mode } = req.body; // cards: [], decks: [] (optional), mode: 'replace' | 'merge'
        const userId = req.user.id;

        if (!Array.isArray(cards)) return res.status(400).json({ error: 'cards must be an array' });

        // Filter and Map
        const validCards = cards.filter(c => c.scryfall_id || c.id);
        if (validCards.length < cards.length) {
            console.warn(`[collection] Batch import skipping ${cards.length - validCards.length} invalid cards (missing id)`);
        }

        await knex.transaction(async (trx) => {
            console.log(`[collection] TRACE: userId ${userId} starting batch import mode=${mode}`);
            console.log(`[collection] TRACE: decks type is ${typeof decks}, isArray=${Array.isArray(decks)}, length=${decks?.length}`);

            // 1. If Replace, wipe existing collection
            if (mode === 'replace') {
                const wipedCards = await trx('user_cards').where({ user_id: userId }).del();
                console.log(`[collection] TRACE: Wiped ${wipedCards} cards for user ${userId}`);

                // CRITICAL: Only wipe decks if we have decks in the backup to replace them with!
                if (decks !== undefined && decks !== null && Array.isArray(decks) && decks.length > 0) {
                    const wipedDecks = await trx('user_decks').where({ user_id: userId }).del();
                    console.log(`[collection] TRACE: WIPING DECKS! Count: ${wipedDecks}`);
                } else {
                    console.log(`[collection] TRACE: PRESERVING DECKS (Condition: decks=${decks}, isArray=${Array.isArray(decks)}, len=${decks?.length})`);
                }
            }

            // 2. Restore Decks if present
            const deckIdMap = new Map(); // Old ID -> New ID mapping if they change
            if (decks && Array.isArray(decks)) {
                for (const d of decks) {
                    const [newDeck] = await trx('user_decks').insert({
                        user_id: userId,
                        name: d.name,
                        format: d.format || 'Commander',
                        commander: d.commander || null,
                        commander_partner: d.commander_partner || null,
                        ai_blueprint: d.ai_blueprint || d.aiBlueprint || null,
                        is_mockup: d.is_mockup || d.isMockup || false,
                        is_public: d.is_public || d.isPublic || false,
                        share_slug: d.share_slug || d.shareSlug || null,
                        tags: typeof d.tags === 'string' ? d.tags : JSON.stringify(d.tags || []),
                        firestore_id: d.firestore_id || d.id // Preserve original ID for card mapping
                    }).returning('*');

                    deckIdMap.set(d.id, newDeck.id);
                }
            }

            // 3. Fetch valid deck and binder IDs for validation (including newly created ones)
            const currentUserDecks = await trx('user_decks').where({ user_id: userId }).select('id', 'firestore_id');
            const currentUserBinders = await trx('binders').where({ user_id: userId }).select('id');

            const validDeckIds = new Set(currentUserDecks.map(d => d.id));
            const validBinderIds = new Set(currentUserBinders.map(b => b.id));

            // Map original firestore_ids or string IDs to current UUIDs
            const deckLegacyMap = new Map();
            currentUserDecks.forEach(d => {
                if (d.firestore_id) deckLegacyMap.set(d.firestore_id, d.id);
            });

            // 4. Process each card
            let inserted = 0;
            let updated = 0;

            for (const c of validCards) {
                const scryfallId = c.scryfall_id || c.id;
                const setCode = (c.set_code || c.set || '???').toUpperCase();
                const collectorNumber = c.collector_number || '0';
                const finish = c.finish || 'nonfoil';
                const isWishlist = c.is_wishlist || false;
                const incomingCount = c.count || 1;

                // Validate FKs
                let deckId = null;
                const incomingDeckId = c.deck_id || c.deckId;
                if (incomingDeckId) {
                    if (validDeckIds.has(incomingDeckId)) deckId = incomingDeckId;
                    else if (deckIdMap.has(incomingDeckId)) deckId = deckIdMap.get(incomingDeckId);
                    else if (deckLegacyMap.has(incomingDeckId)) deckId = deckLegacyMap.get(incomingDeckId);
                }

                const binderId = (c.binder_id && validBinderIds.has(c.binder_id)) ? c.binder_id : null;

                // --- 1. TRANSFER LOGIC ---
                // If mode is transfer_to_deck, we first try to find the card in the binder and "take" it.
                if (mode === 'transfer_to_deck' && deckId) {
                    const binderCards = await trx('user_cards')
                        .where({
                            user_id: userId,
                            scryfall_id: scryfallId,
                            set_code: setCode,
                            collector_number: collectorNumber,
                            finish: finish,
                            is_wishlist: false, // Don't transfer from wishlist
                            deck_id: null
                        })
                        .orderBy('count', 'desc'); // Take from largest stacks first

                    let remainingToTransfer = incomingCount;
                    for (const bc of binderCards) {
                        if (remainingToTransfer <= 0) break;
                        const take = Math.min(bc.count, remainingToTransfer);
                        if (bc.count <= take) {
                            await trx('user_cards').where({ id: bc.id }).del();
                        } else {
                            await trx('user_cards').where({ id: bc.id }).update({ count: bc.count - take });
                        }
                        remainingToTransfer -= take;
                    }

                    // If we couldn't find enough in the binder, and fallback is NOT allowed, we might skip.
                    // But for this feature, if we didn't find it, we just add it anyway as "new" acquisition
                    // unless a strict flag is passed.
                }

                // --- 2. MERGE/INSERT LOGIC ---

                // Check for existing card with same attributes (Binder merge only)
                let existing = null;
                if (mode !== 'replace' && !deckId) {
                    existing = await trx('user_cards')
                        .where({
                            user_id: userId,
                            scryfall_id: scryfallId,
                            set_code: setCode,
                            collector_number: collectorNumber,
                            finish: finish,
                            is_wishlist: isWishlist,
                            deck_id: null,
                            binder_id: binderId
                        })
                        .first();
                }

                if (existing) {
                    // Update existing card - increment count
                    const newCount = (existing.count || 1) + incomingCount;

                    // Merge tags
                    const existingTags = typeof existing.tags === 'string' ? JSON.parse(existing.tags || '[]') : (existing.tags || []);
                    const incomingTags = typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []);
                    const mergedTags = [...new Set([...existingTags, ...incomingTags])];

                    await trx('user_cards')
                        .where({ id: existing.id })
                        .update({
                            count: newCount,
                            tags: JSON.stringify(mergedTags),
                            data: c.data || existing.data,
                            price_bought: c.price_bought !== undefined ? c.price_bought : existing.price_bought,
                            binder_id: binderId || existing.binder_id,
                            image_uri: c.image_uri || cardService.resolveImage(c.data || existing.data) || existing.image_uri
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
                        collector_number: collectorNumber,
                        finish: finish,
                        image_uri: c.image_uri || cardService.resolveImage(cardData) || null,
                        count: incomingCount,
                        count: incomingCount,
                        data: cardData,
                        deck_id: deckId,
                        binder_id: binderId,
                        is_wishlist: isWishlist,
                        price_bought: c.price_bought || null,
                        tags: typeof c.tags === 'string' ? c.tags : JSON.stringify(c.tags || [])
                    });

                    inserted++;
                }
            }

            console.log(`[collection] Batch import (${mode}): ${inserted} inserted, ${updated} updated, ${decks?.length || 0} decks processed`);
        });

        res.json({ success: true, count: validCards.length });

    } catch (err) {
        console.error('[collection] batch import error', err);
        res.status(500).json({ error: 'batch import failed', details: err.message });
    }
});

export default router;
