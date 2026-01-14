/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('users', function (t) {
        // Subscription Fields
        t.string('subscription_tier').defaultTo('free').notNullable(); // 'free', 'basic', 'premium', etc.
        t.string('stripe_customer_id').nullable();
        t.string('stripe_subscription_id').nullable();
        t.string('subscription_status').defaultTo('active'); // 'active', 'past_due', 'canceled', 'incomplete'

        // Period tracking for robust access
        t.timestamp('subscription_end_date').nullable();

        // Admin Override (for friends/testing)
        t.string('override_tier').nullable(); // If set, this takes precedence over subscription_tier

        // Indexes
        t.index('stripe_customer_id');
        t.index('subscription_tier');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('users', function (t) {
        t.dropColumn('subscription_tier');
        t.dropColumn('stripe_customer_id');
        t.dropColumn('stripe_subscription_id');
        t.dropColumn('subscription_status');
        t.dropColumn('subscription_end_date');
        t.dropColumn('override_tier');
    });
}
