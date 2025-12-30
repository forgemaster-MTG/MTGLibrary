export const up = function (knex) {
    return knex.schema.table('user_decks', function (table) {
        table.jsonb('commander_partner').nullable();
    });
};

export const down = function (knex) {
    return knex.schema.table('user_decks', function (table) {
        table.dropColumn('commander_partner');
    });
};
