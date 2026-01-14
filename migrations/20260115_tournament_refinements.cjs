
exports.up = function (knex) {
    return knex.schema.alterTable('tournament_participants', table => {
        table.boolean('is_active').defaultTo(true);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('tournament_participants', table => {
        table.dropColumn('is_active');
    });
};
