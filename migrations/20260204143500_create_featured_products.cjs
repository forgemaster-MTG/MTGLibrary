
exports.up = function (knex) {
    return knex.schema.createTable('featured_products', table => {
        table.increments('id').primary();
        table.string('title').notNullable();
        table.string('image_url').notNullable();
        table.string('link_url').notNullable(); // Affiliate link
        table.string('category').defaultTo('sealed'); // sealed, commander, bundle, other
        table.string('price_label').nullable(); // e.g. "$145.00"
        table.boolean('is_active').defaultTo(true);
        table.integer('display_order').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('featured_products');
};
