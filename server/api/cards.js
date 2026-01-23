import express from 'express';
import { knex } from '../db.js';
import { cardService } from '../services/cardService.js';
import axios from 'axios';

const router = express.Router();

const SET_MAP = {
	'c1': 'cmd',
	'cmd': 'cmd',
	'mh1': 'mh1',
	'mh2': 'mh2',
	'unf': 'unf',
	'ust': 'ust',
	'unh': 'unh',
	'ugl': 'ugl',
	'clb': 'clb',
	'cmr': 'cmr'
};

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

		// 1. Try local DB first
		if (nameQuery) {
			// Exact match or contains match
			dbQuery.where(function () {
				this.whereRaw('name ILIKE ?', [nameQuery])
					.orWhereRaw('name ILIKE ?', [`%${nameQuery}%`]);
			});
		}
		if (body.set) dbQuery.whereRaw("lower(setcode) = ?", [body.set.toLowerCase()]);
		if (body.cn) dbQuery.where({ number: body.cn.toString() });

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
		let localResults = await dbQuery.select('*');

		// Handle preference sorting even for local results if they are variants
		if (localResults.length > 0) {
			const mapped = localResults.map(c => ({
				...c,
				...c.data,
				image_uri: cardService.resolveImage(c.data)
			}));

			if (body.preferFinish) {
				mapped.sort((a, b) => {
					const getP = (card) => {
						const p = card.prices || {};
						if (body.preferFinish === 'foil') return parseFloat(p.usd_foil) || 999999;
						if (body.preferFinish === 'nonfoil') return parseFloat(p.usd) || 999999;
						return Math.min(parseFloat(p.usd) || 999999, parseFloat(p.usd_foil) || 999999);
					};
					return getP(a) - getP(b);
				});
			}

			return res.json({ data: mapped });
		}

		// 2. Fallback to Scryfall if local failed and it's a "simple" query (Discovery Mode)
		if (isSimple && (nameQuery || (body.set && body.cn))) {
			let attempts = [];
			const pref = body.preferFinish || 'cheapest';

			if (nameQuery) {
				// PRIORITY 1: Robust Fuzzy/Exact Name search (Always returns something if it exists)
				attempts.push(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(nameQuery)}`);

				// PRIORITY 2: Search all prints to find cheapest/preferred finish
				attempts.push(`https://api.scryfall.com/cards/search?q=${encodeURIComponent('!"' + nameQuery + '"')}&unique=prints&order=usd`);
			}

			if (body.set && body.cn) {
				const rawSet = body.set.toLowerCase();
				const set = SET_MAP[rawSet] || rawSet;
				const cn = body.cn.toString();
				// PRIORITY 3: Try specific set/cn (If AI suggested it, user might want it)
				attempts.push(`https://api.scryfall.com/cards/${set}/${cn}`);
			}

			const headers = {
				'User-Agent': 'MTGForge/1.0',
				'Accept': 'application/json'
			};

			for (const url of attempts) {
				try {
					addLogSvr(`Scryfall fallback attempt: ${url}`);
					const response = await axios.get(url, { headers, timeout: 5000 });

					if (response.status === 200) {
						let scryfallCards = response.data.data ? response.data.data : [response.data];

						// If we have multiple prints, sort them by the user's preference
						if (scryfallCards.length > 1) {
							scryfallCards.sort((a, b) => {
								const getP = (card) => {
									const p = card.prices || {};
									if (pref === 'foil') return parseFloat(p.usd_foil) || 999999;
									if (pref === 'nonfoil') return parseFloat(p.usd) || 999999;
									return Math.min(parseFloat(p.usd) || 999999, parseFloat(p.usd_foil) || 999999);
								};
								return getP(a) - getP(b);
							});
						}

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
									setcode: cardData.set.toUpperCase(),
									number: cardData.collector_number
								});
								const updated = await knex('cards').where({ uuid: existingId }).first();
								savedCards.push({ ...updated, ...updated.data });
							} else {
								const [inserted] = await knex('cards').insert({
									name: cardData.name,
									setcode: cardData.set.toUpperCase(),
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

							// If we only need the top match for Resolution, we can break after one successful save
							// but here we might want all prints to show variants. Let's limit to top 5.
							if (savedCards.length >= 5) break;
						}
						return res.json({ data: savedCards });
					}
				} catch (fetchErr) {
					const status = fetchErr.response?.status;
					const data = fetchErr.response?.data;
					// Don't log 404s as warnings if we have more attempts to try
					if (status !== 404) {
						console.warn(`[CardSvc] Scryfall fallback failed for ${url} (${status || 'timeout'}): ${status === 404 ? 'Not Found' : JSON.stringify(data || fetchErr.message)}`);
					}
				}
				// Small delay between attempts
				await new Promise(r => setTimeout(r, 100));
			}
		}

		return res.json({ data: [] });

	} catch (err) {
		console.error('[cards/search] error', err);
		res.status(500).json({ error: 'internal server error' });
	}
});

function addLogSvr(msg) {
	console.log(`[CardSvc] ${msg}`);
}

export default router;
