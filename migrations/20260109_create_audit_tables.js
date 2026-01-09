/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        .createTable('audit_sessions', function (table) {
            table.increments('id').primary();
            table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
            table.enu('type', ['collection', 'binder', 'deck', 'set']).notNullable();
            table.string('target_id').nullable(); // String to support UUIDs or Set Codes
            table.enu('status', ['active', 'completed', 'applied', 'expired', 'cancelled']).defaultTo('active');
            table.timestamp('expires_at').notNullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        })
        .createTable('audit_items', function (table) {
            table.increments('id').primary();
            table.integer('session_id').references('id').inTable('audit_sessions').onDelete('CASCADE');
            table.string('name').notNullable();
            table.string('set_code').nullable();
            table.string('collector_number').nullable();
            table.string('finish').defaultTo('nonfoil'); // Added finish
            table.integer('expected_quantity').defaultTo(0);
            table.integer('actual_quantity').defaultTo(0);
            table.boolean('is_verified').defaultTo(false);

            // Index for faster lookups during audit

        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        .dropTableIfExists('audit_items')
        .dropTableIfExists('audit_sessions');
};
