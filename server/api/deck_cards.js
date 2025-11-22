const express = require('express');
const router = express.Router();
const { knex } = require('../db');

// Add a card to a deck
router.post('/', async (req, res) => {
  // expected body: { deck_id, card_id, count }
  try {
    const [row] = await knex('deck_cards').insert(req.body).returning('*');
    res.status(201).json(row);
  } catch (err) {
    console.error('[deck_cards] create error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Update count
router.put('/:id', async (req, res) => {
  try {
    const [row] = await knex('deck_cards').where({ id: req.params.id }).update(req.body).returning('*');
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (err) {
    console.error('[deck_cards] update error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Remove card from deck
router.delete('/:id', async (req, res) => {
  try {
    await knex('deck_cards').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (err) {
    console.error('[deck_cards] delete error', err);
    res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
