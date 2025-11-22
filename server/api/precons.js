const express = require('express');
const router = express.Router();
const { knex } = require('../db');

// List precons
router.get('/', async (req, res) => {
  try {
    const rows = await knex('precons').select('id','firestore_id','name','data').limit(200);
    res.json(rows);
  } catch (err) {
    console.error('[precons] list error', err);
    res.status(500).json({ error: 'db error' });
  }
});

router.get('/:firestoreId', async (req, res) => {
  try {
    const r = await knex('precons').where({ firestore_id: req.params.firestoreId }).first();
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  } catch (err) {
    console.error('[precons] get error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Create/Upsert by firestore_id
router.post('/', async (req, res) => {
  try {
    const { firestore_id } = req.body;
    if (!firestore_id) {
      const [row] = await knex('precons').insert(req.body).returning('*');
      return res.status(201).json(row);
    }
    await knex('precons').insert(req.body).onConflict('firestore_id').merge();
    const r = await knex('precons').where({ firestore_id }).first();
    res.status(201).json(r);
  } catch (err) {
    console.error('[precons] create error', err);
    res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
