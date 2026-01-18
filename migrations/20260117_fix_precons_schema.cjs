
exports.up = function (knex) {
    return knex.schema.table('precons', function (table) {
        table.string('firestore_id').unique().nullable();
        table.jsonb('data').nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.table('precons', function (table) {
        table.dropColumn('firestore_id');
        table.dropColumn('data');
    });
};
