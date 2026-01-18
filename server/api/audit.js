import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';
import { cardService } from '../services/cardService.js';

const router = express.Router();

// Get Active Audit Session
router.get('/active', authMiddleware, async (req, res) => {
    try {
        const session = await knex('audit_sessions')
            .where({
                user_id: req.user.id,
                status: 'active'
            })
            .where('expires_at', '>', knex.fn.now())
            .orderBy('created_at', 'desc')
            .first();

        res.json(session || null);
    } catch (err) {
        console.error('[audit] get active error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Start New Audit
router.post('/start', authMiddleware, async (req, res) => {
    const { type, targetId } = req.body;
    // type: 'collection', 'binder', 'deck', 'set'

    try {
        // Check for existing active session
        const existing = await knex('audit_sessions')
            .where({
                user_id: req.user.id,
                status: 'active'
            })
            .where('expires_at', '>', knex.fn.now())
            .first();

        if (existing) {
            return res.status(400).json({ error: 'An audit is already in progress.', session: existing });
        }

        await knex.transaction(async trx => {
            // 1. Create Session
            const [session] = await trx('audit_sessions').insert({
                user_id: req.user.id,
                type,
                target_id: targetId ? String(targetId) : null,
                status: 'active',
                expires_at: knex.raw("NOW() + INTERVAL '30 days'")
            }).returning('*');

            // 2. Snapshot Items
            let itemsQuery;

            if (type === 'collection') {
                itemsQuery = trx('user_cards')
                    .select(
                        trx.raw('? as session_id', [session.id]),
                        'name',
                        'set_code',
                        'collector_number',
                        'finish',
                        'deck_id', // Capture deck_id for grouping
                        'count as expected_quantity',
                        trx.raw('0 as actual_quantity')
                    )
                    .where({ user_id: req.user.id });
            } else if (type === 'binder') {
                // TODO: Implement Binder logic when binders are fully supported
                itemsQuery = trx('user_cards')
                    .select(
                        trx.raw('? as session_id', [session.id]),
                        'name',
                        'set_code',
                        'collector_number',
                        'finish',
                        'count as expected_quantity',
                        trx.raw('0 as actual_quantity')
                    )
                    .where({ user_id: req.user.id }) // Simplified for now
                    .whereNull('deck_id');
            } else if (type === 'set') {
                itemsQuery = trx('user_cards')
                    .select(
                        trx.raw('? as session_id', [session.id]),
                        'name',
                        'set_code',
                        'collector_number',
                        'finish',
                        'deck_id',
                        'count as expected_quantity',
                        'count as actual_quantity' // Default to verified
                    )
                    .where({ user_id: req.user.id })
                    .whereRaw('lower(set_code) = ?', [targetId.toLowerCase()]);
            } else if (type === 'deck') {
                itemsQuery = trx('user_cards')
                    .select(
                        trx.raw('? as session_id', [session.id]),
                        'name',
                        'set_code',
                        'collector_number',
                        'finish',
                        'deck_id',
                        'count as expected_quantity',
                        'count as actual_quantity' // Default to verified
                    )
                    .where({ deck_id: targetId });
            }

            if (itemsQuery) {
                // Insert into audit_items
                // Note: We need to make sure columns match exactly
                // Using a slightly different approach: fetch then insert to avoid strict column matching issues in raw SQL
                const items = await itemsQuery;
                if (items.length > 0) {
                    const mappedItems = items.map(item => ({
                        session_id: session.id,
                        name: item.name,
                        set_code: item.set_code,
                        collector_number: item.collector_number,
                        finish: item.finish || 'nonfoil',
                        deck_id: item.deck_id, // Save deck_id
                        expected_quantity: item.expected_quantity,
                        actual_quantity: item.actual_quantity, // Use verified count
                        reviewed: false // Default to unreviewed
                    }));

                    await trx.batchInsert('audit_items', mappedItems, 500);
                }
            }

            res.json(session);
        });

    } catch (err) {
        console.error('[audit] start error', err);
        res.status(500).json({ error: 'Failed to start audit: ' + err.message });
    }
});

// Cancel Audit
router.get('/:id/items', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { deckId, group } = req.query; // Filters

        const session = await knex('audit_sessions').where({ id, user_id: req.user.id }).first();
        if (!session) return res.status(404).json({ error: 'Session not found' });

        let query = knex('audit_items')
            .leftJoin(
                knex('cards').distinctOn(knex.raw('lower(setcode)'), 'number').select('setcode', 'number', 'data').as('cards'),
                function () {
                    this.on(knex.raw('lower("audit_items"."set_code")'), '=', knex.raw('lower("cards"."setcode")'))
                        .andOn('audit_items.collector_number', '=', 'cards.number')
                }
            )
            .select(
                'audit_items.*',
                knex.raw("COALESCE(cards.data, '{}'::jsonb) as card_data")
            )
            .where({ 'audit_items.session_id': id });

        if (deckId) {
            query = query.where({ 'audit_items.deck_id': deckId });
        } else if (group) {
            // Group is set_code for loose cards
            const lowerGroup = group.toLowerCase();
            console.log(`[Audit Items] Querying group: "${group}" (lower: "${lowerGroup}")`);

            // DEBUG: Check counts for this group before filtering deck_id
            const allInGroup = await knex('audit_items')
                .where({ session_id: id })
                .whereRaw('lower(set_code) = ?', [lowerGroup])
                .count('* as count')
                .first();

            const withDeckId = await knex('audit_items')
                .where({ session_id: id })
                .whereRaw('lower(set_code) = ?', [lowerGroup])
                .whereNotNull('deck_id')
                .count('* as count')
                .first();

            console.log(`[Audit Items] Group Stats for "${group}": Total rows: ${allInGroup.count}, In Decks: ${withDeckId.count}, Loose: ${allInGroup.count - withDeckId.count}`);

            query = query.where(knex.raw('lower("audit_items"."set_code")'), lowerGroup)
                .whereNull('audit_items.deck_id');
        }

        const items = await query.orderBy('audit_items.name', 'asc');

        const mapped = items.map(item => {
            const data = item.card_data || {};
            // Robust art crop extraction (handle single face and double faced)
            let artUri = data.image_uris?.art_crop;
            if (!artUri && data.card_faces?.[0]?.image_uris?.art_crop) {
                artUri = data.card_faces[0].image_uris.art_crop;
            }

            return {
                ...item,
                image_uri: cardService.resolveImage(item.card_data),
                art_uri: artUri || item.card_data?.image_uris?.large || item.card_data?.image_uris?.normal || cardService.resolveImage(item.card_data)
            };
        });

        // Check for available foils if this is a deck audit
        let availableFoils = [];
        if (session.type === 'deck') {
            const cardNames = mapped.map(i => i.name);
            availableFoils = await knex('user_cards')
                .select('name', 'set_code', 'collector_number')
                .whereIn('name', cardNames)
                .where({
                    user_id: req.user.id,
                    finish: 'foil'
                })
                .whereNull('deck_id');
        }

        const finalMapped = mapped.map(item => {
            const hasUpgrade = session.type === 'deck' &&
                item.finish === 'nonfoil' &&
                availableFoils.some(f =>
                    f.name === item.name &&
                    (f.set_code || '').toLowerCase() === (item.set_code || '').toLowerCase() &&
                    String(f.collector_number) === String(item.collector_number)
                );
            return {
                ...item,
                has_foil_upgrade: hasUpgrade
            };
        });

        res.json(finalMapped);
    } catch (err) {
        console.error('[audit] get items error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Update Audit Item Count
router.put('/:id/item/:itemId', authMiddleware, async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const { quantity, reviewed } = req.body;
        const updatePayload = {};

        // Validation
        if (typeof quantity === 'number' && quantity >= 0) {
            updatePayload.actual_quantity = quantity;
        }
        if (typeof reviewed === 'boolean') {
            updatePayload.reviewed = reviewed;
        }

        if (Object.keys(updatePayload).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const updated = await knex('audit_items')
            .where({ id: itemId, session_id: id })
            .update(updatePayload);

        if (!updated) return res.status(404).json({ error: 'Item not found' });

        res.json({ success: true });
    } catch (err) {
        console.error('[audit] update item error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Swap Normal for Foil (Deck Audit Only)
router.post('/:id/item/:itemId/swap-foil', authMiddleware, async (req, res) => {
    const trx = await knex.transaction();
    try {
        const { id, itemId } = req.params;
        const userId = req.user.id;

        // 1. Get the Audit Item (Normal)
        const auditItem = await trx('audit_items')
            .where({ id: itemId, session_id: id })
            .first();

        if (!auditItem) {
            await trx.rollback();
            return res.status(404).json({ error: 'Audit item not found' });
        }

        const session = await trx('audit_sessions').where({ id }).first();
        if (session.type !== 'deck' || !session.target_id) {
            await trx.rollback();
            return res.status(400).json({ error: 'Foil swap only available for deck audits' });
        }

        // 2. Find the Physical Normal Card in the Deck
        // We look for a card in user_cards with matching attributes AND deck_id = session.target_id
        // LIMIT 1 because we only swap one instance
        const normalCard = await trx('user_cards')
            .where({
                user_id: userId,
                name: auditItem.name,
                set_code: auditItem.set_code,
                collector_number: auditItem.collector_number,
                finish: 'nonfoil',
                deck_id: session.target_id
            })
            .first();

        if (!normalCard) {
            await trx.rollback();
            return res.status(404).json({ error: 'Normal card copy not found in deck' });
        }

        // 3. Find the Physical Foil Card in Binder (not in a deck)
        const foilCard = await trx('user_cards')
            .where({
                user_id: userId,
                name: auditItem.name,
                set_code: auditItem.set_code,
                collector_number: auditItem.collector_number,
                finish: 'foil'
            })
            .whereNull('deck_id')
            .first();

        if (!foilCard) {
            await trx.rollback();
            return res.status(404).json({ error: 'No foil copy available in binder' });
        }

        // 4. Perform the Swap
        // Normal -> Binder (deck_id = null)
        await trx('user_cards')
            .where({ id: normalCard.id })
            .update({ deck_id: null });

        // Foil -> Deck (deck_id = target_id)
        await trx('user_cards')
            .where({ id: foilCard.id })
            .update({ deck_id: session.target_id });

        // 5. Update Audit Items
        // The "Normal" audit item expected_quantity decreases by 1
        // If it reaches 0, we can remove it? Or just keep it as 0? 
        // Keeping it as 0 allows user to see what happened.
        let newNormalExpected = auditItem.expected_quantity - 1;
        await trx('audit_items')
            .where({ id: auditItem.id })
            .update({
                expected_quantity: newNormalExpected,
                // If actual was > 0, we might need to adjust it?
                // Assuming user hasn't verified it yet or verifies it now.
                // Let's leave actual alone unless it > expected.
                actual_quantity: Math.min(auditItem.actual_quantity, newNormalExpected)
            });

        // The "Foil" audit item expected_quantity increases by 1
        // Does a foil row already exist?
        const foilAuditItem = await trx('audit_items')
            .where({
                session_id: id,
                name: auditItem.name,
                set_code: auditItem.set_code,
                collector_number: auditItem.collector_number,
                finish: 'foil'
            })
            .first();

        if (foilAuditItem) {
            await trx('audit_items')
                .where({ id: foilAuditItem.id })
                .update({ expected_quantity: foilAuditItem.expected_quantity + 1 });
        } else {
            // Create new foil audit item
            await trx('audit_items').insert({
                session_id: id,
                name: auditItem.name,
                set_code: auditItem.set_code,
                collector_number: auditItem.collector_number,
                finish: 'foil',
                expected_quantity: 1,
                actual_quantity: 0
            });
        }

        await trx.commit();
        res.json({ success: true });

    } catch (err) {
        await trx.rollback();
        console.error('[audit] swap foil error', err);
        res.status(500).json({ error: 'db error: ' + err.message });
    }
});


// Finalize Audit
router.post('/:id/finalize', authMiddleware, async (req, res) => {
    const trx = await knex.transaction();
    try {
        const { id } = req.params;
        const session = await trx('audit_sessions').where({ id, user_id: req.user.id, status: 'active' }).first();

        if (!session) {
            await trx.rollback();
            return res.status(404).json({ error: 'Active session not found' });
        }

        const items = await trx('audit_items').where({ session_id: id });

        for (const item of items) {
            let diff = item.actual_quantity - item.expected_quantity;
            if (diff === 0) continue;

            if (session.type === 'deck' && session.target_id) {
                if (diff < 0) {
                    // MISSING cards: Remove |diff| cards from Deck -> Binder
                    let toRemove = Math.abs(diff);

                    const deckCards = await trx('user_cards')
                        .where({
                            deck_id: session.target_id,
                            name: item.name,
                            set_code: item.set_code,
                            collector_number: item.collector_number,
                            finish: item.finish
                        })
                        .orderBy('count', 'asc'); // Use smaller stacks first? Or just any.

                    for (const card of deckCards) {
                        if (toRemove <= 0) break;

                        if (card.count <= toRemove) {
                            // Move entire stack
                            await trx('user_cards').where({ id: card.id }).update({ deck_id: null });
                            toRemove -= card.count;
                        } else {
                            // Split stack
                            // 1. Decrement existing
                            await trx('user_cards').where({ id: card.id }).update({ count: card.count - toRemove });

                            // 2. Create new stack in binder
                            const { id: _id, created_at: _c, updated_at: _u, ...cardData } = card;
                            await trx('user_cards').insert({
                                ...cardData,
                                count: toRemove,
                                deck_id: null
                            });
                            toRemove = 0;
                        }
                    }
                } else if (diff > 0) {
                    // EXTRA cards: Add |diff| cards Binder -> Deck
                    let toAdd = diff;

                    const binderCards = await trx('user_cards')
                        .where({
                            deck_id: null,
                            user_id: req.user.id,
                            name: item.name,
                            set_code: item.set_code,
                            collector_number: item.collector_number,
                            finish: item.finish
                        });

                    // 1. Try to consume from binder
                    for (const card of binderCards) {
                        if (toAdd <= 0) break;

                        if (card.count <= toAdd) {
                            // Move entire stack
                            await trx('user_cards').where({ id: card.id }).update({ deck_id: session.target_id });
                            toAdd -= card.count;
                        } else {
                            // Split stack
                            await trx('user_cards').where({ id: card.id }).update({ count: card.count - toAdd });
                            const { id: _id, created_at: _c, updated_at: _u, ...cardData } = card;
                            await trx('user_cards').insert({
                                ...cardData,
                                count: toAdd,
                                deck_id: session.target_id
                            });
                            toAdd = 0;
                        }
                    }

                    // 2. If still need more, create new cards (User found them in the deck physically)
                    if (toAdd > 0) {
                        // Need basic card data structure. 
                        // We can grab it from one of the binder cards we found, OR query 'cards' table?
                        // Or just use the audit_item data + defaults if we can't find a template.
                        // Best effort: Use the first binder card as template if available, else query DB?
                        // If no binder card, we might be missing scryfall_id etc.
                        // We should query the 'cards' table using set/number to get the scryfall_id and other metadata.

                        const meta = await trx('cards')
                            .whereRaw('lower(setcode) = ?', [item.set_code.toLowerCase()])
                            .where({ number: item.collector_number })
                            .first();

                        if (meta) {
                            const newCardData = {
                                user_id: req.user.id,
                                name: item.name,
                                set_code: item.set_code,
                                collector_number: item.collector_number,
                                finish: item.finish,
                                deck_id: session.target_id,
                                count: toAdd,
                                scryfall_id: meta.id, // Important for linking
                                mana_cost: meta.data?.mana_cost,
                                cmc: meta.data?.cmc,
                                type_line: meta.data?.type_line,
                                colors: meta.data?.colors,
                                color_identity: meta.data?.color_identity,
                                rarity: meta.data?.rarity,
                                image_uri: meta.data?.image_uris?.normal || meta.data?.image_uris?.large
                            };
                            await trx('user_cards').insert(newCardData);
                        } else {
                            // Fallback (Blind insert? Might fail constraints if not nullable)
                            // Skip for safety to avoid crashing the whole finalize?
                            console.warn(`Could not create new card for ${item.name} - Metadata not found`);
                        }
                    }
                }
            }
        }

        await trx('audit_sessions').where({ id }).update({ status: 'completed', ended_at: trx.fn.now() });
        await trx.commit();
        res.json({ success: true });

    } catch (err) {
        await trx.rollback();
        console.error('[audit] finalize error', err);
    }
});

// Get Audit Stats (Grouped)
router.get('/:id/stats', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const session = await knex('audit_sessions').where({ id, user_id: req.user.id }).first();
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const { items, deckMap } = await (async () => {
            // Fetch items with Card Data for robust grouping
            const rawItems = await knex('audit_items')
                .leftJoin(
                    knex('cards').distinctOn(knex.raw('lower(setcode)'), 'number').select('setcode', 'number', 'data').as('cards'),
                    function () {
                        this.on(knex.raw('lower("audit_items"."set_code")'), '=', knex.raw('lower("cards"."setcode")'))
                            .andOn('audit_items.collector_number', '=', 'cards.number')
                    }
                )
                .select(
                    'audit_items.*',
                    knex.raw("COALESCE(cards.data, '{}'::jsonb) as card_data")
                )
                .where({ session_id: id });

            const deckIds = [...new Set(rawItems.map(i => i.deck_id).filter(Boolean))];
            const deckList = await knex('user_decks')
                .whereIn('id', deckIds)
                .select('id', 'name', 'commander');

            const dMap = deckList.reduce((acc, d) => {
                let colors = [];
                if (d.commander && d.commander.color_identity) colors = d.commander.color_identity;
                else if (d.commander && d.commander.colors) colors = d.commander.colors;
                return { ...acc, [d.id]: { name: d.name, colors } };
            }, {});

            return { items: rawItems, deckMap: dMap };
        })();

        // 1. Deck Stats
        const deckStats = {};

        const stats = {
            total_cards: items.length,
            total_verified: items.filter(i => i.actual_quantity === i.expected_quantity).length,
            total_reviewed: items.filter(i => i.reviewed).length,
            decks: [],
            collection: {
                total: 0,
                verified: 0,
                reviewed: 0,
                groups: {}
            },
            mismatches: []
        };

        const { groupBy } = req.query; // 'set', 'type', 'rarity', 'color'

        // Helper to get group key based on user preference
        const getGroupKey = (item) => {
            const data = item.card_data || {};

            if (groupBy === 'type') {
                const typeLine = (data.type_line || '').toLowerCase();
                if (typeLine.includes('creature')) return 'Creature';
                if (typeLine.includes('instant')) return 'Instant';
                if (typeLine.includes('sorcery')) return 'Sorcery';
                if (typeLine.includes('artifact')) return 'Artifact';
                if (typeLine.includes('enchantment')) return 'Enchantment';
                if (typeLine.includes('planeswalker')) return 'Planeswalker';
                if (typeLine.includes('land')) return 'Land';
                return 'Other';
            }

            if (groupBy === 'rarity') {
                const r = data.rarity || 'unknown';
                return r.charAt(0).toUpperCase() + r.slice(1);
            }

            if (groupBy === 'color') {
                const colors = data.color_identity || [];
                if (colors.length === 0) return 'Colorless';
                if (colors.length > 1) return 'Multicolor';
                const map = { 'W': 'White', 'U': 'Blue', 'B': 'Black', 'R': 'Red', 'G': 'Green' };
                return map[colors[0]] || 'Unknown';
            }

            // Default: 'set'
            return (item.set_code || 'Unknown').toUpperCase();
        };

        for (const item of items) {
            const isVerified = item.actual_quantity === item.expected_quantity;

            // Only mismatch if it has been reviewed and doesn't match
            if (item.reviewed && !isVerified) {
                stats.mismatches.push({
                    id: item.id,
                    name: item.name,
                    set_code: item.set_code,
                    collector_number: item.collector_number,
                    finish: item.finish,
                    expected: item.expected_quantity,
                    actual: item.actual_quantity,
                    deck_id: item.deck_id,
                    deck_name: item.deck_id && deckMap[item.deck_id] ? deckMap[item.deck_id].name : null
                });
            }

            if (item.deck_id) {
                if (!deckStats[item.deck_id]) {
                    const dInfo = deckMap[item.deck_id] || {};
                    deckStats[item.deck_id] = {
                        id: item.deck_id,
                        name: dInfo.name || 'Unknown Deck',
                        colors: dInfo.colors || [],
                        total: 0,
                        verified: 0,
                        reviewed: 0,
                    };
                }
                deckStats[item.deck_id].total++;
                if (isVerified) deckStats[item.deck_id].verified++;
                if (item.reviewed) deckStats[item.deck_id].reviewed++;
            } else {
                // Loose Collection
                stats.collection.total++;
                if (isVerified) stats.collection.verified++;
                if (item.reviewed) stats.collection.reviewed++;

                const key = getGroupKey(item);
                if (!stats.collection.groups[key]) {
                    stats.collection.groups[key] = { name: key, total: 0, verified: 0, reviewed: 0 };
                }
                stats.collection.groups[key].total++;
                if (isVerified) stats.collection.groups[key].verified++;
                if (item.reviewed) stats.collection.groups[key].reviewed++;
            }
        }

        stats.decks = Object.values(deckStats);
        stats.collection.groups = Object.values(stats.collection.groups);

        res.json(stats);
    } catch (err) {
        console.error('[audit] stats error', err);
        res.status(500).json({ error: 'db error: ' + err.message });
    }
});

// Mark Section as Reviewed
router.post('/:id/section/review', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { deckId, group } = req.body;

        const query = knex('audit_items').where({ session_id: id });

        if (deckId) {
            query.where({ deck_id: deckId });
        } else if (group) {
            // "group" is currently set_code for loose cards
            query.whereNull('deck_id').andWhere({ set_code: group });
        } else {
            return res.status(400).json({ error: 'Missing section (deckId or group)' });
        }

        await query.update({ reviewed: true });
        res.json({ success: true });
    } catch (err) {
        console.error('[audit] section review error', err);
        res.status(500).json({ error: 'db error: ' + err.message });
    }
});

// Cancel Audit
router.post('/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await knex('audit_sessions')
            .where({ id, user_id: req.user.id })
            .del(); // Delete instead of update status as requested

        res.json({ success: true });
    } catch (err) {
        console.error('[audit] cancel error', err);
        res.status(500).json({ error: 'db error' });
    }
});

export default router;
