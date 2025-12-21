import express from 'express';
import { knex } from '../db.js';

const router = express.Router();

// List identifiers
router.get('/', async (req, res) => {
  try {
    const rows = await knex('cardidentifiers').select('*').limit(200);
    res.json(rows);
  } catch (err) {
    console.error('[cardidentifiers] list error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Get by id
router.get('/:id', async (req, res) => {
  try {
    const r = await knex('cardidentifiers').where({ id: req.params.id }).first();
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  } catch (err) {
    console.error('[cardidentifiers] get error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Create
router.post('/', async (req, res) => {
  try {
    const [row] = await knex('cardidentifiers').insert(req.body).returning('*');
    res.status(201).json(row);
  } catch (err) {
    console.error('[cardidentifiers] create error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const [row] = await knex('cardidentifiers').where({ id: req.params.id }).update(req.body).returning('*');
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (err) {
    console.error('[cardidentifiers] update error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    await knex('cardidentifiers').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (err) {
    console.error('[cardidentifiers] delete error', err);
    res.status(500).json({ error: 'db error' });
  }
});

export default router;
