import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const verifyToken = authMiddleware;

const requireAdmin = (req, res, next) => {
    const adminUser = req.user;
    if (!adminUser) return res.status(401).json({ error: 'Unauthorized' });
    const isRoot = adminUser.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
    if (!isRoot && !adminUser.settings?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
};
const router = express.Router();

// GET /api/personas
// Public endpoint to fetch all active personas
router.get('/', async (req, res) => {
    try {
        const personas = await knex('ai_personas')
            .where({ is_active: true })
            .orderBy('price_usd', 'asc')
            .orderBy('name', 'asc');

        res.json(personas);
    } catch (err) {
        console.error('Error fetching personas:', err);
        res.status(500).json({ error: 'Failed to fetch active personas' });
    }
});

// GET /api/admin/personas
// Admin endpoint to fetch ALL personas (including inactive)
router.get('/admin', verifyToken, requireAdmin, async (req, res) => {
    try {
        const personas = await knex('ai_personas')
            .orderBy('created_at', 'desc');
        res.json(personas);
    } catch (err) {
        console.error('Error fetching admin personas:', err);
        res.status(500).json({ error: 'Failed to fetch personas' });
    }
});

// POST /api/admin/personas
// Admin endpoint to create a new persona
router.post('/admin', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { name, type, personality, price_usd, avatar_url, is_active, sample_responses } = req.body;

        if (!name || !type || !personality) {
            return res.status(400).json({ error: 'Name, type, and personality are required' });
        }

        const [newPersona] = await knex('ai_personas')
            .insert({
                name,
                type,
                personality,
                price_usd: price_usd || 0.00,
                avatar_url: avatar_url || null,
                is_active: is_active ?? true,
                sample_responses: sample_responses ? JSON.stringify(sample_responses) : null
            })
            .returning('*');

        res.status(201).json(newPersona);
    } catch (err) {
        console.error('Error creating persona:', err);
        res.status(500).json({ error: 'Failed to create persona' });
    }
});

// PUT /api/admin/personas/:id
// Admin endpoint to update an existing persona
router.put('/admin/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, personality, price_usd, avatar_url, is_active, sample_responses } = req.body;

        const [updatedPersona] = await knex('ai_personas')
            .where({ id })
            .update({
                name,
                type,
                personality,
                price_usd,
                avatar_url,
                is_active,
                sample_responses: sample_responses ? JSON.stringify(sample_responses) : null
            })
            .returning('*');

        if (!updatedPersona) {
            return res.status(404).json({ error: 'Persona not found' });
        }

        res.json(updatedPersona);
    } catch (err) {
        console.error('Error updating persona:', err);
        res.status(500).json({ error: 'Failed to update persona' });
    }
});

// DELETE /api/admin/personas/:id
// Admin endpoint to hard delete a persona (prefer soft delete via is_active = false)
router.delete('/admin/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCount = await knex('ai_personas')
            .where({ id })
            .del();

        if (deletedCount === 0) {
            return res.status(404).json({ error: 'Persona not found' });
        }

        res.json({ success: true, message: 'Persona deleted' });
    } catch (err) {
        console.error('Error deleting persona:', err);
        res.status(500).json({ error: 'Failed to delete persona' });
    }
});

export default router;
