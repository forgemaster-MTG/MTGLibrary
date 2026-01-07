/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('tickets', function (table) {
        table.timestamp('date_released').nullable();
        table.timestamp('estimated_release_date').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('tickets', function (table) {
        table.dropColumn('date_released');
        table.dropColumn('estimated_release_date');
    });
};
