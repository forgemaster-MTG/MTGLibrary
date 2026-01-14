/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        .createTable('epics', function (table) {
            table.increments('id').primary();
            table.string('title').notNullable();
            table.text('description');
            table.enu('status', ['active', 'completed', 'archived']).defaultTo('active');
            table.integer('priority_order').defaultTo(0);
            table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('tickets', function (table) {
            table.increments('id').primary();
            table.integer('epic_id').references('id').inTable('epics').onDelete('SET NULL');
            table.enu('type', ['bug', 'feature']).notNullable();
            table.string('title').notNullable();
            table.text('description');
            table.enu('status', ['open', 'planned', 'in_progress', 'completed', 'wont_fix']).defaultTo('open');
            table.enu('priority', ['low', 'medium', 'high', 'critical']).defaultTo('medium');
            table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
            table.integer('assigned_to').references('id').inTable('users').onDelete('SET NULL');
            table.integer('votes').defaultTo(0);
            table.timestamp('due_date').nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        .dropTableIfExists('tickets')
        .dropTableIfExists('epics');
};
