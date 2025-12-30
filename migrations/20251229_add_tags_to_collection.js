export async function up(knex) {
    await knex.schema.table('user_cards', (table) => {
        table.jsonb('tags').defaultTo('[]');
        table.decimal('price_bought', 10, 2).nullable();
    });
}

export async function down(knex) {
    await knex.schema.table('user_cards', (table) => {
        table.dropColumn('tags');
        table.dropColumn('price_bought');
    });
}
