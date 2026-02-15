
exports.up = function (knex) {
    return knex.schema.hasTable('user_credit_logs').then(function (exists) {
        if (!exists) {
            return knex.schema.createTable('user_credit_logs', function (table) {
                table.increments('id').primary();
                table.integer('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable().index();
                table.integer('amount').notNullable(); // Negative for deduction, Positive for addition
                table.string('credit_type').notNullable().defaultTo('mixed'); // 'monthly', 'topup', 'mixed'
                table.string('transaction_type').notNullable(); // 'usage', 'subscription_renewal', 'topup_purchase', 'manual', 'admin_adjustment'
                table.string('description');
                table.jsonb('metadata').defaultTo('{}');
                table.timestamp('created_at').defaultTo(knex.fn.now());

                table.index(['user_id', 'created_at']);
            });
        }
    });
};

exports.down = function (knex) {
    // We generally don't want to drop it if it was "ensured", but for symmetry:
    // return knex.schema.dropTableIfExists('user_credit_logs');
    return Promise.resolve();
};
