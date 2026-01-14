/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .createTable('friendships', function (table) {
            table.increments('id').primary();
            table.integer('user_id_1').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.integer('user_id_2').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.enum('status', ['pending', 'accepted', 'blocked']).defaultTo('pending');
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());

            // Ensure uniqueness and avoid duplicates (e.g. A-B and B-A)
            // We will enforce convention: user_id_1 < user_id_2 in application logic, 
            // but DB constraint helps too if we just enforce unique pair.
            // Simple unique constraint on the pair:
            table.unique(['user_id_1', 'user_id_2']);
        })
        .table('users', function (table) {
            table.boolean('lfg_status').defaultTo(false);
            table.timestamp('lfg_last_updated');
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .table('users', function (table) {
            table.dropColumn('lfg_last_updated');
            table.dropColumn('lfg_status');
        })
        .dropTable('friendships');
};
