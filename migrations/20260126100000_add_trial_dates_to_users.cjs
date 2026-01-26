
exports.up = function (knex) {
    return knex.schema.table('users', function (table) {
        table.timestamp('trial_start_date').nullable();
        table.timestamp('trial_end_date').nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.table('users', function (table) {
        table.dropColumn('trial_start_date');
        table.dropColumn('trial_end_date');
    });
};
