import express from 'express';
import { knex } from '../db.js';

const router = express.Router();

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// GET /admin/sets
// Returns list of sets from Scryfall
router.get('/sets', async (req, res) => {
    try {
        // Fetch all sets from Scryfall
        const response = await fetch('https://api.scryfall.com/sets');
        if (!response.ok) throw new Error('Failed to fetch sets');
        const data = await response.json();
        // Filter? Maybe just return all and let frontend filter.
        // Sorting by release date descending
        const sets = (data.data || []).sort((a, b) => new Date(b.released_at) - new Date(a.released_at));

        res.json({ data: sets.map(s => ({ code: s.code, name: s.name, released_at: s.released_at, icon: s.icon_svg_uri })) });
    } catch (err) {
        console.error('[Admin] Get Sets Error', err);
        res.status(500).json({ error: 'Failed to fetch sets' });
    }
});

// POST /admin/sync
// Body: { setCode }
// Syncs a single set fully.
// POST /admin/sync
// Body: { setCode, updatePrices = true, updateInfo = true }
// Syncs a single set fully.
router.post('/sync', async (req, res) => {
    const { setCode, updatePrices = true, updateInfo = true } = req.body;
    if (!setCode) return res.status(400).json({ error: 'setCode is required' });

    console.log(`[Admin] Starting Sync for Set: ${setCode} (Prices: ${updatePrices}, Info: ${updateInfo})`);

    try {
        let hasMore = true;
        let url = `https://api.scryfall.com/cards/search?q=set:${setCode}&unique=prints`;
        let count = 0;
        let page = 1;
        let updatedUserCards = 0;

        const typeStats = {
            creature: 0,
            instant: 0,
            sorcery: 0,
            enchantment: 0,
            artifact: 0,
            land: 0,
            planeswalker: 0,
            other: 0
        };

        const countType = (typeLine) => {
            if (!typeLine) return;
            const t = typeLine.toLowerCase();
            if (t.includes('creature')) typeStats.creature++;
            else if (t.includes('instant')) typeStats.instant++;
            else if (t.includes('sorcery')) typeStats.sorcery++;
            else if (t.includes('enchantment')) typeStats.enchantment++;
            else if (t.includes('artifact')) typeStats.artifact++;
            else if (t.includes('land')) typeStats.land++;
            else if (t.includes('planeswalker')) typeStats.planeswalker++;
            else typeStats.other++;
        };

        while (hasMore) {
            console.log(`[Admin] Fetching page ${page} for ${setCode}...`);
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 429) {
                    console.log('[Admin] Rate limited, waiting 5s...');
                    await wait(5000);
                    continue;
                }
                if (response.status === 404) {
                    console.log(`[Admin] Set ${setCode} not found or empty.`);
                    break;
                }
                throw new Error(`Scryfall API Error: ${response.status}`);
            }

            const data = await response.json();
            const cards = data.data || [];

            await knex.transaction(async (trx) => {
                for (const cardData of cards) {
                    const scryfallId = cardData.id;
                    countType(cardData.type_line);

                    // 1. Update Reference Table (cards)
                    // If updateInfo is true, we upsert everything.
                    // If updateInfo is false but updatePrices is true, we ONLY update prices if exists.

                    let existingId = null;
                    const existingIdent = await trx('cardidentifiers').where({ scryfallid: scryfallId }).first();
                    if (existingIdent) existingId = existingIdent.uuid;
                    else {
                        const c = await trx('cards').where({ uuid: scryfallId }).first();
                        if (c) existingId = c.uuid;
                    }

                    if (existingId) {
                        // Update existing
                        const updates = {};
                        if (updateInfo) {
                            updates.data = cardData;
                            updates.name = cardData.name;
                            updates.setcode = cardData.set;
                            updates.number = cardData.collector_number;
                        } else if (updatePrices) {
                            // Fetch current data to merge prices safely? 
                            // Actually, jsonb_set logic is better, or just merge here
                            // We can just update specific fields in the JSON if we want, but knex json handling varies.
                            // Simpler: Fetch, merge, save.
                            const current = await trx('cards').where({ uuid: existingId }).first();
                            if (current && current.data) {
                                updates.data = { ...current.data, prices: cardData.prices };
                            }
                        }

                        if (Object.keys(updates).length > 0) {
                            await trx('cards').where({ uuid: existingId }).update(updates);
                        }

                    } else if (updateInfo) {
                        // Insert new (only if info update allowed, or maybe always insert new cards?)
                        // Let's assume we always want to discover new cards.
                        const [inserted] = await trx('cards').insert({
                            uuid: scryfallId,
                            name: cardData.name,
                            setcode: cardData.set,
                            number: cardData.collector_number,
                            data: cardData,
                            type: cardData.type_line,
                            manacost: cardData.mana_cost,
                            text: cardData.oracle_text
                        }).returning('*');

                        await trx('cardidentifiers').insert({
                            uuid: inserted.uuid,
                            scryfallid: scryfallId
                        });
                    }

                    // 2. Propagate to User Collections (user_cards)
                    // If prices changed, we MUST update all user_cards that link to this scryfall_id
                    if (updatePrices) {
                        // Postgres JSONB update: set data->'prices' = newPrices
                        // This updates ALL users who have this card.
                        const result = await trx('user_cards')
                            .where({ scryfall_id: scryfallId })
                            .update({
                                data: knex.raw(`jsonb_set(data, '{prices}', ?::jsonb)`, [JSON.stringify(cardData.prices)])
                            });
                        updatedUserCards += result;
                    }
                }
            });

            count += cards.length;
            hasMore = data.has_more;
            url = data.next_page;
            page++;

            await wait(100);
        }

        console.log(`[Admin] Sync Complete for ${setCode}. Processed ${count} cards. Updated ${updatedUserCards} user instances.`);
        res.json({ success: true, count, set: setCode, typeStats, updatedUserCards });

    } catch (err) {
        console.error('[Admin] Sync Error', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
