/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('ticket_notes', (table) => {
        table.increments('id').primary();
        table.integer('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
        table.integer('user_id').notNullable().references('id').inTable('users');
        table.text('note').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTableIfExists('ticket_notes');
}
