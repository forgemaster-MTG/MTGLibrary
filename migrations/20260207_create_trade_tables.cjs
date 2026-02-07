
exports.up = function (knex) {
    return knex.schema
        .createTable('trades', function (table) {
            table.increments('id').primary();
            table.integer('initiator_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.integer('receiver_id').unsigned().references('id').inTable('users').onDelete('CASCADE'); // Nullable for potential future "public" trades
            table.enu('status', ['pending', 'accepted', 'rejected', 'completed', 'cancelled']).defaultTo('pending');
            table.text('notes');
            table.timestamps(true, true);
        })
        .createTable('trade_items', function (table) {
            table.increments('id').primary();
            table.integer('trade_id').unsigned().notNullable().references('id').inTable('trades').onDelete('CASCADE');
            table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE'); // Owner of the item
            table.enu('item_type', ['card', 'cash']).notNullable();
            table.string('item_id'); // Can be card ID. Null if cash.
            table.integer('quantity').defaultTo(1);
            table.decimal('amount', 14, 2); // For cash
            table.jsonb('details'); // Snapshot of card details
        })
        .createTable('trade_messages', function (table) {
            table.increments('id').primary();
            table.integer('trade_id').unsigned().notNullable().references('id').inTable('trades').onDelete('CASCADE');
            table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.text('content').notNullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('trade_messages')
        .dropTableIfExists('trade_items')
        .dropTableIfExists('trades');
};
