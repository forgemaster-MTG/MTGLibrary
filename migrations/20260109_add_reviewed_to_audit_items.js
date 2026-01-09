
export async function up(knex) {
    await knex.schema.alterTable('audit_items', (table) => {
        table.boolean('reviewed').defaultTo(false);
    });
}

export async function down(knex) {
    await knex.schema.alterTable('audit_items', (table) => {
        table.dropColumn('reviewed');
    });
}
