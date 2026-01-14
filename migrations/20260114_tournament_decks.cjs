
exports.up = function (knex) {
    return knex.schema.table('tournament_participants', function (table) {
        table.uuid('deck_id').references('id').inTable('user_decks').onDelete('SET NULL');
        table.jsonb('deck_snapshot').nullable().comment('Snapshot of the deck at the time of joining');
    });
};

exports.down = function (knex) {
    return knex.schema.table('tournament_participants', function (table) {
        table.dropColumn('deck_snapshot');
        table.dropColumn('deck_id');
    });
};
