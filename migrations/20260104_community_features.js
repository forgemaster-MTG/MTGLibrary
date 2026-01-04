/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    return knex.schema
        .createTable('user_relationships', function (table) {
            table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
            // users.id is INTEGER, so we must match it
            table.integer('requester_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
            table.integer('addressee_id').unsigned().references('id').inTable('users').onDelete('CASCADE');

            table.string('status').notNullable().defaultTo('pending'); // 'pending', 'accepted', 'blocked'
            table.timestamps(true, true);

            // Ensure unique relationship pair
            table.unique(['requester_id', 'addressee_id']);
        })
        .createTable('collection_permissions', function (table) {
            table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
            // users.id is INTEGER
            table.integer('owner_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
            table.integer('grantee_id').unsigned().references('id').inTable('users').onDelete('CASCADE');

            table.string('permission_level').notNullable().defaultTo('viewer'); // 'viewer', 'contributor', 'editor', 'admin'

            // user_decks.id IS UUID (from 20251221_update_user_schema.js)
            table.uuid('target_deck_id').nullable().references('id').inTable('user_decks').onDelete('CASCADE');

            table.timestamps(true, true);
        })
        .table('user_decks', function (table) {
            table.boolean('is_public').defaultTo(false);
            table.string('share_slug').unique().nullable();
        });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    return knex.schema
        .table('user_decks', function (table) {
            table.dropColumn('share_slug');
            table.dropColumn('is_public');
        })
        .dropTable('collection_permissions')
        .dropTable('user_relationships');
}
