import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Require authentication for all deck operations
router.use(authMiddleware);

// List decks for logical logged-in user
router.get('/', async (req, res) => {
  try {
    // Return decks owned by the authenticated user
    const rows = await knex('user_decks')
      .where({ user_id: req.user.id })
      .orderBy('updated_at', 'desc')
      .limit(200);
    res.json(rows);
  } catch (err) {
    console.error('[decks] list error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Get deck by id, include cards
router.get('/:id', async (req, res) => {
  try {
    const deck = await knex('user_decks')
      .where({ id: req.params.id })
      .first();

    if (deck) {
      deck.aiBlueprint = deck.ai_blueprint;
    }

    if (!deck) return res.status(404).json({ error: 'not found' });

    // Security check
    if (deck.user_id !== req.user.id) return res.status(403).json({ error: 'unauthorized' });

    // Fetch cards for this deck
    // We join with the 'cards' table strictly for search/metadata if needed, 
    // but we can also just return the user_cards row since it has 'name', 'set_code', etc.
    // The user_cards table has all the instance data.
    const items = await knex('user_cards')
      .where({ deck_id: deck.id })
      .orderBy('name');

    res.json({ deck, items });
  } catch (err) {
    console.error('[decks] get error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Create a deck
router.post('/', async (req, res) => {
  try {
    const { name, commander, commanderPartner, aiBlueprint, format } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const insert = {
      user_id: req.user.id,
      name,
      format: format || 'Commander',
      commander: commander || null,
      commander_partner: commanderPartner || null,
      ai_blueprint: aiBlueprint || null, // Map camelCase to snake_case column
      is_mockup: req.body.isMockup || false,
      // firestore_id? optional
    };

    const [row] = await knex('user_decks').insert(insert).returning('*');
    // Map back for immediate frontend usage
    row.aiBlueprint = row.ai_blueprint;
    res.status(201).json(row);
  } catch (err) {
    console.error('[decks] create error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Update deck (e.g. name or commander)
router.put('/:id', async (req, res) => {
  try {
    const existing = await knex('user_decks').where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ error: 'not found' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'unauthorized' });

    const { name, commander, commanderPartner, format } = req.body;
    const update = { updated_at: knex.fn.now() };
    if (name !== undefined) update.name = name;
    if (format !== undefined) update.format = format;
    if (commander !== undefined) update.commander = commander;
    if (commanderPartner !== undefined) update.commander_partner = commanderPartner;
    if (req.body.isMockup !== undefined) update.is_mockup = req.body.isMockup;

    const [row] = await knex('user_decks')
      .where({ id: req.params.id })
      .update(update)
      .returning('*');

    res.json(row);
  } catch (err) {
    console.error('[decks] update error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Delete deck
router.delete('/:id', async (req, res) => {
  try {
    const existing = await knex('user_decks').where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ error: 'not found' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'unauthorized' });

    // user_cards are set to ON DELETE SET NULL or CASCADE?
    // Migration: deck_id ... onDelete('SET NULL'). 
    // Wait, if I delete a deck, the cards should probably return to binder (deck_id=null) if "Split Stack".
    // Or if "Deck Only" instances, they should be deleted?
    // My Plan: "Cards ... deck_id ... (Nullable). If NULL, card is in Binder."
    // So if I delete the deck, I should decide:
    // Option A: Set deck_id = NULL (return to binder)
    // Option B: Delete cards.
    // Given "Split Stack", if I remove a card from a deck, it stays in collection.
    // If I delete the DECK, do I want to keep the cards?
    // Usually yes.
    // Migration said `onDelete('SET NULL')`. So DB handles it automatically!

    await knex('user_decks').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (err) {
    console.error('[decks] delete error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Import Deck with Smart Collection Logic
router.post('/import', async (req, res) => {
  try {
    const { deck, cards, options } = req.body;
    // options: { checkCollection: boolean, addToCollection: boolean }
    // checkCollection: If true, look for unassigned cards in collection first.
    // addToCollection: If true, insert missing cards into collection.

    const userId = req.user.id;

    if (!deck || !Array.isArray(cards)) return res.status(400).json({ error: 'Invalid import data' });

    await knex.transaction(async (trx) => {
      // 1. Create Deck
      const [newDeck] = await trx('user_decks').insert({
        user_id: userId,
        name: deck.name || 'Imported Deck',
        commander: deck.commander || null,
        updated_at: new Date()
      }).returning('*');

      const missingCards = []; // Cards not found in collection (if checking)
      const cardsToAssign = []; // IDs of cards to set deck_id

      // 2. Process Cards
      for (const c of cards) {
        let cardIdToAssign = null;
        const scryfallId = c.scryfall_id || c.id;

        // A. Check Collection first?
        if (options.checkCollection) {
          // Try to find an unassigned copy of this card
          // Logic: Match scryfall_id + finish + deck_id IS NULL
          const existing = await trx('user_cards')
            .where({
              user_id: userId,
              scryfall_id: scryfallId,
              finish: c.finish || 'nonfoil'
            })
            .whereNull('deck_id')
            .first();

          if (existing) {
            cardIdToAssign = existing.id;
          }
        }

        // B. If not found (or not checked), and addToCollection is true, create it
        if (!cardIdToAssign && options.addToCollection) {
          const [newCard] = await trx('user_cards').insert({
            user_id: userId,
            scryfall_id: scryfallId,
            name: c.name,
            set_code: c.set_code || c.set || '???',
            collector_number: c.collector_number || '0',
            finish: c.finish || 'nonfoil',
            image_uri: (c.data && c.data.image_uris?.normal) || c.image_uri || (c.image_uris?.normal) || null,
            count: 1, // Start with 1 for the deck
            data: c.data || c,
            deck_id: null, // Will assign below
            added_at: new Date()
          }).returning('id');
          cardIdToAssign = newCard.id;
        } else if (!cardIdToAssign) {
          // Not found and not adding? It's missing.
          missingCards.push(c.name);
        }

        // C. Assign to Deck if we have a card ID
        if (cardIdToAssign) {
          await trx('user_cards')
            .where({ id: cardIdToAssign })
            .update({ deck_id: newDeck.id });
        }
      }

      // Return result
      // If missingCards > 0, frontend can show specific toast/modal
      res.json({ success: true, deckId: newDeck.id, missingCards });
    });

  } catch (err) {
    console.error('[decks] import error', err);
    res.status(500).json({ error: 'import failed' });
  }
});

// Batch Add Cards to Deck
router.post('/:id/cards/batch', async (req, res) => {
  try {
    const { id } = req.params;
    const { cards } = req.body; // Array of card objects { scryfall_id, finish, etc. }
    const userId = req.user.id;

    if (!Array.isArray(cards)) return res.status(400).json({ error: 'cards array is required' });

    const deck = await knex('user_decks').where({ id, user_id: userId }).first();
    if (!deck) return res.status(404).json({ error: 'deck not found' });

    await knex.transaction(async (trx) => {
      for (const c of cards) {
        const scryfallId = c.scryfall_id || c.id;

        // 1. Try to find an unassigned copy in the binder first
        const existing = await trx('user_cards')
          .where({
            user_id: userId,
            scryfall_id: scryfallId,
            finish: c.finish || 'nonfoil'
          })
          .whereNull('deck_id')
          .first();

        if (existing) {
          await trx('user_cards').where({ id: existing.id }).update({ deck_id: id });
        } else {
          // 2. Create a new entry (defaulting to wishlist if it's an AI suggestion and we don't own it)
          // For now, if we're adding from AI builder, we'll assume it's a wishlist copy if not found in binder
          // to maintain the "Mockup/Wishlist" flow.
          await trx('user_cards').insert({
            user_id: userId,
            scryfall_id: scryfallId,
            name: c.name,
            set_code: c.set_code || c.set || '???',
            collector_number: c.collector_number || '0',
            finish: c.finish || 'nonfoil',
            image_uri: c.image_uri || (c.data && c.data.image_uris?.normal) || null,
            count: 1,
            data: c.data || c,
            deck_id: id,
            is_wishlist: true // Default to wishlist for batch added cards from AI if not in binder
          });
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[decks] batch add error', err);
    res.status(500).json({ error: 'batch add failed' });
  }
});

export default router;
