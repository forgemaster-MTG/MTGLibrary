
exports.up = function (knex) {
    return knex.schema.alterTable('users', table => {
        table.integer('referred_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('users', table => {
        table.dropColumn('referred_by');
    });
};
