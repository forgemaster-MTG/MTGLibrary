import express from 'express';
import { knex } from '../db.js';
import { cardService } from '../services/cardService.js';

import { validate } from '../middleware/validate.js';
import { cardAutocompleteSchema, setsForCardSchema, cardSearchSchema } from '../schemas/cardSchemas.js';

const router = express.Router();


// GET /cards/autocomplete
// Query: ?q=partial_name
// Query: ?q=partial_name
router.get('/autocomplete', validate({ query: cardAutocompleteSchema }), async (req, res) => {
	const q = (req.query.q || '').trim();
	if (q.length < 2) return res.json({ data: [] });

	try {
		const results = await knex('cards')
			.distinct('name')
			.whereRaw('name ILIKE ?', [`${q}%`])
			.orderBy('name', 'asc')
			.limit(10);

		res.json({ data: results.map(r => r.name) });
	} catch (err) {
		console.error('[cards/autocomplete] error', err);
		res.status(500).json({ error: 'db error' });
	}
});

// GET /cards/sets-for-card
// Query: ?name=Card+Name
// Query: ?name=Card+Name
router.get('/sets-for-card', validate({ query: setsForCardSchema }), async (req, res) => {
	const name = (req.query.name || '').trim();
	if (!name) return res.json({ data: [] });

	try {
		const results = await knex('cards')
			.distinct('setcode')
			.whereRaw('name ILIKE ?', [`%${name}%`]);

		res.json({ data: results.map(r => r.setcode.toLowerCase()) });
	} catch (err) {
		console.error('[cards/sets-for-card] error', err);
		res.status(500).json({ error: 'db error' });
	}
});

// GET /cards/scryfall/:scryfallId
router.get('/scryfall/:scryfallId', async (req, res) => {
	const sId = req.params.scryfallId;
	try {
		let ci = null;
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
			} catch (e) { /* ignore */ }
		}

		if (!ci) {
			try {
				const r = await knex('cardidentifiers').whereRaw("data->>'scryfallId' = ?", [sId]).first();
				if (r) ci = r;
			} catch (e) { /* ignore */ }
		}

		if (!ci) {
			try {
				const r = await knex('cards').whereRaw("data->'identifiers'->>'scryfallId' = ?", [sId]).first();
				if (r) return res.json({ card: r, via: 'cards.data.identifiers.scryfallId' });
			} catch (e) { /* ignore */ }
		}

		if (!ci) return res.status(404).json({ error: 'card identifier not found' });

		const cardId = ci.card_id || ci.cardId || ci.id || ci.card || null;
		if (!cardId) {
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

router.post('/add', async (req, res) => {
	const { name, exact } = req.body;
	if (!name) return res.status(400).json({ error: 'name is required' });

	try {
		let query = knex('cards');
		if (exact) query.whereRaw('lower(name) = ?', [name.toLowerCase()]);
		else query.whereRaw('name ILIKE ?', [`%${name}%`]);

		const cards = await query.select('*');
		const results = [];

		for (const card of cards) {
			const idents = await knex('cardidentifiers').where({ uuid: card.uuid }).orWhere({ card_id: card.id }).select('*');
			results.push({ ...card, identifiers: idents });
		}

		res.json(results);
	} catch (err) {
		console.error('[cards/add] error', err);
		res.status(500).json({ error: 'internal error' });
	}
});

router.post('/search', validate({ body: cardSearchSchema }), async (req, res, next) => {
	try {
		const results = await cardService.findCards(req.body);
		res.json({ data: results });
	} catch (err) {
		next(err);
	}
});

function addLogSvr(msg) {
	console.log(`[CardSvc] ${msg}`);
}

export default router;
