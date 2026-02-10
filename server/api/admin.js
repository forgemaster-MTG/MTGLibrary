import express from 'express';
import { knex } from '../db.js';

import { syncUserToFirestore } from '../utils/firestoreSync.js';

const router = express.Router();

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// POST /admin/sync-user
// Body: { userId }
// Syncs a specific user's collection to Firestore
router.post('/sync-user', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'UserID is required' });

    try {
        const result = await syncUserToFirestore(userId);
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (err) {
        console.error('[Admin] Sync User Error', err);
        res.status(500).json({ error: err.message });
    }
});


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


import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

// POST /admin/precons/upload
router.post('/precons/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const jsonString = req.file.buffer.toString('utf8');
        let rawData;
        try {
            rawData = JSON.parse(jsonString);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON file' });
        }

        // Handle MTGJSON structure (data wrapper) or direct object
        const deckPayload = rawData.data || rawData;

        // Determine Name
        let name = deckPayload.name;
        if (!name && req.file.originalname) {
            name = req.file.originalname.replace(/\.json$/i, '').replace(/_/g, ' ');
        }
        if (!name) name = 'Untitled Precon';

        // Determine Code/Set
        const setCode = deckPayload.code || deckPayload.set_code || deckPayload.meta?.set_code || 'UNK';

        // Generate stable ID
        const firestoreId = `precon_${setCode}_${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

        // Determine Release Date
        let releaseDate = deckPayload.releaseDate || (rawData.meta && rawData.meta.date) || null;
        if (releaseDate) {
            // Ensure YYYY-MM-DD format if possible
            try {
                const d = new Date(releaseDate);
                if (!isNaN(d.getTime())) {
                    releaseDate = d.toISOString().split('T')[0];
                }
            } catch (e) {
                console.warn('[Admin] Failed to parse release date:', releaseDate);
            }
        }

        // Aggregate Cards to calculate stats and prepare for insert
        const allCards = [];
        const processCards = (list, zone) => {
            if (!Array.isArray(list)) return;
            list.forEach(c => {
                allCards.push({ ...c, zone });
            });
        };

        processCards(deckPayload.commander, 'commander');
        processCards(deckPayload.mainBoard, 'mainBoard');
        processCards(deckPayload.sideBoard, 'sideBoard');

        const cardCount = allCards.reduce((acc, c) => acc + (c.count || 1), 0);

        // Derive colors from commander or cards
        let colors = deckPayload.colorIdentity || []; // if top level
        if (!colors.length || colors.length === 0) {
            // infer from commander cards
            const commanders = allCards.filter(c => c.zone === 'commander');
            const colorSet = new Set();
            commanders.forEach(c => {
                if (c.colorIdentity) c.colorIdentity.forEach(color => colorSet.add(color));
                else if (c.colors) c.colors.forEach(color => colorSet.add(color));
            });
            colors = Array.from(colorSet);
        }

        // Pick Image
        let imageUri = null;
        const cmd = allCards.find(c => c.zone === 'commander');
        if (cmd && cmd.identifiers && cmd.identifiers.scryfallId) {
            // We might effectively need to fetch this if we want the actual image URL now, 
            // OR we rely on the frontend/db resolving it later. 
            // But `precons` table usually stores a cache `image_uri`.
            // Let's see if we can get it from identifiers or if we leave it null.
            // The sample JSON doesn't have image URIs directly, only identifiers.
            // We will leave it null, or if we have it in our DB, we could query it.
            // For now, let's leave valid image_uri logic if we can, otherwise null.
            // We'll update it separately or let frontend handle it.
        }

        const commanderName = cmd ? cmd.name : null;

        await knex.transaction(async (trx) => {
            // 1. Insert Precon
            await trx('precons').insert({
                firestore_id: firestoreId,
                name: name,
                set_code: setCode,
                type: deckPayload.type || 'Commander',
                card_count: cardCount,
                colors: JSON.stringify(colors),
                commander_name: commanderName,
                release_date: releaseDate,
                data: JSON.stringify(deckPayload), // Store original full data
                created_at: new Date(),
                updated_at: new Date()
            }).onConflict('firestore_id').merge();

            // Get the integer ID of the inserted/updated precon
            const preconRecord = await trx('precons').where({ firestore_id: firestoreId }).first();
            const preconId = preconRecord.id;

            // 2. Clear existing cards for this precon (replace logic)
            await trx('precon_cards').where({ precon_id: preconId }).del();

            // 3. Insert Cards
            if (allCards.length > 0) {
                // Batch insert?
                const rows = allCards.map(c => ({
                    precon_id: preconId,
                    scryfall_id: c.identifiers?.scryfallId || c.uuid || null, // Ensure explicitly null if missing
                    // quantity is the correct column name
                    quantity: c.count || 1,
                    zone: c.zone,
                    card_name: c.name,
                    set_code: c.setCode,
                    collector_number: c.number,
                    finish: (c.finishes && c.finishes[0]) || 'nonfoil'
                }));

                // Chunking to be safe
                const CHUNK_SIZE = 100;
                for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                    await trx('precon_cards').insert(rows.slice(i, i + CHUNK_SIZE));
                }
            }
        });

        res.json({ success: true, firestoreId, name, cardCount });

    } catch (err) {
        console.error('[Admin] Upload Precon Error', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /admin/invitations
// List all external invitations
router.get('/invitations', async (req, res) => {
    try {
        const invitations = await knex('pending_external_invitations')
            .join('users', 'pending_external_invitations.inviter_id', '=', 'users.id')
            .select(
                'pending_external_invitations.*',
                'users.username as inviter_username',
                'users.email as inviter_email'
            )
            .orderBy('created_at', 'desc');
        res.json(invitations);
    } catch (err) {
        console.error('[Admin] Get Invitations Error', err);
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});

// DELETE /admin/invitations/:id
// Delete/Reset an invitation
router.delete('/invitations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await knex('pending_external_invitations').where({ id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error('[Admin] Delete Invitation Error', err);
        res.status(500).json({ error: 'Failed to delete invitation' });
    }
});


import { PricingService } from '../services/PricingService.js';

// GET /admin/pricing
// Fetch current pricing config
router.get('/pricing', async (req, res) => {
    try {
        const config = await PricingService.getConfig();
        const analysis = PricingService.calculateStats(config);
        res.json({ config, analysis });
    } catch (err) {
        console.error('[Admin] Get Pricing Error', err);
        res.status(500).json({ error: 'Failed to fetch pricing config' });
    }
});

// POST /admin/pricing
// Save new pricing config
router.post('/pricing', async (req, res) => {
    try {
        const { config } = req.body;

        // Optional: Re-validate by calculating stats
        // const stats = PricingService.calculateStats(config);
        // if (stats.tiers.some(t => t.metrics.aiBudget < 0)) ... warning?

        const saved = await PricingService.saveConfig(config);
        res.json({ success: true, config: saved });
    } catch (err) {
        console.error('[Admin] Save Pricing Error', err);
        res.status(500).json({ error: 'Failed to save pricing config' });
    }
});

export default router;

