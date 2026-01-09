
import { knex } from '../server/db.js';

async function run() {
    const setCode = process.argv[2] || 'TLA';
    console.log(`Checking counts for set: "${setCode}"`);

    try {
        // 1. Total items in user_cards
        const total = await knex('user_cards')
            .whereRaw('lower(set_code) = ?', [setCode.toLowerCase()])
            .count('* as count')
            .first();

        // 2. Items in Decks (deck_id is NOT NULL)
        const inDecks = await knex('user_cards')
            .whereRaw('lower(set_code) = ?', [setCode.toLowerCase()])
            .whereNotNull('deck_id')
            .count('* as count')
            .first();

        // 3. Loose Items (deck_id IS NULL)
        const loose = await knex('user_cards')
            .whereRaw('lower(set_code) = ?', [setCode.toLowerCase()])
            .whereNull('deck_id')
            .count('* as count')
            .first();

        console.log(`----------------------------------------`);
        console.log(`Total "${setCode}" cards in user_cards: ${total.count}`);
        console.log(`In Decks: ${inDecks.count}`);
        console.log(`Loose (should be in Collection Audit): ${loose.count}`);
        console.log(`----------------------------------------`);

    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await knex.destroy();
    }
}

run();
