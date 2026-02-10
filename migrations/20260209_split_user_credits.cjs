
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasCreditsMonthly = await knex.schema.hasColumn('users', 'credits_monthly');
    const hasCreditsTopup = await knex.schema.hasColumn('users', 'credits_topup');

    if (!hasCreditsMonthly || !hasCreditsTopup) {
        await knex.schema.table('users', (table) => {
            if (!hasCreditsMonthly) {
                table.bigInteger('credits_monthly').defaultTo(0);
            }
            if (!hasCreditsTopup) {
                table.bigInteger('credits_topup').defaultTo(0);
            }
        });
    }

    // Migrate existing data: Move current ai_credits to credits_monthly (or topup? Let's say monthly for now as a safe default)
    // Logic: Existing users likely have "monthly" credits from their plan. 
    // Any "extra" could be topup, but we don't have that distinction yet.
    // Safest bet: Move all to credits_monthly.

    // Migrate existing data if the column exists
    const hasAiCredits = await knex.schema.hasColumn('users', 'ai_credits');
    if (hasAiCredits) {
        await knex.raw('UPDATE users SET credits_monthly = COALESCE(ai_credits, 0)');
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.table('users', (table) => {
        table.dropColumn('credits_monthly');
        table.dropColumn('credits_topup');
    });
};
