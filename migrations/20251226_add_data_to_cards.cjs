export function up(knex) {
    return knex.schema.table('cards', function (table) {
        table.jsonb('data');
    });
}

export function down(knex) {
    return knex.schema.table('cards', function (table) {
        table.dropColumn('data');
    });
}
