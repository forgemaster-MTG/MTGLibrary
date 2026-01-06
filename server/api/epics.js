import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// List all Epics
router.get('/', async (req, res) => {
    try {
        const rows = await knex('epics')
            .select('epics.*', knex.raw('count(tickets.id) as ticket_count'))
            .leftJoin('tickets', 'epics.id', 'tickets.epic_id')
            .groupBy('epics.id')
            .orderBy('priority_order', 'asc')
            .orderBy('created_at', 'desc');
        res.json(rows);
    } catch (err) {
        console.error('[epics] list error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// DEBUG: Check user
router.get('/me', authMiddleware, (req, res) => {
    res.json({
        id: req.user.id,
        firestore_id: req.user.firestore_id,
        settings: req.user.settings,
        isRoot: req.user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3'
    });
});

// Create Epic (Admin/Manager only - simplistic check for now)
router.post('/', authMiddleware, async (req, res) => {
    try {
        // Permission check: either root, admin, or has 'manage_tickets' permission
        console.log('[DEBUG] Epic Auth Check:', {
            id: req.user.id,
            firestore_id: req.user.firestore_id,
            isAdmin: req.user.settings?.isAdmin,
            permissions: req.user.settings?.permissions
        });
        const isRoot = req.user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
        const isAdmin = isRoot || req.user.settings?.isAdmin || req.user.settings?.permissions?.includes('manage_tickets');
        if (!isAdmin) return res.status(403).json({ error: 'Not authorized' });

        const { title, description, status } = req.body;
        const [epic] = await knex('epics').insert({
            title,
            description,
            status: status || 'active',
            created_by: req.user.id,
            priority_order: 0 // Default to top or bottom? Can handle reorder later.
        }).returning('*');

        res.status(201).json(epic);
    } catch (err) {
        console.error('[epics] create error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Update Epic
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const isRoot = req.user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
        const isAdmin = isRoot || req.user.settings?.isAdmin || req.user.settings?.permissions?.includes('manage_tickets');
        if (!isAdmin) return res.status(403).json({ error: 'Not authorized' });

        const { title, description, status, priority_order } = req.body;
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;
        if (priority_order !== undefined) updateData.priority_order = priority_order;

        const [epic] = await knex('epics')
            .where({ id: req.params.id })
            .update(updateData)
            .returning('*');

        if (!epic) return res.status(404).json({ error: 'Not found' });
        res.json(epic);
    } catch (err) {
        console.error('[epics] update error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Reorder Epics (Batch update)
router.put('/reorder/batch', authMiddleware, async (req, res) => {
    try {
        const isRoot = req.user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
        const isAdmin = isRoot || req.user.settings?.isAdmin || req.user.settings?.permissions?.includes('manage_tickets');
        if (!isAdmin) return res.status(403).json({ error: 'Not authorized' });

        const { order } = req.body; // Array of { id, priority_order }
        if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid data' });

        await knex.transaction(async trx => {
            const queries = order.map(({ id, priority_order }) =>
                knex('epics')
                    .where({ id })
                    .update({ priority_order })
                    .transacting(trx)
            );
            await Promise.all(queries);
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[epics] reorder error', err);
        res.status(500).json({ error: 'db error' });
    }
});

export default router;
