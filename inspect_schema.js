
import knex from 'knex';
import config from './knexfile.cjs';
import dotenv from 'dotenv';
dotenv.config();

const db = knex(config['development']);

async function inspect() {
    try {
        const row = await db('cards').first();
        console.log('Cards Row:', Object.keys(row));
        console.log('Sample Data:', row.data?.id);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
inspect();
