
exports.up = function (knex) {
    return knex.schema.table('users', table => {
        table.timestamp('agreed_to_terms_at').nullable();
        table.boolean('marketing_opt_in').defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.table('users', table => {
        table.dropColumn('agreed_to_terms_at');
        table.dropColumn('marketing_opt_in');
    });
};
