import { knex } from '../db.js';

async function up() {
    console.log('Checking binders table for new columns...');

    const hasPublic = await knex.schema.hasColumn('binders', 'is_public');
    const hasTrade = await knex.schema.hasColumn('binders', 'is_trade');

    if (!hasPublic) {
        console.log('Adding is_public column...');
        await knex.schema.table('binders', table => {
            table.boolean('is_public').defaultTo(false);
        });
    } else {
        console.log('is_public column already exists.');
    }

    if (!hasTrade) {
        console.log('Adding is_trade column...');
        await knex.schema.table('binders', table => {
            table.boolean('is_trade').defaultTo(false);
        });
    } else {
        console.log('is_trade column already exists.');
    }

    console.log('Migration complete.');
    process.exit(0);
}

up().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
