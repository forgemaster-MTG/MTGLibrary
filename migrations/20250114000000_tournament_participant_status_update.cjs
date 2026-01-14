
exports.up = function (knex) {
    return knex.schema.table('tournament_participants', function (table) {
        table.boolean('is_active').defaultTo(true);
    });
};

exports.down = function (knex) {
    return knex.schema.table('tournament_participants', function (table) {
        table.dropColumn('is_active');
    });
};
