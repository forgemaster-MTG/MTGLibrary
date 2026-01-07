import express from 'express';
import { knex } from '../db.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// List precon types
router.get('/types', async (req, res) => {
  try {
    const rows = await knex('precons').distinct('type').whereNotNull('type').orderBy('type');
    res.json(rows.map(r => r.type));
  } catch (err) {
    console.error('[precons] types error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// List precon sets
router.get('/sets', async (req, res) => {
  try {
    const rows = await knex('precons').distinct('set_code').whereNotNull('set_code').orderBy('set_code');
    res.json(rows.map(r => r.set_code));
  } catch (err) {
    console.error('[precons] sets error', err);
    res.status(500).json({ error: 'db error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { type, set_code, search } = req.query;
    let query = knex('precons').select(
      'id', 'name', 'set_code', 'type',
      'colors', 'image_uri', 'card_count', 'commander_name'
    );

    if (type) {
      query = query.where({ type });
    }

    if (set_code) {
      query = query.where({ set_code });
    }

    if (search) {
      const term = `%${search.toLowerCase()}%`;
      query = query.where(function () {
        this.whereRaw('LOWER(name) LIKE ?', [term])
          .orWhereRaw('LOWER(commander_name) LIKE ?', [term]);
      });
    }

    const rows = await query.limit(200);

    // Calculate prices efficiently
    const ids = rows.map(r => r.id);
    let priceMap = {};

    if (ids.length > 0) {
      const prices = await knex('precon_cards as pc')
        .leftJoin('cards as c', function () {
          this.on('pc.scryfall_id', '=', knex.raw("c.data->>'id'"));
        })
        .select('pc.precon_id')
        // Sum price * quantity. COALESCE ensures we use normal price if foil missing or vice versa
        .sum(knex.raw("COALESCE(CAST(c.data->'prices'->>'usd' AS NUMERIC), CAST(c.data->'prices'->>'usd_foil' AS NUMERIC), 0) * pc.quantity"))
        .whereIn('pc.precon_id', ids)
        .groupBy('pc.precon_id');

      prices.forEach(p => {
        priceMap[p.precon_id] = p.sum;
      });
    }

    // Map to frontend expectation 
    const mapped = rows.map(r => ({
      id: r.id,
      name: r.name,
      data: {
        code: r.set_code,
        type: r.type,
        commander: r.commander_name ? [{ name: r.commander_name }] : [],
        // Lightweight objects for list view
        mainBoard: { length: r.card_count },
        sideBoard: [],
        colors: r.colors
      },
      type: r.type,
      set_code: r.set_code,
      image_uri: r.image_uri,
      colors: r.colors,
      card_count: r.card_count,
      total_price: parseFloat(priceMap[r.id] || 0)
    }));

    res.json(mapped);
  } catch (err) {
    console.error('[precons] list error', err);
    res.status(500).json({ error: 'db error: ' + err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const precon = await knex('precons').where({ id }).first();

    // Fallback for firestore_id if numeric conversion fails or not found
    // If id is not numeric it might be legacy firestore ID
    // but our new migration uses auto-increment ID.
    // We assume the frontend passes the numeric ID from the list view.

    if (!precon) return res.status(404).json({ error: 'not found' });

    // Fetch Cards with Prices and Images from Cards Table
    // Left Join to preserve list even if card missing in DB (though ideally it's there)
    const cards = await knex('precon_cards as pc')
      .leftJoin('cards as c', function () {
        this.on('pc.scryfall_id', '=', knex.raw("c.data->>'id'"));
      })
      .select(
        'pc.*',
        'c.data as card_data', // if available
        'c.manacost',
        'c.type as card_type',
        'c.text'
      )
      .where('pc.precon_id', precon.id);

    // Reconstruct data object
    const commander = [];
    const mainBoard = [];
    const sideBoard = [];

    for (const c of cards) {
      // Construct card object similar to what frontend expects
      // It needs 'image_uris', 'prices', 'identifiers'

      const cardData = c.card_data || {};
      const prices = cardData.prices || {}; // If links correctly
      const image_uris = cardData.image_uris || c.card_data?.image_uris || {};

      // If join failed (c.card_data is null), use placeholder or what we have
      // But we want to show price. If join failed, price is null. 

      const cardObj = {
        name: c.card_name,
        set: c.set_code,
        number: c.collector_number,
        quantity: c.quantity,
        count: c.quantity,
        finish: c.finish,
        prices: prices,
        image_uris: image_uris,
        identifiers: { scryfallId: c.scryfall_id }, // Essential for Image Helper
        data: cardData // Pass full data if present for deep properties
      };

      if (c.zone === 'commander') commander.push(cardObj);
      else if (c.zone === 'sideBoard') sideBoard.push(cardObj);
      else mainBoard.push(cardObj);
    }

    res.json({
      id: precon.id,
      name: precon.name,
      data: {
        code: precon.set_code,
        type: precon.type,
        commander,
        mainBoard,
        sideBoard
      }
    });

  } catch (err) {
    console.error('[precons] get error', err);
    res.status(500).json({ error: 'db error' });
  }
});



// Create User Deck from Precon
router.post('/:id/create', auth, async (req, res) => {
  try {
    const { mode } = req.body; // 'collection' | 'wishlist'
    const id = req.params.id;
    const userId = req.user.id;

    const precon = await knex('precons').where({ id }).first();
    if (!precon) return res.status(404).json({ error: 'Precon not found' });

    // Fetch Cards
    // Similar to detail view, we need full data for creating user cards
    const cards = await knex('precon_cards as pc')
      .leftJoin('cards as c', function () {
        this.on('pc.scryfall_id', '=', knex.raw("c.data->>'id'"));
      })
      .select('pc.*', 'c.data as card_data')
      .where('pc.precon_id', id);

    // 1. Create Deck
    const isWishlist = mode === 'wishlist';
    const deckTags = ['Precon'];
    if (isWishlist) deckTags.push('Mockup');

    const [newDeck] = await knex('user_decks').insert({
      user_id: userId,
      name: precon.name,
      commander: null, // Logic below
      format: 'Commander',
      tags: JSON.stringify(deckTags),
      is_mockup: isWishlist,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');

    // Find commander
    const commanderCard = cards.find(c => c.zone === 'commander');
    if (commanderCard) {
      const commanderData = commanderCard.card_data || { name: commanderCard.card_name };
      await knex('user_decks').where({ id: newDeck.id }).update({ commander: JSON.stringify(commanderData) });
    }

    // 2. Insert Cards
    const cardsToInsert = cards.map(c => {
      const cardData = c.card_data || {};
      const isWishlist = mode === 'wishlist';

      return {
        user_id: userId,
        scryfall_id: c.scryfall_id,
        name: c.card_name,
        set_code: c.set_code,
        collector_number: c.collector_number,
        finish: c.finish,
        image_uri: cardData.image_uris?.normal || null,
        count: c.quantity,
        data: cardData,
        deck_id: newDeck.id,
        is_wishlist: isWishlist,
        tags: JSON.stringify(isWishlist ? [] : ['PreconSource']),
        added_at: new Date()
      };
    });

    if (cardsToInsert.length > 0) {
      await knex('user_cards').insert(cardsToInsert);
    }

    res.json({ success: true, deckId: newDeck.id });

  } catch (err) {
    console.error('[precons] create deck error', err);
    res.status(500).json({ error: 'db error: ' + err.message });
  }
});

export default router;
