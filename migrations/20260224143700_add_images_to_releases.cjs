exports.up = function (knex) {
    return knex.schema.alterTable('releases', table => {
        table.jsonb('images').defaultTo('[]');
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('releases', table => {
        table.dropColumn('images');
    });
};
