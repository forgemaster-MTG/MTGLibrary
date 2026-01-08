import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// GET /releases - Fetch recent releases
router.get('/', async (req, res) => {
    try {
        const releases = await knex('releases')
            .orderBy('released_at', 'desc')
            .limit(10);
        res.json(releases);
    } catch (err) {
        console.error('[releases] fetch error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// POST /releases - Publish a new release (Admin Only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const isRoot = req.user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
        const isAdmin = isRoot || req.user.settings?.isAdmin || req.user.settings?.permissions?.includes('manage_tickets');
        if (!isAdmin) return res.status(403).json({ error: 'Not authorized' });

        const { version, notes, ticketIds, typeStats } = req.body;
        if (!version) return res.status(400).json({ error: 'Version is required' });

        await knex.transaction(async (trx) => {
            // 1. Create Release Record
            const [release] = await trx('releases').insert({
                version,
                notes,
                stats: typeStats || {},
                released_at: trx.fn.now() // Use server time
            }).returning('*');

            // 2. Update Tickets
            // RULE: Only update tickets that contain "complete" (case-insensitive) in their status
            // AND are in the list of ticketIds provided
            if (ticketIds && ticketIds.length > 0) {
                // Fetch valid tickets
                const validIds = await trx('tickets')
                    .whereIn('id', ticketIds)
                    .where((builder) => {
                        // Check for 'completed' or starts with 'complete'
                        // using standard SQL 'like' for broader compatibility if needed, 
                        // though 'ilike' is fine for PG.
                        builder.where('status', 'completed')
                            .orWhere('status', 'like', 'complete%');
                    })
                    .pluck('id');

                if (validIds.length > 0) {
                    await trx('tickets')
                        .whereIn('id', validIds)
                        .update({
                            status: 'released', // The new published status
                            release_id: release.id,
                            date_released: trx.fn.now(),
                            updated_at: trx.fn.now()
                        });
                }
            }

            res.json(release);
        });

    } catch (err) {
        console.error('[releases] create error', err);
        res.status(500).json({ error: 'db error' });
    }
});

export default router;
