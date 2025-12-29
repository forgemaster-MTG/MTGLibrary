import express from 'express';
import { knex } from '../db.js';

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

// POST /cards/add
// Body: { name: 'search text', exact: true|false }
// Searches `cards.name` for matches and returns each card plus its identifiers from `cardidentifiers`.
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
// Body: { 
//   query: string (name),
//   set: string,
//   cn: string,
//   
//   // Advanced Filters
//   colors: [], // ['W', 'U']
//   colorLogic: 'or' | 'and',
//   colorIdentity: boolean, // true = identity, false = colors
//   rarity: [], // ['common', 'rare']
//   type: string,
//   text: string,
//   flavor: string,
//   artist: string,
//   
//   // Stats
//   mv: { operator: '=', value: number },
//   power: { operator: '=', value: number },
//   toughness: { operator: '=', value: number },
// }
router.post('/search', async (req, res) => {
	const body = req.body;
	const nameQuery = (body.query || '').trim();

	// Scryfall Fallback triggers for simple queries ONLY
	// If complex filters are present, we skip Scryfall fallback to avoid complexity mismatch
	const isSimple = !body.colors && !body.type && !body.text && !body.mv && !body.rarity;

	try {
		let dbQuery = knex('cards');

		// 1. Name
		if (nameQuery) {
			dbQuery.whereRaw('name ILIKE ?', [`%${nameQuery}%`]);
		}

		// 2. Set / CN
		if (body.set) dbQuery.whereRaw("lower(setcode) = ?", [body.set.toLowerCase()]);
		if (body.cn) dbQuery.where({ number: body.cn });

		// 3. Types
		if (body.type) {
			dbQuery.whereRaw("data->>'type_line' ILIKE ?", [`%${body.type}%`]);
		}

		// 4. Oracle Text
		if (body.text) {
			dbQuery.whereRaw("data->>'oracle_text' ILIKE ?", [`%${body.text}%`]);
		}

		// 5. Flavor & Artist
		if (body.flavor) dbQuery.whereRaw("data->>'flavor_text' ILIKE ?", [`%${body.flavor}%`]);
		if (body.artist) dbQuery.whereRaw("data->>'artist' ILIKE ?", [`%${body.artist}%`]);

		// 6. Rarity
		if (body.rarity && body.rarity.length > 0) {
			dbQuery.whereRaw("data->>'rarity' = ANY(?)", [body.rarity]);
		}

		// 7. Colors
		if (body.colors && body.colors.length > 0) {
			const targetColors = body.colors;
			const logic = body.colorLogic || 'or';
			const field = body.colorIdentity ? "data->'color_identity'" : "data->'colors'";

			if (logic === 'and') {
				const jsonArr = JSON.stringify(targetColors);
				dbQuery.whereRaw(`${field} @> ?::jsonb`, [jsonArr]);
			} else {
				// Use jsonb_exists_any with text[] to avoid ? placeholder issues in native operators
				dbQuery.whereRaw(`jsonb_exists_any(${field}, ?::text[])`, [targetColors]);
			}

			if (body.colorExcluded) {
				const jsonArr = JSON.stringify(targetColors);
				dbQuery.whereRaw(`${field} <@ ?::jsonb`, [jsonArr]);
			}
		}

		// 8. Stats (MV, Power, Toughness)
		// MV is numeric in data->cmc
		if (body.mv && body.mv.value !== undefined) {
			const op = body.mv.operator || '=';
			dbQuery.whereRaw(`(data->>'cmc')::numeric ${op} ?`, [body.mv.value]);
		}

		// Power/Toughness are strings (can be "*"), cast to numeric for simple comparison or handle carefully
		if (body.power && body.power.value !== undefined) {
			const op = body.power.operator || '=';
			// Try safe cast, ignore * for now
			dbQuery.whereRaw(`CASE WHEN data->>'power' ~ '^[0-9]+$' THEN (data->>'power')::numeric ELSE -1 END ${op} ?`, [body.power.value]);
		}
		if (body.toughness && body.toughness.value !== undefined) {
			const op = body.toughness.operator || '=';
			dbQuery.whereRaw(`CASE WHEN data->>'toughness' ~ '^[0-9]+$' THEN (data->>'toughness')::numeric ELSE -1 END ${op} ?`, [body.toughness.value]);
		}

		dbQuery.limit(50);
		const localResults = await dbQuery.select('*');

		// CACHING STRATEGY
		// If we found local results OR we have complex filters, return local only.
		if (localResults.length > 0 || !isSimple) {
			console.log(`[Cache Hit/Local] Returning ${localResults.length} cards (Simple: ${isSimple})`);
			const mapped = localResults.map(c => ({ ...c, ...c.data }));
			return res.json({ data: mapped });
		}

		// Fallback only for simple Name/Set/CN searches that yielded 0 local results
		if (isSimple) {
			console.log(`[Cache Miss] Fetching from Scryfall: ${nameQuery}`);
			const encoded = encodeURIComponent(nameQuery + (body.set ? ` set:${body.set}` : '') + (body.cn ? ` cn:${body.cn}` : ''));
			const response = await fetch(`https://api.scryfall.com/cards/search?q=${encoded}&unique=prints`);

			if (response.ok) {
				const data = await response.json();
				const scryfallCards = data.data || [];

				// Save to DB (Async, don't block response too long or do it before?)
				// We'll await it to ensure consistency for now.
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
						// update
						await knex('cards').where({ uuid: existingId }).update({
							data: cardData,
							name: cardData.name,
							setcode: cardData.set,
							number: cardData.collector_number
						});
						const updated = await knex('cards').where({ uuid: existingId }).first();
						savedCards.push({ ...updated, ...updated.data });
					} else {
						// insert
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
