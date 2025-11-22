const express = require('express');
const router = express.Router();
const { knex } = require('../db');
const auth = require('../middleware/auth');

// List users (admin use) - protected
router.get('/', auth, async (req, res) => {
  try {
    const rows = await knex('users').select('id','firestore_id','email','data').limit(200);
    res.json(rows);
  } catch (err) {
    console.error('[users] list error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

// Get user by id (protected)
router.get('/:id', auth, async (req, res) => {
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
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.id !== parseInt(req.params.id, 10)) return res.status(403).json({ error: 'not allowed' });
    const [row] = await knex('users').where({ id: req.params.id }).update(req.body).returning('*');
    res.json(row);
  } catch (err) {
    console.error('[users] update error', err);
    res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
