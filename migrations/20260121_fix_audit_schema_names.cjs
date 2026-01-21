
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasSessionId = await knex.schema.hasColumn('audit_items', 'session_id');
    const hasAuditId = await knex.schema.hasColumn('audit_items', 'audit_id');

    await knex.schema.alterTable('audit_items', (table) => {
        // Rename session_id -> audit_id
        if (hasSessionId && !hasAuditId) {
            table.renameColumn('session_id', 'audit_id');
        }

        // Rename quantities
        // We check existence inside the alter block logic usually, but renameColumn is simpler if we know state.
        // relying on the previous schema inspection:
        // expected_quantity -> expected_qty
        // actual_quantity -> scanned_qty
    });

    // Check and rename other columns individually to be safe or use separate calls
    const hasExpQ = await knex.schema.hasColumn('audit_items', 'expected_quantity');
    if (hasExpQ) {
        await knex.schema.alterTable('audit_items', t => t.renameColumn('expected_quantity', 'expected_qty'));
    }

    const hasActQ = await knex.schema.hasColumn('audit_items', 'actual_quantity');
    if (hasActQ) {
        await knex.schema.alterTable('audit_items', t => t.renameColumn('actual_quantity', 'scanned_qty'));
    }

    const hasCardId = await knex.schema.hasColumn('audit_items', 'card_id');
    if (!hasCardId) {
        await knex.schema.alterTable('audit_items', t => t.string('card_id').nullable());
    }

};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // Reverting is hard because we don't want to go back to "wrong" names usually, 
    // but for completeness:
    const hasAuditId = await knex.schema.hasColumn('audit_items', 'audit_id');
    if (hasAuditId) {
        await knex.schema.alterTable('audit_items', t => t.renameColumn('audit_id', 'session_id'));
    }

    const hasExp = await knex.schema.hasColumn('audit_items', 'expected_qty');
    if (hasExp) {
        await knex.schema.alterTable('audit_items', t => t.renameColumn('expected_qty', 'expected_quantity'));
    }

    const hasScan = await knex.schema.hasColumn('audit_items', 'scanned_qty');
    if (hasScan) {
        await knex.schema.alterTable('audit_items', t => t.renameColumn('scanned_qty', 'actual_quantity'));
    }

    const hasCardId = await knex.schema.hasColumn('audit_items', 'card_id');
    if (hasCardId) {
        await knex.schema.alterTable('audit_items', t => t.dropColumn('card_id'));
    }
};
