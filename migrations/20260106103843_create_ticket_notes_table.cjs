
exports.up = function (knex) {
    return knex.schema.createTable('ticket_notes', (table) => {
        table.increments('id').primary();
        table.integer('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
        table.integer('user_id').notNullable().references('id').inTable('users');
        table.text('note').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('ticket_notes');
};
