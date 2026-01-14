export async function up(knex) {
    // Drop existing precons to rebuild
    await knex.schema.dropTableIfExists('precons');

    // Create normalized precons table
    await knex.schema.createTable('precons', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('set_code').nullable().index();
        table.string('type').nullable().index();
        table.jsonb('colors').defaultTo('[]'); // e.g. ["U", "B"]
        table.string('commander_name').nullable();
        table.integer('card_count').defaultTo(100);
        table.string('image_uri').nullable(); // Box art or commander art
        table.string('release_date').nullable();
        table.jsonb('metadata').defaultTo('{}'); // Any extra data
        table.timestamps(true, true);
    });

    // Create joining table for cards
    await knex.schema.createTable('precon_cards', (table) => {
        table.increments('id').primary();
        table.integer('precon_id').references('id').inTable('precons').onDelete('CASCADE').index();
        table.string('card_name');
        table.string('scryfall_id').nullable().index(); // Link to cards table potentially
        table.string('set_code').nullable();
        table.string('collector_number').nullable();
        table.string('finish').defaultTo('nonfoil');
        table.integer('quantity').defaultTo(1);
        table.string('zone').defaultTo('mainBoard'); // mainBoard, sideBoard, commander

        // Composite index for lookups
        table.index(['precon_id', 'zone']);
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('precon_cards');
    await knex.schema.dropTableIfExists('precons');
}
