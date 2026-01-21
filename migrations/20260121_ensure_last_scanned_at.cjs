
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasCol = await knex.schema.hasColumn('audit_items', 'last_scanned_at');
    if (!hasCol) {
        await knex.schema.alterTable('audit_items', (table) => {
            table.timestamp('last_scanned_at').nullable();
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasCol = await knex.schema.hasColumn('audit_items', 'last_scanned_at');
    if (hasCol) {
        await knex.schema.alterTable('audit_items', (table) => {
            table.dropColumn('last_scanned_at');
        });
    }
};
