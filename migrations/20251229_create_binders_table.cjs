export async function up(knex) {
    return knex.schema
        .createTable('binders', (table) => {
            table.increments('id').primary();
            table.string('user_id').notNullable();
            table.string('name').notNullable();
            table.string('type').defaultTo('collection');
            table.string('icon_type').defaultTo('emoji');
            table.string('icon_value').defaultTo('📁');
            table.string('color_preference').defaultTo('blue');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .table('user_cards', (table) => {
            table.integer('binder_id').unsigned().references('id').inTable('binders').onDelete('SET NULL');
        });
}

export async function down(knex) {
    return knex.schema
        .table('user_cards', (table) => {
            table.dropColumn('binder_id');
        })
        .dropTable('binders');
}
