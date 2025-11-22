const express = require('express');
const router = express.Router();
const { knex } = require('../db');

// List decks (optionally filter by user_id)
router.get('/', async (req, res) => {
  try {
    const q = knex('decks').select('*').limit(200);
    if (req.query.user_id) q.where({ user_id: req.query.user_id });
    const rows = await q;
    res.json(rows);
  } catch (err) {
    console.error('[decks] list error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Get deck by id, include deck_cards and card rows
router.get('/:id', async (req, res) => {
  try {
    const deck = await knex('decks').where({ id: req.params.id }).first();
    if (!deck) return res.status(404).json({ error: 'not found' });
    const items = await knex('deck_cards')
      .where({ deck_id: deck.id })
      .join('cards', 'deck_cards.card_id', 'cards.id')
      .select('deck_cards.*', 'cards.data as card_data', 'cards.name as card_name', 'cards.id as card_id');
    res.json({ deck, items });
  } catch (err) {
    console.error('[decks] get error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Create a deck
router.post('/', async (req, res) => {
  try {
    const [row] = await knex('decks').insert(req.body).returning('*');
    res.status(201).json(row);
  } catch (err) {
    console.error('[decks] create error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Update deck
router.put('/:id', async (req, res) => {
  try {
    const [row] = await knex('decks').where({ id: req.params.id }).update(req.body).returning('*');
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (err) {
    console.error('[decks] update error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Delete deck (cascade deck_cards via FK)
router.delete('/:id', async (req, res) => {
  try {
    await knex('decks').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (err) {
    console.error('[decks] delete error', err);
    res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
