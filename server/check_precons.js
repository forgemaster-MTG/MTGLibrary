
import { knex } from './db.js';

async function checkPrecons() {
    try {
        const sample = await knex('precons').select('id', 'name', 'release_date', 'set_code').limit(5);
        console.log('Sample Precons:', JSON.stringify(sample, null, 2));

        const count = await knex('precons').count('id as total').first();
        console.log('Total Precons:', count.total);

        const withDate = await knex('precons').whereNotNull('release_date').count('id as total').first();
        console.log('Precons with Release Date:', withDate.total);

        const latest = await knex('precons').orderBy('release_date', 'desc').limit(5);
        console.log('Latest Precons:', JSON.stringify(latest, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkPrecons();
