export async function up(knex) {
    return knex.schema.table('binders', (table) => {
        table.jsonb('rules').nullable().comment('Array of rule conditions: [{field, operator, value, logic}]');
    });
}

export async function down(knex) {
    return knex.schema.table('binders', (table) => {
        table.dropColumn('rules');
    });
}
