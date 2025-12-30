import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// List users (admin use) - protected
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await knex('users').select('id', 'firestore_id', 'email', 'data').limit(200);
    res.json(rows);
  } catch (err) {
    console.error('[users] list error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  res.json(req.user);
});

// Get user by id (protected)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const r = await knex('users').where({ id: req.params.id }).first();
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  } catch (err) {
    console.error('[users] get error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Update user (protected, user can update their own row)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (req.user.id !== userId) return res.status(403).json({ error: 'not allowed' });

    if (req.body.settings) {
      console.log(`[users] Updating settings for user ${userId}:`, JSON.stringify(req.body.settings));
    }

    const result = await knex('users')
      .where({ id: userId })
      .update(req.body)
      .returning('*');

    const row = Array.isArray(result) ? result[0] : result;
    if (!row) return res.status(404).json({ error: 'User not found after update' });

    res.json(row);
  } catch (err) {
    console.error('[users] update error', err);
    res.status(500).json({ error: 'db error' });
  }
});

export default router;
