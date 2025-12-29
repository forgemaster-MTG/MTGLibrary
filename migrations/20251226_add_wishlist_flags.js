/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        .table('user_cards', function (t) {
            t.boolean('is_wishlist').defaultTo(false);
        })
        .table('user_decks', function (t) {
            t.boolean('is_mockup').defaultTo(false);
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        .table('user_cards', function (t) {
            t.dropColumn('is_wishlist');
        })
        .table('user_decks', function (t) {
            t.dropColumn('is_mockup');
        });
};
