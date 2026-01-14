
exports.up = async function (knex) {
    const hasColumn = await knex.schema.hasColumn('tournament_participants', 'is_active');
    if (!hasColumn) {
        return knex.schema.alterTable('tournament_participants', table => {
            table.boolean('is_active').defaultTo(true);
        });
    }
};

exports.down = function (knex) {
    return knex.schema.alterTable('tournament_participants', table => {
        table.dropColumn('is_active');
    });
};
