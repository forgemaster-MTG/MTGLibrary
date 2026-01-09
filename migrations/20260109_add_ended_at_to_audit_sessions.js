/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('audit_sessions', function (table) {
        table.timestamp('ended_at').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('audit_sessions', function (table) {
        table.dropColumn('ended_at');
    });
};
