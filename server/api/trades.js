import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Get Trades for Current User
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const trades = await knex('trades')
            .where('initiator_id', userId)
            .orWhere('receiver_id', userId)
            .orderBy('updated_at', 'desc');

        // Enrich with user names
        const userIds = new Set();
        trades.forEach(t => {
            if (t.initiator_id) userIds.add(t.initiator_id);
            if (t.receiver_id) userIds.add(t.receiver_id);
        });

        const users = await knex('users').whereIn('id', Array.from(userIds)).select('id', 'username');
        const userMap = Object.fromEntries(users.map(u => [u.id, u.username]));

        const enriched = trades.map(t => ({
            ...t,
            initiator_name: userMap[t.initiator_id],
            receiver_name: userMap[t.receiver_id],
            is_initiator: t.initiator_id === userId
        }));

        res.json(enriched);
    } catch (err) {
        console.error('[Trades] List error:', err);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

// Create New Trade
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { receiver_id, notes, items } = req.body;
        const initiator_id = req.user.id;

        if (!receiver_id) return res.status(400).json({ error: 'Receiver required' });

        await knex.transaction(async (trx) => {
            // 1. Create Trade
            const [trade] = await trx('trades').insert({
                initiator_id,
                receiver_id,
                notes,
                status: 'pending'
            }).returning('*');

            // 2. Add Initial Items
            if (items && items.length > 0) {
                const tradeItems = items.map(item => ({
                    trade_id: trade.id,
                    user_id: initiator_id, // Assuming initial items are from initiator
                    item_type: item.item_type || 'card',
                    item_id: item.item_id,
                    quantity: item.quantity || 1,
                    amount: item.amount,
                    details: item.details
                }));
                await trx('trade_items').insert(tradeItems);
            }

            res.status(201).json(trade);
        });
    } catch (err) {
        console.error('[Trades] Create error:', err);
        res.status(500).json({ error: 'Failed to create trade' });
    }
});

// Get Trade Details
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const tradeId = req.params.id;
        const userId = req.user.id;

        const trade = await knex('trades').where({ id: tradeId }).first();
        if (!trade) return res.status(404).json({ error: 'Trade not found' });

        // Auth check
        if (trade.initiator_id !== userId && trade.receiver_id !== userId && !req.user.settings?.isAdmin) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const items = await knex('trade_items').where({ trade_id: tradeId });
        const messages = await knex('trade_messages')
            .join('users', 'trade_messages.user_id', 'users.id')
            .where({ trade_id: tradeId })
            .select('trade_messages.*', 'users.username')
            .orderBy('created_at', 'asc');

        const users = await knex('users')
            .whereIn('id', [trade.initiator_id, trade.receiver_id].filter(Boolean))
            .select('id', 'username', 'data');

        res.json({ trade, items, messages, users });
    } catch (err) {
        console.error('[Trades] Get Details error:', err);
        res.status(500).json({ error: 'Failed to fetch trade details' });
    }
});

// Update Status
router.put('/:id/status', authMiddleware, async (req, res) => {
    try {
        const tradeId = req.params.id;
        const { status } = req.body;
        const userId = req.user.id;

        await knex.transaction(async (trx) => {
            const trade = await trx('trades').where({ id: tradeId }).first();
            if (!trade) throw new Error('Trade not found');

            // Logic validation
            // Logic validation
            if (status === 'cancelled') {
                if (trade.initiator_id !== userId && trade.receiver_id !== userId) throw new Error('Not authorized');
            } else if (status === 'rejected') {
                if (trade.receiver_id !== userId) throw new Error('Only receiver can reject');
            } else {
                throw new Error('Invalid status update. Use toggle_accept or complete.');
            }

            // Execute Trade if Accepted
            if (status === 'accepted') {
                const items = await trx('trade_items').where({ trade_id: tradeId });

                for (const item of items) {
                    if (item.item_type === 'card' && item.item_id) {
                        const senderId = item.user_id;
                        const receiverId = (senderId === trade.initiator_id) ? trade.receiver_id : trade.initiator_id;

                        // 1. Get Sender's Card
                        const senderCard = await trx('user_cards')
                            .where({ id: item.item_id, user_id: senderId })
                            .first();

                        if (!senderCard) {
                            throw new Error(`Item ${item.details?.name || 'Unknown'} unavailable (ID: ${item.item_id})`);
                        }

                        // 2. Reduce/Remove Sender's Card
                        if (senderCard.count > item.quantity) {
                            await trx('user_cards')
                                .where({ id: senderCard.id })
                                .decrement('count', item.quantity);
                        } else {
                            await trx('user_cards')
                                .where({ id: senderCard.id })
                                .del();
                        }

                        // 3. Add to Receiver
                        // Check if receiver already has this card (same print) to merge
                        const existingReceiverCard = await trx('user_cards')
                            .where({
                                user_id: receiverId,
                                scryfall_id: senderCard.scryfall_id,
                                finish: senderCard.finish,
                                deck_id: null,
                                binder_id: null
                            })
                            .first();

                        if (existingReceiverCard) {
                            await trx('user_cards')
                                .where({ id: existingReceiverCard.id })
                                .increment('count', item.quantity);
                        } else {
                            // Insert new
                            await trx('user_cards').insert({
                                user_id: receiverId,
                                scryfall_id: senderCard.scryfall_id,
                                name: senderCard.name,
                                set_code: senderCard.set_code,
                                collector_number: senderCard.collector_number,
                                finish: senderCard.finish,
                                image_uri: senderCard.image_uri,
                                count: item.quantity,
                                data: senderCard.data,
                                deck_id: null, // Reset deck
                                binder_id: null, // Reset binder
                                is_wishlist: false,
                                price_bought: null, // Reset price info
                                added_at: knex.fn.now()
                            });
                        }
                    }
                }
            }

            await trx('trades').where({ id: tradeId }).update({ status, updated_at: knex.fn.now() });

            // If accepted/rejected/cancelled, maybe add a system message?
            await trx('trade_messages').insert({
                trade_id: tradeId,
                user_id: userId,
                content: `Changed status to ${status.toUpperCase()}`
            });
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[Trades] Status update error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Toggle Acceptance
router.post('/:id/toggle_accept', authMiddleware, async (req, res) => {
    try {
        const tradeId = req.params.id;
        const userId = req.user.id;

        await knex.transaction(async (trx) => {
            const trade = await trx('trades').where({ id: tradeId }).first();
            if (!trade) throw new Error('Trade not found');
            if (trade.status !== 'pending' && trade.status !== 'accepted') throw new Error('Trade is already finalized');

            const isInitiator = trade.initiator_id === userId;
            const isReceiver = trade.receiver_id === userId;

            if (!isInitiator && !isReceiver) throw new Error('Not authorized');

            const update = {};
            // If currently accepted, any toggle will revert status to pending
            if (trade.status === 'accepted') {
                update.status = 'pending';
            }

            if (isInitiator) update.initiator_accepted = !trade.initiator_accepted;
            if (isReceiver) update.receiver_accepted = !trade.receiver_accepted;

            // Check if BOTH are now accepted (only relevant if we were pending)
            const initAcc = isInitiator ? update.initiator_accepted : trade.initiator_accepted;
            const recvAcc = isReceiver ? update.receiver_accepted : trade.receiver_accepted;

            // If we are pending and both accept, move to accepted
            // If we were accepted and someone toggled off, we move to pending (handled above)
            if (trade.status === 'pending' && initAcc && recvAcc) {
                update.status = 'accepted';
                await trx('trade_messages').insert({
                    trade_id: tradeId,
                    user_id: userId,
                    content: 'Trade AGREED! Waiting for finalization.'
                });
            } else if (trade.status === 'accepted' && (!initAcc || !recvAcc)) {
                update.status = 'pending';
                await trx('trade_messages').insert({
                    trade_id: tradeId,
                    user_id: userId,
                    content: 'Revoked acceptance. Trade is pending again.'
                });
            }

            await trx('trades').where({ id: tradeId }).update({ ...update, updated_at: knex.fn.now() });
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[Trades] Toggle Accept error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Complete Trade (Execute Transfer)
router.post('/:id/complete', authMiddleware, async (req, res) => {
    try {
        const tradeId = req.params.id;
        const userId = req.user.id;

        await knex.transaction(async (trx) => {
            const trade = await trx('trades').where({ id: tradeId }).first();
            if (!trade) throw new Error('Trade not found');
            if (trade.status !== 'accepted') throw new Error('Trade must be accepted by both parties first');
            if (trade.initiator_id !== userId && trade.receiver_id !== userId) throw new Error('Not authorized');

            const items = await trx('trade_items').where({ trade_id: tradeId });

            // Group items by user and item_id to handle duplicates/split stacks
            const groupedItems = items.reduce((acc, item) => {
                const key = `${item.user_id}-${item.item_type}-${item.item_id}`;
                if (!acc[key]) {
                    acc[key] = { ...item, quantity: 0 };
                }
                acc[key].quantity += item.quantity;
                return acc;
            }, {});

            for (const item of Object.values(groupedItems)) {
                if (item.item_type === 'card' && item.item_id) {
                    const senderId = item.user_id;
                    const receiverId = (senderId === trade.initiator_id) ? trade.receiver_id : trade.initiator_id;

                    const senderCard = await trx('user_cards')
                        .where({ id: item.item_id, user_id: senderId })
                        .first();

                    if (!senderCard) {
                        throw new Error(`Item ${item.details?.name || 'Unknown'} unavailable (ID: ${item.item_id})`);
                    }

                    if (senderCard.count > item.quantity) {
                        await trx('user_cards')
                            .where({ id: senderCard.id })
                            .decrement('count', item.quantity);
                    } else if (senderCard.count === item.quantity) {
                        await trx('user_cards')
                            .where({ id: senderCard.id })
                            .del();
                    } else {
                        throw new Error(`Not enough copies of ${item.details?.name || 'Item'} (Have: ${senderCard.count}, Need: ${item.quantity})`);
                    }

                    const existingReceiverCard = await trx('user_cards')
                        .where({
                            user_id: receiverId,
                            scryfall_id: senderCard.scryfall_id,
                            finish: senderCard.finish,
                            deck_id: null,
                            binder_id: null
                        })
                        .first();

                    if (existingReceiverCard) {
                        await trx('user_cards')
                            .where({ id: existingReceiverCard.id })
                            .increment('count', item.quantity);
                    } else {
                        await trx('user_cards').insert({
                            user_id: receiverId,
                            scryfall_id: senderCard.scryfall_id,
                            name: senderCard.name,
                            set_code: senderCard.set_code,
                            collector_number: senderCard.collector_number,
                            finish: senderCard.finish,
                            image_uri: senderCard.image_uri,
                            count: item.quantity,
                            data: senderCard.data,
                            deck_id: null,
                            binder_id: null,
                            is_wishlist: false,
                            price_bought: null,
                            added_at: knex.fn.now()
                        });
                    }
                }
            }

            await trx('trades').where({ id: tradeId }).update({ status: 'completed', updated_at: knex.fn.now() });

            await trx('trade_messages').insert({
                trade_id: tradeId,
                user_id: userId,
                content: 'Trade COMPLETED!'
            });
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[Trades] Complete error:', err);
        res.status(400).json({ error: err.message });
    }
});

// Add Message
router.post('/:id/messages', authMiddleware, async (req, res) => {
    try {
        const tradeId = req.params.id;
        const { content } = req.body;
        const userId = req.user.id;

        await knex('trade_messages').insert({
            trade_id: tradeId,
            user_id: userId,
            content
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[Trades] Message error:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Update/Add Items
router.post('/:id/items', authMiddleware, async (req, res) => {
    try {
        const tradeId = req.params.id;
        const { items } = req.body; // Array of items
        const userId = req.user.id;

        const trade = await knex('trades').where({ id: tradeId }).first();
        if (trade.status !== 'pending' && trade.status !== 'accepted') return res.status(400).json({ error: 'Cannot modify finalized trade' });

        // If accepted, revert to pending
        const update = {};
        if (trade.status === 'accepted') update.status = 'pending';
        update.initiator_accepted = false;
        update.receiver_accepted = false;
        update.updated_at = knex.fn.now();

        await knex('trades').where({ id: tradeId }).update(update);

        // Security: Ensure we only add items for initiator or receiver
        const allowedUserIds = [trade.initiator_id, trade.receiver_id];

        const tradeItems = items.map(item => {
            const itemOwnerId = item.user_id || userId;
            if (!allowedUserIds.includes(itemOwnerId)) {
                throw new Error(`Invalid item owner: ${itemOwnerId}`);
            }

            return {
                trade_id: tradeId,
                user_id: itemOwnerId,
                item_type: item.item_type || 'card',
                item_id: item.item_id,
                quantity: item.quantity || 1,
                amount: item.amount,
                details: item.details
            };
        });

        await knex('trade_items').insert(tradeItems);
        res.json({ success: true });
    } catch (err) {
        console.error('[Trades] Add Item error:', err);
        res.status(500).json({ error: 'Failed to add items' });
    }
});

// Remove Item
router.delete('/:id/items/:itemId', authMiddleware, async (req, res) => {
    try {
        const { id: tradeId, itemId } = req.params;
        const userId = req.user.id;

        const trade = await knex('trades').where({ id: tradeId }).first();
        if (trade.status !== 'pending' && trade.status !== 'accepted') return res.status(400).json({ error: 'Cannot modify finalized trade' });

        // If accepted, revert to pending
        const update = {};
        if (trade.status === 'accepted') update.status = 'pending';
        update.initiator_accepted = false;
        update.receiver_accepted = false;
        update.updated_at = knex.fn.now();

        await knex('trades').where({ id: tradeId }).update(update);

        const count = await knex('trade_items')
            .where({ id: itemId, trade_id: tradeId, user_id: userId })
            .del();

        if (count === 0) return res.status(404).json({ error: 'Item not found or not owned by you' });

        res.json({ success: true });
    } catch (err) {
        console.error('[Trades] Remove Item error:', err);
        res.status(500).json({ error: 'Failed to remove item' });
    }
});


// Delete Trade
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const tradeId = req.params.id;
        const userId = req.user.id;

        const trade = await knex('trades').where({ id: tradeId }).first();
        if (!trade) return res.status(404).json({ error: 'Trade not found' });

        if (trade.initiator_id !== userId && trade.receiver_id !== userId && !req.user.settings?.isAdmin) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Logic:
        // - Initiator can delete Pending/Cancelled/Rejected/Completed
        // - Receiver can delete Cancelled/Rejected/Completed (but not Pending/Accepted, they must Reject/Cancel instead)

        if (trade.receiver_id === userId && (trade.status === 'pending' || trade.status === 'accepted')) {
            return res.status(400).json({ error: 'Receiver cannot delete an active trade. Please Reject or Cancel it first.' });
        }

        // Delete dependencies first if cascade isn't set up (safest to do manual)
        await knex('trade_items').where({ trade_id: tradeId }).del();
        await knex('trade_messages').where({ trade_id: tradeId }).del();
        await knex('trades').where({ id: tradeId }).del();

        res.json({ success: true });
    } catch (err) {
        console.error('[Trades] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete trade' });
    }
});

export default router;
