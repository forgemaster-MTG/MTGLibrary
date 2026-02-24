import { knex } from '../db.js';

async function up() {
    console.log('Checking ai_personas table...');

    const exists = await knex.schema.hasTable('ai_personas');

    if (!exists) {
        console.log('Creating ai_personas table...');
        await knex.schema.createTable('ai_personas', table => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.string('name').notNullable();
            table.string('type').notNullable();
            table.text('personality').notNullable();
            table.decimal('price_usd', 8, 2).notNullable().defaultTo(0.00); // 0.00 for free
            table.text('avatar_url').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });

        console.log('Inserting default persona...');
        await knex('ai_personas').insert({
            name: 'The Oracle',
            type: 'Helper Construct',
            personality: 'Wise, analytical, and highly knowledgeable about Magic: The Gathering rules and strategies. Speaks with a slightly formal and mysterious tone.',
            price_usd: 0.00,
            avatar_url: null, // Will use default icon or we can generate one
            is_active: true
        });

    } else {
        console.log('ai_personas table already exists.');
    }

    console.log('Migration complete.');
    process.exit(0);
}

up().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
