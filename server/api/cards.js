import express from 'express';
import { knex } from '../db.js';
import { cardService } from '../services/cardService.js';

const router = express.Router();

// GET /cards/autocomplete
// Query: ?q=partial_name
router.get('/autocomplete', async (req, res) => {
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
router.get('/sets-for-card', async (req, res) => {
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

router.post('/search', async (req, res) => {
	const body = req.body;
	const nameQuery = (body.query || '').trim();
	const isSimple = !body.colors && !body.type && !body.text && !body.mv && !body.rarity;

	try {
		let dbQuery = knex('cards');

		if (nameQuery) dbQuery.whereRaw('name ILIKE ?', [`%${nameQuery}%`]);
		if (body.set) dbQuery.whereRaw("lower(setcode) = ?", [body.set.toLowerCase()]);
		if (body.cn) dbQuery.where({ number: body.cn });
		if (body.type) dbQuery.whereRaw("data->>'type_line' ILIKE ?", [`%${body.type}%`]);
		if (body.text) dbQuery.whereRaw("data->>'oracle_text' ILIKE ?", [`%${body.text}%`]);
		if (body.flavor) dbQuery.whereRaw("data->>'flavor_text' ILIKE ?", [`%${body.flavor}%`]);
		if (body.artist) dbQuery.whereRaw("data->>'artist' ILIKE ?", [`%${body.artist}%`]);
		if (body.rarity && body.rarity.length > 0) dbQuery.whereRaw("data->>'rarity' = ANY(?)", [body.rarity]);

		if (body.colors && body.colors.length > 0) {
			const targetColors = body.colors;
			const logic = body.colorLogic || 'or';
			const field = body.colorIdentity ? "data->'color_identity'" : "data->'colors'";

			if (logic === 'and') {
				const jsonArr = JSON.stringify(targetColors);
				dbQuery.whereRaw(`${field} @> ?::jsonb`, [jsonArr]);
			} else {
				dbQuery.whereRaw(`jsonb_exists_any(${field}, ?::text[])`, [targetColors]);
			}

			if (body.colorExcluded) {
				const jsonArr = JSON.stringify(targetColors);
				dbQuery.whereRaw(`${field} <@ ?::jsonb`, [jsonArr]);
			}
		}

		if (body.mv && body.mv.value !== undefined) {
			const op = body.mv.operator || '=';
			dbQuery.whereRaw(`(data->>'cmc')::numeric ${op} ?`, [body.mv.value]);
		}

		if (body.power && body.power.value !== undefined) {
			const op = body.power.operator || '=';
			dbQuery.whereRaw(`CASE WHEN data->>'power' ~ '^[0-9]+$' THEN (data->>'power')::numeric ELSE -1 END ${op} ?`, [body.power.value]);
		}
		if (body.toughness && body.toughness.value !== undefined) {
			const op = body.toughness.operator || '=';
			dbQuery.whereRaw(`CASE WHEN data->>'toughness' ~ '^[0-9]+$' THEN (data->>'toughness')::numeric ELSE -1 END ${op} ?`, [body.toughness.value]);
		}

		dbQuery.limit(50);
		const localResults = await dbQuery.select('*');

		if (localResults.length > 0 || !isSimple) {
			const mapped = localResults.map(c => ({
				...c,
				...c.data,
				image_uri: cardService.resolveImage(c.data)
			}));
			return res.json({ data: mapped });
		}

		if (isSimple) {
			const encoded = encodeURIComponent(nameQuery + (body.set ? ` set:${body.set}` : '') + (body.cn ? ` cn:${body.cn}` : ''));
			const response = await fetch(`https://api.scryfall.com/cards/search?q=${encoded}&unique=prints`);

			if (response.ok) {
				const data = await response.json();
				const scryfallCards = data.data || [];
				const savedCards = [];

				for (const cardData of scryfallCards) {
					const scryfallId = cardData.id;
					let existingId = null;
					const existingIdent = await knex('cardidentifiers').where({ scryfallid: scryfallId }).first();
					if (existingIdent) existingId = existingIdent.uuid;
					else {
						const existingCard = await knex('cards').where({ uuid: scryfallId }).first();
						if (existingCard) existingId = existingCard.uuid;
					}

					if (existingId) {
						await knex('cards').where({ uuid: existingId }).update({
							data: cardData,
							name: cardData.name,
							setcode: cardData.set,
							number: cardData.collector_number
						});
						const updated = await knex('cards').where({ uuid: existingId }).first();
						savedCards.push({ ...updated, ...updated.data });
					} else {
						const [inserted] = await knex('cards').insert({
							name: cardData.name,
							setcode: cardData.set,
							number: cardData.collector_number,
							uuid: scryfallId,
							data: cardData,
							type: cardData.type_line,
							manacost: cardData.mana_cost,
							text: cardData.oracle_text
						}).returning('*');
						await knex('cardidentifiers').insert({ uuid: inserted.uuid, scryfallid: scryfallId });
						savedCards.push({ ...inserted, ...inserted.data });
					}
				}
				return res.json({ data: savedCards });
			}
		}

		return res.json({ data: [] });

	} catch (err) {
		console.error('[cards/search] error', err);
		res.status(500).json({ error: 'internal server error' });
	}
});

export default router;
