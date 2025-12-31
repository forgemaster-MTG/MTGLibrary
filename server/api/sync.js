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

        // 1. Get all unique Scryfall IDs from user's collection
        const userCards = await knex('user_cards')
            .where({ user_id: userId })
            .distinct('scryfall_id')
            .whereNotNull('scryfall_id');

        const allIds = userCards.map(c => c.scryfall_id);

        if (allIds.length === 0) {
            return res.json({ message: 'Collection is empty, nothing to sync.', count: 0 });
        }

        // 2. Chunk into batches of 75 (Scryfall limit)
        const batches = chunk(allIds, 75);
        let processedCount = 0;
        let updatedCount = 0;

        console.log(`[Sync] Starting price sync for user ${userId}. Total cards: ${allIds.length}, Batches: ${batches.length}`);

        // 3. Process sequentially
        for (const [index, batchIds] of batches.entries()) {
            console.log(`[Sync] Processing batch ${index + 1}/${batches.length}...`);

            try {
                // Prepare payload for Scryfall /cards/collection
                const payload = {
                    identifiers: batchIds.map(id => ({ id }))
                };

                const response = await fetch('https://api.scryfall.com/cards/collection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    console.error(`[Sync] Scryfall batch ${index + 1} failed: ${response.status} ${response.statusText}`);
                    continue; // Skip this batch, try next
                }

                const data = await response.json();
                const scryfallCards = data.data || [];

                // 4. Update DB
                // We do this in a transaction to ensure integrity per batch
                await knex.transaction(async (trx) => {
                    for (const cardData of scryfallCards) {
                        const sId = cardData.id;

                        // A. Update reference 'cards' table 'prices' (and other mutable fields)
                        // We check if it exists first (it should, but safety first)
                        const refExists = await trx('cards').where({ uuid: sId }).first();
                        if (refExists) {
                            // Merge new data into existing data JSON
                            const newData = { ...refExists.data, prices: cardData.prices };
                            await trx('cards').where({ uuid: sId }).update({
                                data: newData,
                                // Update pure columns if they exist and are relevant (like setcode? usually static)
                            });
                        }

                        // B. Update 'user_cards' cache
                        // Find all user_cards with this scryfall_id
                        const userRows = await trx('user_cards').where({ user_id: userId, scryfall_id: sId });
                        for (const row of userRows) {
                            // Merge new prices into cached data
                            const rowData = row.data || {};
                            const updatedRowData = { ...rowData, prices: cardData.prices };

                            // Also update image_uris if they changed (rare but possible)
                            if (cardData.image_uris) updatedRowData.image_uris = cardData.image_uris;

                            await trx('user_cards').where({ id: row.id }).update({
                                data: updatedRowData
                            });
                            updatedCount++;
                        }
                    }
                });

                processedCount += scryfallCards.length;

                // Wait 100ms between batches to be nice, even though we await
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (err) {
                console.error(`[Sync] Error processing batch ${index + 1}:`, err);
            }
        }

        console.log(`[Sync] Completed. Processed ${processedCount} cards from Scryfall. Updated ${updatedCount} user_cards rows.`);
        res.json({ success: true, processed: processedCount, updated: updatedCount });

    } catch (err) {
        console.error('[Sync] Global error:', err);
        res.status(500).json({ error: 'Sync failed' });
    }
});

export default router;
