
exports.up = function (knex) {
    return knex.schema.table('user_credit_logs', function (table) {
        table.bigInteger('balance_after').nullable();
        // Using bigInteger just in case, though integer is likely fine given credits are huge. 
        // Existing amount is integer, so maybe bigInteger is safer for totals.
    });
};

exports.down = function (knex) {
    return knex.schema.table('user_credit_logs', function (table) {
        table.dropColumn('balance_after');
    });
};
