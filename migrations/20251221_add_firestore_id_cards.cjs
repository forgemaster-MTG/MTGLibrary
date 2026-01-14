/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('user_cards', function (t) {
        t.string('firestore_id').nullable();
        t.index(['firestore_id']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('user_cards', function (t) {
        t.dropIndex(['firestore_id']);
        t.dropColumn('firestore_id');
    });
};
