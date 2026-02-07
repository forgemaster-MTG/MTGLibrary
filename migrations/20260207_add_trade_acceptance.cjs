
exports.up = function (knex) {
    return knex.schema.table('trades', function (table) {
        table.boolean('initiator_accepted').defaultTo(false);
        table.boolean('receiver_accepted').defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.table('trades', function (table) {
        table.dropColumn('initiator_accepted');
        table.dropColumn('receiver_accepted');
    });
};
