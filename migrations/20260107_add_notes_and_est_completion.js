/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const hasNotes = await knex.schema.hasTable('ticket_notes');
    if (!hasNotes) {
        await knex.schema.createTable('ticket_notes', function (table) {
            table.increments('id').primary();
            table.integer('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
            table.integer('user_id').notNullable().references('id').inTable('users').onDelete('SET NULL');
            table.text('note').notNullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }

    return knex.schema.table('tickets', function (table) {
        table.timestamp('est_completion_date').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        .dropTableIfExists('ticket_notes')
        .table('tickets', function (table) {
            table.dropColumn('est_completion_date');
        });
};
