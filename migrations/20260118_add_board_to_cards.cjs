
exports.up = function (knex) {
    return knex.schema.table('user_cards', function (table) {
        table.string('board').defaultTo('mainboard');
        // valid values: 'mainboard', 'sideboard', 'maybeboard'
    });
};

exports.down = function (knex) {
    return knex.schema.table('user_cards', function (table) {
        table.dropColumn('board');
    });
};
