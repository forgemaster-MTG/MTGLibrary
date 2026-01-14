/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('audit_items', function (table) {
        table.string('deck_id').nullable(); // To track which deck the card belongs to in snapshot
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('audit_items', function (table) {
        table.dropColumn('deck_id');
    });
};
