/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .createTable('audit_sessions', function (table) {
            table.increments('id').primary();
            table.integer('user_id'); // Simplify for now, usually FK to users
            table.text('type').notNullable().checkIn(['collection', 'binder', 'deck', 'set']);
            table.string('target_id', 255); // binder_id, deck_id, set_code
            table.text('status').defaultTo('active').checkIn(['active', 'completed', 'applied', 'expired', 'cancelled']);
            table.timestamp('expires_at').notNullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        })
        .createTable('audit_items', function (table) {
            table.increments('id').primary();
            table.integer('audit_id').references('id').inTable('audit_sessions').onDelete('CASCADE');
            table.string('card_id', 255); // Scryfall ID
            table.string('name', 255);
            table.string('set_code', 10);
            table.string('collector_number', 50);
            table.integer('expected_qty').defaultTo(0);
            table.integer('scanned_qty').defaultTo(0);
            table.timestamp('last_scanned_at');
            // 'status' derived: missing, matched, extra
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .dropTable('audit_items')
        .dropTable('audit_sessions');
};
