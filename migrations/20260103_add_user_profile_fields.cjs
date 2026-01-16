/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('users', t => {
        t.string('username').unique().nullable();
        t.string('first_name').nullable();
        t.string('last_name').nullable();
        t.boolean('is_public_library').defaultTo(false);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('users', t => {
        t.dropColumn('username');
        t.dropColumn('first_name');
        t.dropColumn('last_name');
    });
}
