import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';
import { applyRules } from '../services/ruleEngine.js';

const router = express.Router();

router.use(authMiddleware);

// Get User's Binders
router.get('/', async (req, res) => {
    try {
        const rows = await knex('binders')
            .where({ user_id: req.user.id })
            .orderBy('created_at', 'desc');
        res.json(rows);
    } catch (err) {
        console.error('[binders] list error', err);
        res.status(500).json({ error: 'Failed to fetch binders' });
    }
});

// Get Cards for a specific binder (executes rules if present)
router.get('/:id/cards', async (req, res) => {
    try {
        const binder = await knex('binders')
            .where({ id: req.params.id, user_id: req.user.id })
            .first();

        if (!binder) return res.status(404).json({ error: 'Binder not found' });

        // Base query
        const q = knex('user_cards')
            .join('users', 'user_cards.user_id', 'users.id')
            .where('user_cards.user_id', req.user.id)
            .select('user_cards.*', 'users.username as owner_username', 'users.id as owner_id');

        // Apply Logic: 
        // 1. If it's a "Smart Binder" (has rules), ignore direct binder_id and use rules
        if (binder.rules && Array.isArray(binder.rules) && binder.rules.length > 0) {
            applyRules(q, binder.rules);
        } else {
            // 2. Otherwise use the traditional binder_id association
            q.where({ 'user_cards.binder_id': binder.id });
        }

        const rows = await q.orderBy('user_cards.added_at', 'desc');
        res.json(rows);
    } catch (err) {
        console.error('[binders] fetch cards error', err);
        res.status(500).json({ error: 'Failed to fetch cards' });
    }
});

// Create Binder
router.post('/', async (req, res) => {
    const { name, type, icon_type, icon_value, color_preference, rules } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const [row] = await knex('binders').insert({
            user_id: req.user.id,
            name,
            type: type || 'collection',
            icon_type: icon_type || 'emoji',
            icon_value: icon_value || '📁',
            color_preference: color_preference || 'blue',
            rules: rules ? JSON.stringify(rules) : null
        }).returning('*');

        res.status(201).json(row);
    } catch (err) {
        console.error('[binders] create error', err);
        res.status(500).json({ error: 'Failed to create binder' });
    }
});

// Update Binder
router.put('/:id', async (req, res) => {
    const { name, type, icon_type, icon_value, color_preference, rules } = req.body;

    try {
        const existing = await knex('binders').where({ id: req.params.id }).first();
        if (!existing) return res.status(404).json({ error: 'not found' });

        console.log('[binders] Authorizing update:', {
            binderId: req.params.id,
            binderUserId: existing.user_id,
            sessionUserId: req.user.id
        });

        if (String(existing.user_id) !== String(req.user.id)) return res.status(403).json({ error: 'unauthorized' });

        const update = {};
        if (name !== undefined) update.name = name;
        if (type !== undefined) update.type = type;
        if (icon_type !== undefined) update.icon_type = icon_type;
        if (icon_value !== undefined) update.icon_value = icon_value;
        if (color_preference !== undefined) update.color_preference = color_preference;
        if (rules !== undefined) update.rules = rules ? JSON.stringify(rules) : null;

        const [row] = await knex('binders')
            .where({ id: req.params.id })
            .update(update)
            .returning('*');

        res.json(row);
    } catch (err) {
        console.error('[binders] update error', err);
        res.status(500).json({ error: 'Failed to update binder' });
    }
});

// Delete Binder
router.delete('/:id', async (req, res) => {
    try {
        const existing = await knex('binders').where({ id: req.params.id }).first();
        if (!existing) return res.status(404).json({ error: 'not found' });

        console.log('[binders] Authorizing delete:', {
            binderId: req.params.id,
            binderUserId: existing.user_id,
            binderUserIdType: typeof existing.user_id,
            sessionUserId: req.user.id,
            sessionUserIdType: typeof req.user.id
        });

        if (String(existing.user_id) !== String(req.user.id)) return res.status(403).json({ error: 'unauthorized' });

        await knex('binders').where({ id: req.params.id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error('[binders] delete error', err);
        res.status(500).json({ error: 'Failed to delete binder' });
    }
});

export default router;
