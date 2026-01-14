/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .createTable('tournaments', function (table) {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.integer('organizer_id').references('id').inTable('users'); // Assuming users.id is integer
            table.string('name').notNullable();
            table.string('format').defaultTo('swiss');
            table.string('status').defaultTo('pending'); // pending, active, completed
            table.integer('current_round').defaultTo(0);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('tournament_participants', function (table) {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('tournament_id').references('id').inTable('tournaments').onDelete('CASCADE');
            table.integer('user_id').references('id').inTable('users').nullable();
            table.string('guest_name').nullable();
            table.integer('score').defaultTo(0);
            table.integer('wins').defaultTo(0);
            table.integer('losses').defaultTo(0);
            table.integer('draws').defaultTo(0);
        })
        .createTable('tournament_pairings', function (table) {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('tournament_id').references('id').inTable('tournaments').onDelete('CASCADE');
            table.integer('round_number').notNullable();
            table.uuid('player1_id').references('id').inTable('tournament_participants');
            table.uuid('player2_id').references('id').inTable('tournament_participants').nullable(); // Null for Bye
            table.uuid('winner_id').references('id').inTable('tournament_participants').nullable();
            table.boolean('is_draw').defaultTo(false);
            table.integer('table_number');
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('tournament_pairings')
        .dropTableIfExists('tournament_participants')
        .dropTableIfExists('tournaments');
};
