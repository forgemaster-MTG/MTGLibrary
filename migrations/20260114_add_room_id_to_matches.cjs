/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('matches', table => {
        table.string('room_id').nullable().unique(); // Unique identifier from the game session
        table.index('room_id');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.alterTable('matches', table => {
        table.dropIndex('room_id');
        table.dropColumn('room_id');
    });
};
