
import { knex } from '../server/db.js';

async function run() {
    try {
        const setCode = 'MH3';
        const number = '239'; // Witch Enchanter

        console.log(`Checking cards table for ${setCode} #${number}...`);

        const cards = await knex('cards')
            .whereRaw('lower(setcode) = ?', [setCode.toLowerCase()])
            .where({ number: number })
            .select('id', 'name', 'setcode', 'number');

        console.log(`Found ${cards.length} matches in 'cards' table:`);
        console.table(cards);

        if (cards.length > 1) {
            console.log('DUPLICATES DETECTED! This explains the audit item duplication.');
        } else {
            console.log('No duplicates found in `cards` table. Issue might be elsewhere.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await knex.destroy();
    }
}

run();
