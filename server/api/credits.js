import express from 'express';
import { knex } from '../db.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

/**
 * GET /api/credits/history
 * Returns paginated credit logs for the authenticated user.
 */
router.get('/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        const offset = (page - 1) * limit;

        const userId = req.user.id;

        const [countResult] = await knex('public.user_credit_logs')
            .where({ user_id: userId })
            .count('* as total');

        const total = parseInt(countResult.total, 10);

        const logs = await knex('public.user_credit_logs')
            .where({ user_id: userId })
            .orderBy('created_at', 'desc') // Newest first
            .limit(limit)
            .offset(offset);

        res.json({
            data: logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error('[Credits API] History error:', err);
        res.status(500).json({ error: 'Failed to fetch credit history' });
    }
});

export default router;
