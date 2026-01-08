/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        .createTable('releases', (table) => {
            table.increments('id').primary();
            table.string('version').notNullable();
            table.timestamp('released_at').defaultTo(knex.fn.now());
            table.text('notes');
            table.jsonb('stats'); // { features: 0, bugs: 0, etc }
            table.timestamps(true, true);
        })
        .table('tickets', (table) => {
            table.integer('release_id').references('id').inTable('releases').onDelete('SET NULL');
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        .table('tickets', (table) => {
            table.dropColumn('release_id');
        })
        .dropTable('releases');
};
