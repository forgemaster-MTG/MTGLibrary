import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Helper to chunk array
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

// POST /api/sync/prices
// Triggers a sequential update of all cards in the user's collection
router.post('/prices', async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get targets for sync (including set/number for fallback healing)
        const syncTargets = await knex('user_cards')
            .where({ user_id: userId })
            .whereNotNull('scryfall_id')
            .distinct('scryfall_id', 'set_code', 'collector_number');

        if (syncTargets.length === 0) {
            return res.json({ message: 'Collection is empty, nothing to sync.', count: 0 });
        }

        // 2. Chunk into batches of 75 (Scryfall limit)
        const batches = chunk(syncTargets, 75);
        let processedCount = 0;
        let updatedCount = 0;
        let healedCount = 0;

        console.log(`[Sync] Starting price sync for user ${userId}. Total targets: ${syncTargets.length}, Batches: ${batches.length}`);

        // 3. Process sequentially
        const v4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        for (const [index, batchTargets] of batches.entries()) {
            console.log(`[Sync] Processing batch ${index + 1}/${batches.length}...`);

            try {
                // Prepare identifiers (Healing suspect IDs by falling back to set/number)
                const identifiers = batchTargets.map(t => {
                    if (v4Regex.test(t.scryfall_id)) {
                        return { id: t.scryfall_id };
                    } else {
                        console.log(`[Sync] Suspect ID detected: ${t.scryfall_id}. Falling back to set/number: ${t.set_code}/${t.collector_number}`);
                        return { set: t.set_code.toLowerCase(), collector_number: t.collector_number };
                    }
                });

                const payload = { identifiers };

                const response = await fetch('https://api.scryfall.com/cards/collection', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'MTGForge/1.0'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    let errorDetail = '';
                    try {
                        const errJson = await response.json();
                        errorDetail = JSON.stringify(errJson);
                    } catch (e) {
                        errorDetail = await response.text();
                    }
                    console.error(`[Sync] Scryfall batch ${index + 1} failed: ${response.status} ${response.statusText}. Details: ${errorDetail}`);
                    continue; // Skip this batch, try next
                }

                const data = await response.json();
                const scryfallCards = data.data || [];

                // 4. Update DB
                await knex.transaction(async (trx) => {
                    for (const cardData of scryfallCards) {
                        const newId = cardData.id;
                        const setCode = cardData.set.toUpperCase();
                        const collNum = cardData.collector_number;

                        // A. Update global reference 'cards' table
                        // We search by set/number to ensure we catch "mis-ID'd" cards (healing)
                        const refCard = await trx('cards').where({ setcode: setCode, number: collNum }).first();
                        if (refCard) {
                            const newData = { ...refCard.data, ...cardData };
                            const updateObj = { data: newData, uuid: newId };
                            await trx('cards').where({ id: refCard.id }).update(updateObj);
                        }

                        // B. Update 'user_cards' (Self-Healing)
                        // Find all rows for this user matching this set/number and update them with the fresh ID and data
                        const userRows = await trx('user_cards').where({
                            user_id: userId,
                            set_code: setCode,
                            collector_number: collNum
                        });

                        for (const row of userRows) {
                            const updatedRowData = { ...(row.data || {}), ...cardData };
                            const imageUri = cardData.image_uris?.normal || cardData.card_faces?.[0]?.image_uris?.normal || row.image_uri;

                            const updatePayload = {
                                scryfall_id: newId,
                                data: updatedRowData,
                                image_uri: imageUri
                            };

                            if (row.scryfall_id !== newId) {
                                console.log(`[Sync] HEALED: Updated ${row.name} from ID ${row.scryfall_id} -> ${newId}`);
                                healedCount++;
                            }

                            await trx('user_cards').where({ id: row.id }).update(updatePayload);
                            updatedCount++;
                        }
                    }
                });

                processedCount += scryfallCards.length;
                await new Promise(resolve => setTimeout(resolve, 100)); // Be nice to Scryfall

            } catch (err) {
                console.error(`[Sync] Error processing batch ${index + 1}:`, err);
            }
        }

        console.log(`[Sync] Completed. Target Cards: ${syncTargets.length}, Processed: ${processedCount}, Updated: ${updatedCount} rows, Healed: ${healedCount} IDs.`);
        res.json({ success: true, processed: processedCount, updated: updatedCount, healed: healedCount });

    } catch (err) {
        console.error('[Sync] Global error:', err);
        res.status(500).json({ error: 'Sync failed' });
    }
});

export default router;
