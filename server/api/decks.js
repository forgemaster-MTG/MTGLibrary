import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';
import { checkLimit } from '../middleware/usageLimits.js';

const router = express.Router();

// Get Public Deck by Slug (No Auth Required)
router.get('/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const deck = await knex('user_decks').where({ share_slug: slug, is_public: true }).first();
    if (!deck) return res.status(404).json({ error: 'Deck not found or private' });

    // Fetch cards
    const items = await knex('user_cards')
      .where({ deck_id: deck.id })
      .orderBy('name');

    res.json({ deck, items, isPublicView: true });
  } catch (err) {
    console.error('[decks] public get error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Require authentication for all deck operations
router.use(authMiddleware);

// List decks for logical logged-in user (owned + shared with)
router.get('/', async (req, res) => {
  try {
    // 0. Handle 'all' (Mixed Decks)
    if (req.query.userId === 'all') {
      const ownedDecks = await knex('user_decks')
        .select([
          'user_decks.*',
          knex.raw(`'owner' as permission_role`),
          knex.raw(`
                    (SELECT COALESCE(SUM(count), 0) FROM user_cards WHERE deck_id = user_decks.id) +
                    (CASE WHEN commander IS NOT NULL THEN 1 ELSE 0 END) +
                    (CASE WHEN commander_partner IS NOT NULL THEN 1 ELSE 0 END)
                    as card_count
                `)
        ])
        .where({ user_id: req.user.id });

      const sharedDecks = await knex('user_decks')
        .join('collection_permissions', function () {
          this.on('collection_permissions.target_deck_id', '=', 'user_decks.id')
            .orOn('collection_permissions.owner_id', '=', 'user_decks.user_id');
        })
        .select([
          'user_decks.*',
          'collection_permissions.permission_level as permission_role',
          knex.raw(`
                    (SELECT COALESCE(SUM(count), 0) FROM user_cards WHERE deck_id = user_decks.id) +
                    (CASE WHEN commander IS NOT NULL THEN 1 ELSE 0 END) +
                    (CASE WHEN commander_partner IS NOT NULL THEN 1 ELSE 0 END)
                    as card_count
                `)
        ])
        .where('collection_permissions.grantee_id', req.user.id)
        .whereNull('collection_permissions.target_deck_id');

      // Deduplicate by ID just in case
      const deckMap = new Map();
      [...ownedDecks, ...sharedDecks].forEach(d => deckMap.set(d.id, d));

      return res.json(Array.from(deckMap.values()));
    }

    // 1. Owned Decks
    const ownedDecks = await knex('user_decks')
      .select([
        'user_decks.*',
        knex.raw(`'owner' as permission_role`),
        knex.raw(`
          (SELECT COALESCE(SUM(count), 0) FROM user_cards WHERE deck_id = user_decks.id) +
          (CASE WHEN commander IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN commander_partner IS NOT NULL THEN 1 ELSE 0 END)
          as card_count
        `)
      ])
      .where({ user_id: req.user.id });

    // 2. Shared Decks (via collection_permissions)
    const sharedDecks = await knex('user_decks')
      .join('collection_permissions', function () {
        this.on('collection_permissions.target_deck_id', '=', 'user_decks.id')
          .orOn('collection_permissions.owner_id', '=', 'user_decks.user_id');
      })
      .select([
        'user_decks.*',
        'collection_permissions.permission_level as permission_role',
        knex.raw(`
          (SELECT COALESCE(SUM(count), 0) FROM user_cards WHERE deck_id = user_decks.id) +
          (CASE WHEN commander IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN commander_partner IS NOT NULL THEN 1 ELSE 0 END)
          as card_count
        `)
      ])
      .where('collection_permissions.grantee_id', req.user.id)
      .whereNull('collection_permissions.target_deck_id'); // Global permissions (TODO: Handle specific deck shares better in query if needed)

    // Note: The specific deck share logic in query is tricky if mixed.
    // For now, let's just return owned decks + explicit shared decks.
    // Or simplify: just return owned for the main "My Decks" list.
    // AND add a separate "Shared With Me" endpoint or sections?
    // Let's keep this endpoint purely for OWNED decks for now to avoid UI confusion,
    // unless we want a unified view. User likely expects "My Decks".

    // Returning ONLY owned decks for now to preserve existing behavior.
    // If we want shared decks, we should create a new endpoint or query param.
    // Reverting to original logic but keeping the structure ready for future.

    // 4. Check for userId query param (Reviewing another user's decks)
    if (req.query.userId && req.query.userId != req.user.id) {
      const targetUserId = req.query.userId;

      // 4a. Check for Public Access first
      const targetUser = await knex('users').where({ id: targetUserId }).first();
      let isPublicAccess = targetUser?.is_public_library === true;

      // 4b. If not public, check for Global Permission
      let perm = null;
      if (!isPublicAccess) {
        perm = await knex('collection_permissions')
          .where({
            owner_id: targetUserId,
            grantee_id: req.user.id
          })
          .whereNull('target_deck_id') // Global permission
          .first();
      }

      if (!isPublicAccess && !perm) {
        return res.status(403).json({ error: 'Access denied to these decks' });
      }

      // Return Owner's Decks (Read-only view mostly)
      const query = knex('user_decks')
        .select([
          'user_decks.*',
          knex.raw(`
                (SELECT COALESCE(SUM(count), 0) FROM user_cards WHERE deck_id = user_decks.id) +
                (CASE WHEN commander IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN commander_partner IS NOT NULL THEN 1 ELSE 0 END)
                as card_count
              `)
        ])
        .where({ user_id: targetUserId })
        .orderBy('updated_at', 'desc');

      // If ONLY relying on public access (not specific permission), only show public decks
      if (isPublicAccess && !perm) {
        query.where({ is_public: true });
      }

      const rows = await query;
      return res.json(rows);
    }

    const rows = await knex('user_decks')
      .select([
        'user_decks.*',
        knex.raw(`
          (SELECT COALESCE(SUM(count), 0) FROM user_cards WHERE deck_id = user_decks.id) +
          (CASE WHEN commander IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN commander_partner IS NOT NULL THEN 1 ELSE 0 END)
          as card_count
        `)
      ])
      .where({ user_id: req.user.id })
      .orderBy('sort_order', 'asc')
      .orderBy('updated_at', 'desc')
      .limit(200);

    res.json(rows);
  } catch (err) {
    console.error('[decks] list error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Reorder decks
router.put('/reorder', async (req, res) => {
  try {
    const { deckIds } = req.body;
    if (!Array.isArray(deckIds)) return res.status(400).json({ error: 'deckIds array required' });

    await knex.transaction(async (trx) => {
      for (let i = 0; i < deckIds.length; i++) {
        await trx('user_decks')
          .where({ id: deckIds[i], user_id: req.user.id })
          .update({ sort_order: i });
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[decks] reorder error', err);
    res.status(500).json({ error: 'db error' });
  }
});



// Get deck by id, include cards
router.get('/:id', async (req, res) => {
  try {
    const deck = await knex('user_decks')
      .where({ id: req.params.id })
      .first();

    if (!deck) return res.status(404).json({ error: 'not found' });

    if (deck) {
      deck.aiBlueprint = deck.ai_blueprint;
    }

    // Security check: Owner OR Public OR Shared Permission
    let hasAccess = false;
    let permissionLevel = 'viewer';

    if (deck.user_id === req.user.id) {
      hasAccess = true;
      permissionLevel = 'owner';
    } else if (deck.is_public) {
      hasAccess = true;
      permissionLevel = 'viewer';
    } else {
      // Check for specific or global permission
      const perm = await knex('collection_permissions')
        .where({ owner_id: deck.user_id, grantee_id: req.user.id })
        .andWhere(function () {
          this.where('target_deck_id', deck.id).orWhereNull('target_deck_id');
        })
        .orderBy('created_at', 'desc') // specific might be newer? logic: specific overrides?
        // Actually, let's pick the highest priv? Or just any.
        .first();

      if (perm) {
        hasAccess = true;
        permissionLevel = perm.permission_level;
      }
    }

    if (!hasAccess) return res.status(403).json({ error: 'unauthorized' });

    // Fetch cards for this deck
    const items = await knex('user_cards')
      .where({ deck_id: deck.id })
      .orderBy('name');

    res.json({ deck: { ...deck, permissionLevel }, items });
  } catch (err) {
    console.error('[decks] get error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Create a deck
router.post('/', checkLimit('decks'), async (req, res) => {
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
    if (req.body.shareSlug !== undefined) update.share_slug = req.body.shareSlug;
    if (req.body.notes !== undefined) update.notes = req.body.notes;
    if (req.body.tags !== undefined) update.tags = JSON.stringify(req.body.tags);
    if (req.body.aiBlueprint !== undefined) update.ai_blueprint = req.body.aiBlueprint;

    // Remove 'Precon' tag if commander changes
    if (commander !== undefined || commanderPartner !== undefined) {
      let tags = existing.tags || [];
      if (typeof tags === 'string') tags = JSON.parse(tags);
      if (tags.includes('Precon')) {
        update.tags = JSON.stringify(tags.filter(t => t !== 'Precon'));
      }
    }

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

    const deleteCards = req.query.deleteCards === 'true';

    await knex.transaction(async (trx) => {
      // If requested, delete cards in the deck
      if (deleteCards) {
        await trx('user_cards').where({ deck_id: req.params.id }).del();
      }

      // Delete the deck (DB cascade or set null will handle remaining cards if not deleted above)
      // If we didn't delete cards, they return to binder (deck_id = NULL) due to DB constraint usually,
      // or we rely on logic. Existing cards just lose their deck_id linkage.
      await trx('user_decks').where({ id: req.params.id }).del();
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[decks] delete error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Import Deck with Smart Collection Logic
router.post('/import', checkLimit('decks'), async (req, res) => {
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
      // Remove Precon tag if exists (Card list modified)
      const currentTags = deck.tags || [];
      const tagsArray = typeof currentTags === 'string' ? JSON.parse(currentTags) : currentTags;
      if (tagsArray.includes('Precon')) {
        await trx('user_decks').where({ id }).update({
          tags: JSON.stringify(tagsArray.filter(t => t !== 'Precon'))
        });
      }

      for (const c of cards) {
        const scryfallId = c.scryfall_id || c.id;

        // 1. Try to find an unassigned copy in the binder with a 3-TIER Strategy
        // Tier A: Exact Match (ID + Finish)
        let existing = await trx('user_cards')
          .where({ user_id: userId, scryfall_id: scryfallId, finish: c.finish || 'nonfoil' })
          .whereNull('deck_id')
          .first();

        // Tier B: Loose ID Match (Same Card, Any Finish) -> Prefer Foil
        if (!existing) {
          existing = await trx('user_cards')
            .where({ user_id: userId, scryfall_id: scryfallId })
            .whereNull('deck_id')
            .orderBy('finish', 'asc') // 'etched' < 'foil' < 'nonfoil' (Correctly prefers foils)
            .first();
        }

        // Tier C: Loose Name Match (Same Name, Any Set/Finish) -> Prefer Foil
        if (!existing) {
          existing = await trx('user_cards')
            .where({ user_id: userId, name: c.name })
            .whereNull('deck_id')
            .orderBy('finish', 'asc') // Prefer foils even if different set
            .first();
        }

        if (existing) {
          if (existing.count > 1) {
            // Split the stack: Decrement binder count
            await trx('user_cards').where({ id: existing.id }).update({ count: existing.count - 1 });

            // Insert a single copy into the deck
            // CRITICAL: Use the EXISTING card's physical data (finish/set)
            await trx('user_cards').insert({
              user_id: userId,
              scryfall_id: existing.scryfall_id, // Use owned ID
              name: existing.name,
              set_code: existing.set_code,
              collector_number: existing.collector_number,
              finish: existing.finish,
              image_uri: existing.image_uri,
              data: existing.data,
              is_wishlist: existing.is_wishlist,
              deck_id: id,
              count: 1
            });
          } else {
            // Move the single existing card to the deck
            await trx('user_cards').where({ id: existing.id }).update({ deck_id: id });
          }
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

// Batch Remove Cards from Deck
router.delete('/:id/cards', async (req, res) => {
  try {
    const { id } = req.params;
    const { cardIds } = req.body; // Array of user_cards IDs
    const userId = req.user.id; // Corrected: use req.user.id

    if (!Array.isArray(cardIds)) return res.status(400).json({ error: 'cardIds array is required' });

    await knex('user_cards')
      .whereIn('id', cardIds)
      .andWhere({ user_id: userId, deck_id: id }) // Security check
      .del(); // Actually delete them? Or just remove from deck?
    // User requested "Wishlist Removal" -> usually "Delete" from wishlist.
    // If "Collection", usually "Return to Binder".
    // Let's support both via query param? ?mode=delete vs ?mode=remove
    // Defaults: If deck is mockup, DELETE. If deck is real, REMOVE (deck_id=null).
    // Actually, frontend can decide.
    // Let's assume this endpoint is "Remove from Deck".
    // But user said "Delete from wishlist".
    // Let's accept a query param `action=delete` or `action=remove`.

    const action = req.query.action || 'remove'; // 'remove' (nullify deck_id) or 'delete' (delete row)

    if (action === 'delete') {
      await knex('user_cards')
        .whereIn('id', cardIds)
        .andWhere({ user_id: userId, deck_id: id })
        .del();
    } else {
      await knex('user_cards')
        .whereIn('id', cardIds)
        .andWhere({ user_id: userId, deck_id: id })
        .update({ deck_id: null });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[decks] batch remove error', err);
    res.status(500).json({ error: 'batch remove failed' });
  }
});

export default router;
