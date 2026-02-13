/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('users', (table) => {
        // Remove the default value and set existing records to null
        table.timestamp('last_active_at').defaultTo(null).alter();
    }).then(() => {
        return knex('users').update({ last_active_at: null });
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('users', (table) => {
        table.timestamp('last_active_at').defaultTo(knex.fn.now()).alter();
    });
};
