
import { knex } from '../server/db.js';

async function deduplicate() {
    console.log('Starting deduplication...');

    try {
        // 1. Identify duplicates
        // distinct groups by: user_id, set_code, collector_number, finish, deck_id, is_wishlist
        // We exclude binder_id for now or include it? If they are in different binders, are they duplicates?
        // Probably yes, but if binder logic separates them physically, maybe not.
        // Let's matching STRICTLY for now: if they are in different binders, they are different entries.
        // IF binder_id is null for both, they are dupes.

        // We'll fetch all cards and process in memory for safety vs complex SQL group by
        const allCards = await knex('user_cards').select('*');
        console.log(`Fetched ${allCards.length} total cards.`);

        const groups = new Map();

        for (const card of allCards) {
            // Create a unique key for "identity"
            const deckKey = card.deck_id || 'nodeck';
            const binderKey = card.binder_id || 'nobinder';
            const key = `${card.user_id}|${card.set_code}|${card.collector_number}|${card.finish}|${deckKey}|${binderKey}|${card.is_wishlist}`;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(card);
        }

        let dupesFound = 0;
        let cardsRemoved = 0;

        for (const [key, cards] of groups.entries()) {
            if (cards.length > 1) {
                dupesFound++;

                // Sort by ID to keep the oldest (stable) or newest? 
                // Usually oldest ID is better to keep permalinks if any.
                // BUT newest might have better scryfall_id?
                // Left's keep OLDEST id.
                cards.sort((a, b) => a.id - b.id);

                const primary = cards[0];
                const duplicates = cards.slice(1);

                console.log(`Merging ${duplicates.length} duplicates for ${primary.name} (Set: ${primary.set_code} #${primary.collector_number})...`);

                let totalCount = parseInt(primary.count || 1);
                let allTags = new Set(Array.isArray(primary.tags) ? primary.tags : JSON.parse(primary.tags || '[]'));

                for (const d of duplicates) {
                    totalCount += parseInt(d.count || 1);
                    const dTags = Array.isArray(d.tags) ? d.tags : JSON.parse(d.tags || '[]');
                    dTags.forEach(t => allTags.add(t));
                }

                // Update Primary
                await knex('user_cards').where({ id: primary.id }).update({
                    count: totalCount,
                    tags: JSON.stringify([...allTags])
                });

                // Delete Duplicates
                const dupIds = duplicates.map(d => d.id);
                await knex('user_cards').whereIn('id', dupIds).del();

                cardsRemoved += dupIds.length;
            }
        }

        console.log(`Deduplication complete.`);
        console.log(`Groups processed: ${groups.size}`);
        console.log(`Duplicate groups found: ${dupesFound}`);
        console.log(`Extra rows removed: ${cardsRemoved}`);

    } catch (e) {
        console.error('Deduplication failed:', e);
    } finally {
        process.exit(0);
    }
}

deduplicate();
