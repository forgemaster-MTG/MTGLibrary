/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('user_decks', function (t) {
        t.jsonb('ai_blueprint').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('user_decks', function (t) {
        t.dropColumn('ai_blueprint');
    });
};
