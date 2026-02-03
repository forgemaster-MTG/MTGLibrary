import { knex } from '../db.js';
import axios from 'axios';

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

function log(msg) {
    console.log(`[CardService] ${msg}`);
}


/**
 * Service to handle card metadata fetching and database synchronization.
 */
export const cardService = {
    /**
     * Helper to resolve an image URI from Scryfall card data.
     */
    resolveImage(cardData) {
        if (!cardData) return null;
        if (cardData.image_uris?.normal) return cardData.image_uris.normal;
        if (cardData.card_faces?.[0]?.image_uris?.normal) return cardData.card_faces[0].image_uris.normal;
        return null;
    },

    /**
     * Ensures a card has metadata in the global 'cards' table.
     */
    async ensureCardData(card) {
        if (card.data && card.data.image_uris) {
            return card;
        }

        console.log(`[CardService] Repairing global card data: ${card.name} (${card.setcode} #${card.number})`);

        try {
            const v4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            const scryfallId = card.uuid || card.data?.id;

            // Healing: If ID is missing or not Version 4, fallback to set/number search
            let apiUri;
            if (scryfallId && v4Regex.test(scryfallId)) {
                apiUri = `https://api.scryfall.com/cards/${scryfallId}`;
            } else {
                console.log(`[CardService] Suspect/Missing ID for ${card.name}. Using set/number fallback.`);
                apiUri = `https://api.scryfall.com/cards/${card.setcode.toLowerCase()}/${card.number}`;
            }

            const response = await fetch(apiUri);
            if (!response.ok) {
                console.warn(`[CardService] Failed to fetch from Scryfall: ${apiUri} (${response.status})`);
                return card;
            }

            const cardData = await response.json();

            const update = {
                data: cardData,
                name: cardData.name,
                setcode: cardData.set.toUpperCase(),
                number: cardData.collector_number,
                type: cardData.type_line,
                manacost: cardData.mana_cost,
                text: cardData.oracle_text,
                rarity: cardData.rarity,
                uuid: cardData.id // Ensure we store the fresh v4 ID
            };

            await knex('cards').where({ id: card.id }).update(update);
            return { ...card, ...update };
        } catch (err) {
            console.error(`[CardService] Error repairing card ${card.name}:`, err);
            return card;
        }
    },

    /**
     * Repairs a specific user_card entry.
     */
    async repairUserCard(userCard) {
        // If it already has data and an image, we're likely good
        if (userCard.data && userCard.image_uri) return userCard;

        console.log(`[CardService] Repairing user card: ${userCard.name} (${userCard.id})`);

        try {
            const v4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            let cardData = userCard.data;

            if (!cardData) {
                let apiUri;
                if (userCard.scryfall_id && v4Regex.test(userCard.scryfall_id)) {
                    apiUri = `https://api.scryfall.com/cards/${userCard.scryfall_id}`;
                } else {
                    console.log(`[CardService] Suspect/Missing ID for ${userCard.name}. Using set/number fallback.`);
                    apiUri = `https://api.scryfall.com/cards/${userCard.set_code.toLowerCase()}/${userCard.collector_number}`;
                }

                const response = await fetch(apiUri);
                if (response.ok) {
                    cardData = await response.json();
                }
            }

            if (!cardData) return userCard;

            const imageUri = this.resolveImage(cardData);
            const freshId = cardData.id;

            const update = {
                data: cardData,
                image_uri: imageUri,
                name: cardData.name,
                set_code: cardData.set.toUpperCase(),
                collector_number: cardData.collector_number,
                scryfall_id: freshId // Heal the ID
            };

            await knex('user_cards').where({ id: userCard.id }).update(update);
            return { ...userCard, ...update };
        } catch (err) {
            console.error(`[CardService] Error repairing user card ${userCard.name}:`, err);
            return userCard;
        }
    },

    /**
     * Batch repair for multiple cards.
     */
    async repairCards(cards, table = 'cards') {
        const results = [];
        for (const card of cards) {
            if (table === 'user_cards') {
                results.push(await this.repairUserCard(card));
            } else {
                results.push(await this.ensureCardData(card));
            }
        }
        return results;
    },

    /**
     * Advanced Card Search with Fallback
     */
    async findCards(criteria) {
        const { query: nameQueryString, set, cn, type, text, flavor, artist, rarity, colors, colorLogic, colorIdentity, colorExcluded, mv, power, toughness, preferFinish } = criteria;
        const nameQuery = (nameQueryString || '').trim();
        const isSimple = !colors && !type && !text && !mv && !rarity;

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
            if (set) dbQuery.whereRaw("lower(setcode) = ?", [set.toLowerCase()]);
            // Robust CN matching (handle leading zeros)
            if (cn) {
                dbQuery.whereRaw("ltrim(number, '0') = ltrim(?, '0')", [cn.toString()]);
            }

            if (type) dbQuery.whereRaw("data->>'type_line' ILIKE ?", [`%${type}%`]);
            if (text) dbQuery.whereRaw("data->>'oracle_text' ILIKE ?", [`%${text}%`]);
            if (flavor) dbQuery.whereRaw("data->>'flavor_text' ILIKE ?", [`%${flavor}%`]);
            if (artist) dbQuery.whereRaw("data->>'artist' ILIKE ?", [`%${artist}%`]);
            if (rarity && rarity.length > 0) dbQuery.whereRaw("data->>'rarity' = ANY(?)", [rarity]);

            if (colors && colors.length > 0) {
                const targetColors = colors;
                const logic = colorLogic || 'or';
                const field = colorIdentity ? "data->'color_identity'" : "data->'colors'";

                if (logic === 'and') {
                    const jsonArr = JSON.stringify(targetColors);
                    dbQuery.whereRaw(`${field} @> ?::jsonb`, [jsonArr]);
                } else {
                    dbQuery.whereRaw(`jsonb_exists_any(${field}, ?::text[])`, [targetColors]);
                }

                if (colorExcluded) {
                    const jsonArr = JSON.stringify(targetColors);
                    dbQuery.whereRaw(`${field} <@ ?::jsonb`, [jsonArr]);
                }
            }

            if (mv && mv.value !== undefined) {
                const op = mv.operator || '=';
                dbQuery.whereRaw(`(data->>'cmc')::numeric ${op} ?`, [mv.value]);
            }

            if (power && power.value !== undefined) {
                const op = power.operator || '=';
                dbQuery.whereRaw(`CASE WHEN data->>'power' ~ '^[0-9]+$' THEN (data->>'power')::numeric ELSE -1 END ${op} ?`, [power.value]);
            }
            if (toughness && toughness.value !== undefined) {
                const op = toughness.operator || '=';
                dbQuery.whereRaw(`CASE WHEN data->>'toughness' ~ '^[0-9]+$' THEN (data->>'toughness')::numeric ELSE -1 END ${op} ?`, [toughness.value]);
            }

            dbQuery.limit(50);
            let localResults = await dbQuery.select('*');

            // Handle preference sorting even for local results if they are variants
            if (localResults.length > 0) {
                const mapped = localResults.map(c => ({
                    ...c,
                    ...c.data,
                    image_uri: this.resolveImage(c.data)
                }));

                if (preferFinish) {
                    mapped.sort((a, b) => {
                        const getP = (card) => {
                            const p = card.prices || {};
                            // If preferring foil, try foil price. If missing, use non-foil with penalty.
                            if (preferFinish === 'foil') {
                                const foilPrice = parseFloat(p.usd_foil);
                                return !isNaN(foilPrice) ? foilPrice : (parseFloat(p.usd) || 999999) + 1000;
                            }
                            // If preferring non-foil, try non-foil price. If missing, use foil with penalty.
                            if (preferFinish === 'nonfoil') {
                                const normalPrice = parseFloat(p.usd);
                                return !isNaN(normalPrice) ? normalPrice : (parseFloat(p.usd_foil) || 999999) + 1000;
                            }
                            // Default: cheapest of either
                            return Math.min(parseFloat(p.usd) || 999999, parseFloat(p.usd_foil) || 999999);
                        };
                        return getP(a) - getP(b);
                    });
                }

                return mapped;
            }

            // 2. Fallback to Scryfall if local failed and it's a "simple" query (Discovery Mode)
            if (isSimple && (nameQuery || (set && cn))) {
                return await this.fallbackScript(nameQuery, set, cn, preferFinish);
            }

            return [];

        } catch (err) {
            console.error('[CardService] Search error:', err);
            throw err;
        }
    },

    async fallbackScript(nameQuery, set, cn, preferFinish) {
        let attempts = [];
        const pref = preferFinish || 'cheapest';

        if (nameQuery) {
            // PRIORITY 1: Robust Fuzzy/Exact Name search
            attempts.push(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(nameQuery)}`);
            // PRIORITY 2: Search all prints
            attempts.push(`https://api.scryfall.com/cards/search?q=${encodeURIComponent('!"' + nameQuery + '"')}&unique=prints&order=usd`);
        }

        if (set && cn) {
            const rawSet = set.toLowerCase();
            const setCode = SET_MAP[rawSet] || rawSet;
            const cnStr = cn.toString().replace(/^0+/, '');
            attempts.push(`https://api.scryfall.com/cards/${setCode}/${cnStr}`);
        }

        const headers = {
            'User-Agent': 'MTGForge/1.0',
            'Accept': 'application/json'
        };

        log(`Firing ${attempts.length} Scryfall fallback requests in parallel...`);

        // Run all requests in parallel
        const results = await Promise.allSettled(attempts.map(url => axios.get(url, { headers, timeout: 10000 })));

        const foundCards = [];
        const processedIds = new Set();

        for (const result of results) {
            if (result.status === 'fulfilled') {
                const response = result.value;
                let scryfallCards = response.data.data ? response.data.data : [response.data];

                // Process found cards
                for (const cardData of scryfallCards) {
                    if (processedIds.has(cardData.id)) continue;
                    processedIds.add(cardData.id);

                    try {
                        const saved = await this.saveScryfallCard(cardData);
                        if (saved) foundCards.push({ ...saved, ...saved.data });
                    } catch (saveErr) {
                        console.error('[CardSvc] Failed to save Scryfall result:', saveErr);
                    }
                }
            }
        }

        if (foundCards.length > 0) {
            // Sort merged results
            foundCards.sort((a, b) => {
                const getP = (card) => {
                    const p = card.prices || {};
                    if (pref === 'foil') {
                        const foilPrice = parseFloat(p.usd_foil);
                        return !isNaN(foilPrice) ? foilPrice : (parseFloat(p.usd) || 999999) + 1000;
                    }
                    return Math.min(parseFloat(p.usd) || 999999, parseFloat(p.usd_foil) || 999999);
                };
                return getP(a) - getP(b);
            });

            // Return top 50 (or less) unique cards
            const distinct = [];
            const seen = new Set();
            for (const c of foundCards) {
                if (!seen.has(c.id)) {
                    seen.add(c.id);
                    distinct.push(c);
                    if (distinct.length >= 50) break;
                }
            }
            return distinct;
        }
        return [];
    },

    async saveScryfallCard(cardData) {
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
            return await knex('cards').where({ uuid: existingId }).first();
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

            if (inserted) {
                await knex('cardidentifiers').insert({ uuid: inserted.uuid, scryfallid: scryfallId });
                return inserted;
            }
        }
        return null;
    }
};
