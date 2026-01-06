export async function up(knex) {
    // 1. Create precons table
    const hasPrecons = await knex.schema.hasTable('precons');
    if (!hasPrecons) {
        await knex.schema.createTable('precons', (table) => {
            table.increments('id').primary();
            table.string('firestore_id').unique(); // Optional, for legacy sync
            table.string('name').notNullable();
            table.jsonb('data').notNullable(); // Stores the full deck definition
            table.timestamps(true, true);
        });
    }

    // 2. Add tags to user_decks
    const hasTags = await knex.schema.hasColumn('user_decks', 'tags');
    if (!hasTags) {
        await knex.schema.table('user_decks', (table) => {
            table.jsonb('tags').defaultTo('[]');
        });
    }
}

export async function down(knex) {
    const hasTags = await knex.schema.hasColumn('user_decks', 'tags');
    if (hasTags) {
        await knex.schema.table('user_decks', (table) => {
            table.dropColumn('tags');
        });
    }

    // We might not want to drop precons if it contains data we want to keep, 
    // but for true rollback:
    await knex.schema.dropTableIfExists('precons');
}
