const express = require('express');
const router = express.Router();
const { knex } = require('../db');

// GET /cards/scryfall/:scryfallId
// Lookup a card by Scryfall id (the Scryfall id is often stored in `cardidentifiers`
// and links to `cards.id`). This route mirrors the logic previously in index.js
// and provides a single place for card-related APIs.
router.get('/scryfall/:scryfallId', async (req, res) => {
	const sId = req.params.scryfallId;
	try {
		let ci = null;

		// Try common column names on cardidentifiers
		const tries = [
			{ q: () => knex('cardidentifiers').where({ scryfall_id: sId }).first() },
			{ q: () => knex('cardidentifiers').where({ scryfallid: sId }).first() },
			{ q: () => knex('cardidentifiers').where({ scryfall: sId }).first() },
			{ q: () => knex('cardidentifiers').where({ identifier: sId }).first() },
			{ q: () => knex('cardidentifiers').where({ value: sId }).first() }
		];

		for (const t of tries) {
			try {
				const r = await t.q();
				if (r) { ci = r; break; }
			} catch (e) { /* ignore and continue */ }
		}

		// Try jsonb column 'data' containing the id
		if (!ci) {
			try {
				const r = await knex('cardidentifiers').whereRaw("data->>'scryfallId' = ?", [sId]).first();
				if (r) ci = r;
			} catch (e) { /* ignore */ }
		}

		// If still not found, try searching cards.data JSON for identifiers.scryfallId
		if (!ci) {
			try {
				const r = await knex('cards').whereRaw("data->'identifiers'->>'scryfallId' = ?", [sId]).first();
				if (r) return res.json({ card: r, via: 'cards.data.identifiers.scryfallId' });
			} catch (e) { /* ignore */ }
		}

		if (!ci) return res.status(404).json({ error: 'card identifier not found' });

		// Determine card id (common column names: card_id or cardId)
		const cardId = ci.card_id || ci.cardId || ci.id || ci.card || null;
		if (!cardId) {
			// maybe the identifier row stores the card id in a JSON column `data`
			if (ci.data && typeof ci.data === 'object') {
				const possible = ci.data.card_id || ci.data.cardId || ci.data.card || ci.data.id;
				if (possible) {
					const card = await knex('cards').where({ id: possible }).first();
					if (!card) return res.status(404).json({ error: 'card row not found' });
					return res.json({ card, identifier: ci });
				}
			}
			return res.status(500).json({ error: 'card identifier found but no card linkage present' });
		}

		const card = await knex('cards').where({ id: cardId }).first();
		if (!card) return res.status(404).json({ error: 'card not found' });
		res.json({ card, identifier: ci });
	} catch (err) {
		console.error('[cards/scryfall] error', err && err.stack || err);
		res.status(500).json({ error: 'internal error' });
	}
});

module.exports = router;

// POST /cards/add
// Body: { name: 'search text', exact: true|false }
// Searches `cards.name` for matches and returns each card plus its identifiers from `cardidentifiers`.
router.post('/add', async (req, res) => {
	const name = (req.body && (req.body.name || req.body.q)) || req.query.name || req.query.q;
	const exact = req.body && req.body.exact || req.query && req.query.exact;
	if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name (string) is required in body or query' });
	try {
		const q = knex('cards');
		if (exact === true || exact === 'true') {
			q.where('name', name);
		} else {
			// partial, case-insensitive match
			q.whereRaw('name ILIKE ?', [`%${name}%`]);
		}
		// safety limit
		q.limit(200);
		const cards = await q.select('*');

		// For each card, fetch identifiers that reference the card id in common ways
		const results = [];
		for (const c of cards) {
			const idVal = c.id;
			const ids = await knex('cardidentifiers')
				.where(function () {
					this.where({ card_id: idVal }).orWhere({ cardId: idVal }).orWhere({ card: idVal });
				})
				.orWhereRaw("data->>'card_id' = ?", [String(idVal)])
				.orWhereRaw("data->>'cardId' = ?", [String(idVal)])
				.orWhereRaw("data->>'card' = ?", [String(idVal)])
				.select('*')
				.limit(200);

			results.push({ card: c, identifiers: ids });
		}

		res.json({ count: results.length, results });
	} catch (err) {
		console.error('[cards/add] error', err && err.stack || err);
		res.status(500).json({ error: 'internal error' });
	}
});

