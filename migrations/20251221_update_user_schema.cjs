/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        .createTable('user_decks', function (t) {
            t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            t.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
            t.string('firestore_id').nullable(); // For mapping during migration
            t.string('name').notNullable();
            t.jsonb('commander').nullable(); // Entire commander card object
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
        })
        .createTable('user_cards', function (t) {
            t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            t.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
            t.uuid('deck_id').nullable().references('id').inTable('user_decks').onDelete('SET NULL');

            // Link to the 'cards' table cache if possible, or just store IDs
            // 'cards' table has 'uuid' column which is the Scryfall UUID.
            // We'll store scryfall_id as a string. FK is optional if we trust the cache.
            t.string('scryfall_id').notNullable();

            t.string('name').notNullable(); // Denormalized for easier query
            t.string('set_code').notNullable();
            t.string('collector_number').notNullable();
            t.string('finish').defaultTo('nonfoil');
            t.string('image_uri').nullable();

            t.integer('count').defaultTo(1);
            t.jsonb('data').nullable(); // Snapshot of card data

            t.timestamp('added_at').defaultTo(knex.fn.now());

            // Indexes for performance
            t.index(['user_id']);
            t.index(['deck_id']);
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        .dropTableIfExists('user_cards')
        .dropTableIfExists('user_decks');
};
