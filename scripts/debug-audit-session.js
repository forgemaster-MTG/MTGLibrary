
import { knex } from '../server/db.js';

async function run() {
    try {
        console.log('Fetching latest audit session...');
        const session = await knex('audit_sessions')
            .orderBy('created_at', 'desc')
            .first();

        if (!session) {
            console.log('No audit sessions found.');
            return;
        }

        console.log(`Latest Session ID: ${session.id}, Type: ${session.type}, Status: ${session.status}`);

        const setCode = 'TLA';
        console.log(`Checking items for set "${setCode}" in session ${session.id}...`);

        const totalItems = await knex('audit_items')
            .where({ session_id: session.id })
            .count('* as count')
            .first();

        console.log(`Total items in session: ${totalItems.count}`);

        const setItems = await knex('audit_items')
            .where({ session_id: session.id })
            .whereRaw('lower(set_code) = ?', [setCode.toLowerCase()])
            .select('set_code', 'deck_id', 'expected_quantity');

        console.log(`Found ${setItems.length} items for set ${setCode}:`);

        let looseCount = 0;
        let deckCount = 0;
        const setCodeVariants = new Set();

        setItems.forEach(item => {
            setCodeVariants.add(item.set_code);
            if (item.deck_id) deckCount++;
            else looseCount++;
        });

        console.log(`- Variants found: ${Array.from(setCodeVariants).join(', ')}`);
        console.log(`- In Decks: ${deckCount}`);
        console.log(`- Loose: ${looseCount}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await knex.destroy();
    }
}

run();
