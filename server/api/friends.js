import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';
import { sendFriendRequestEmail } from '../services/mailer.js';

const router = express.Router();

// GET /api/friends - List all friends and pending requests
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all friendships where user is involved
        const friendships = await knex('friendships')
            .where(function () {
                this.where('user_id_1', userId).orWhere('user_id_2', userId);
            })
            .select('*');

        // Fetch details for the *other* user in each pair
        const friendIds = friendships.map(f => f.user_id_1 === userId ? f.user_id_2 : f.user_id_1);

        if (friendIds.length === 0) {
            return res.json({ friends: [], pending_sent: [], pending_received: [] });
        }

        const friendDetails = await knex('users')
            .whereIn('id', friendIds)
            .select('id', 'username', 'email', 'lfg_status');

        const friendsMap = friendDetails.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});

        // Categorize
        const response = {
            friends: [],
            pending_sent: [],
            pending_received: []
        };

        friendships.forEach(f => {
            const isSender = f.user_id_1 === userId; // Assuming we enforce sender is always user_1 for 'pending'? 
            // ACTUALLY: The table doesn't track "initiator" explicitly if we just sort IDs.
            // BUT for 'pending', we need to know who asked whom. 
            // Convention: When creating a request, we can assume:
            // - If we use user_id_1 < user_id_2 constraint, we lose "initiator" info.
            // - Better approach: Add `initiator_id` column? OR just use the order logic:
            // Let's UPDATE SCHEMA? No, let's use a simpler logic for now or rely on the fact that we insert [initiator, target].
            // Wait, consistent ordering (id1 < id2) is good for uniqueness, but bad for "who sent it".
            // Let's assume for a Friend Request, uniqueness matters more.
            // But we legitimately need to know if I *sent* it or *received* it.
            // Let's add `action_user_id` to the table? Or just `initiator_id`.

            // Checking table schema... we didn't add initiator_id.
            // We can infer it if we allow non-sorted inserts (initiator is always user_id_1 during insert)?
            // BUT schema has unique(['user_id_1', 'user_id_2']). If I insert (2, 1) does it conflict with (1, 2)?

            // Postgres unique constraint (a,b) differentiates (1,2) from (2,1).
            // So we CAN use (initiator, target) as the standard.
            // AND we should add a unique index for LEAST/GREATEST to prevent dual requests?
            // For now, let's assume `user_id_1` is the INITIATOR.

            const otherId = f.user_id_1 === userId ? f.user_id_2 : f.user_id_1;
            const otherUser = friendsMap[otherId];
            if (!otherUser) return;

            const entry = { ...otherUser, friendship_id: f.id, status: f.status };

            if (f.status === 'accepted') {
                response.friends.push(entry);
            } else if (f.status === 'pending') {
                if (f.user_id_1 === userId) {
                    response.pending_sent.push(entry);
                } else {
                    response.pending_received.push(entry);
                }
            }
        });

        res.json(response);
    } catch (err) {
        console.error('[friends] list error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// GET /api/friends/search?q=username
router.get('/search', authMiddleware, async (req, res) => {
    try {
        const { q } = req.query;
        console.log(`[friends] Searching for: "${q}"`);
        if (!q || q.length < 3) return res.json([]);

        const users = await knex('users')
            .where('username', 'ilike', `%${q}%`)
            .whereNot('id', req.user.id)
            .select('id', 'username', 'email')
            .limit(10);

        // Filter out existing friends? Maybe UI handles it.
        res.json(users);
    } catch (err) {
        console.error('[friends] search error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// POST /api/friends/request
router.post('/request', authMiddleware, async (req, res) => {
    try {
        const { target_id } = req.body;
        const requesterId = req.user.id;

        if (requesterId === target_id) return res.status(400).json({ error: "Cannot add yourself" });

        // Check existing
        const existing = await knex('friendships')
            .where(function () {
                this.where({ user_id_1: requesterId, user_id_2: target_id })
                    .orWhere({ user_id_1: target_id, user_id_2: requesterId });
            })
            .first();

        if (existing) {
            if (existing.status === 'blocked') return res.status(400).json({ error: "Cannot add user" });
            if (existing.status === 'accepted') return res.status(400).json({ error: "Already friends" });
            if (existing.status === 'pending') return res.status(400).json({ error: "Request already pending" });
        }

        // Create Request (initiator is user_id_1)
        await knex('friendships').insert({
            user_id_1: requesterId,
            user_id_2: target_id,
            status: 'pending'
        });

        // Send Email
        const targetUser = await knex('users').where('id', target_id).first();
        if (targetUser && targetUser.email) {
            // Fire and forget email
            sendFriendRequestEmail(targetUser.email, req.user.username || 'A player').catch(console.error);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[friends] request error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// POST /api/friends/respond
router.post('/respond', authMiddleware, async (req, res) => {
    try {
        const { friendship_id, action } = req.body; // action: 'accept' | 'reject' | 'block'
        const userId = req.user.id;

        const friendship = await knex('friendships').where('id', friendship_id).first();
        if (!friendship) return res.status(404).json({ error: 'Not found' });

        // Verify user is the TARGET (user_id_2) or involved
        if (friendship.user_id_2 !== userId && friendship.user_id_1 !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (action === 'accept') {
            // Only target can accept
            if (friendship.user_id_2 !== userId) return res.status(403).json({ error: 'Only recipient can accept' });
            await knex('friendships').where('id', friendship_id).update({ status: 'accepted', updated_at: knex.fn.now() });
        }
        else if (action === 'reject') {
            // Delete the row
            await knex('friendships').where('id', friendship_id).del();
        }
        else if (action === 'block') {
            await knex('friendships').where('id', friendship_id).update({ status: 'blocked', updated_at: knex.fn.now() });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[friends] respond error', err);
        res.status(500).json({ error: 'db error' });
    }
});

export default router;
