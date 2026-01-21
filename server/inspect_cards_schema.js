
import { knex } from './db.js';

async function inspect() {
    try {
        const columnInfo = await knex('cards').columnInfo();
        console.log('cards schema:', JSON.stringify(columnInfo, null, 2));

        const sample = await knex('cards').first();
        console.log('sample card:', JSON.stringify(sample, null, 2));
    } catch (e) {
        console.error('Error inspecting cards:', e);
    } finally {
        process.exit();
    }
}

inspect();
