/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. Add AI Credits to Users
    await knex.schema.alterTable('users', (table) => {
        table.bigInteger('ai_credits_used').defaultTo(0).notNullable();
        table.bigInteger('ai_credits_limit_override').nullable(); // For manual bonuses
        table.timestamp('ai_billing_start_date').defaultTo(knex.fn.now());
    });

    // 2. Create System Settings Table (Key-Value Store for Pricing Config)
    await knex.schema.createTable('system_settings', (table) => {
        table.string('key').primary();
        table.jsonb('value').notNullable();
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // 3. Clear existing deck/collection limits from Tiers? 
    // We don't store tier definitions in DB usually, they are in code. 
    // But we will insert default pricing config into system_settings here to bootstrap.

    const defaultPricingConfig = {
        assumptions: {
            marginPercent: 33,
            hostingCost: 0.25,
            avgUsagePercent: 80,
            proTokenCost: 2.50,
            exchangeRate: 15
        },
        tiers: [
            { name: "Apprentice", price: 2.99, creditLimit: 8000000 },
            { name: "Magician", price: 4.99, creditLimit: 15000000 },
            { name: "Wizard", price: 9.99, creditLimit: 35000000 },
            { name: "Archmage", price: 14.99, creditLimit: 54000000 },
            { name: "Planeswalker", price: 19.99, creditLimit: 73000000 }
        ],
        trial: {
            creditLimit: 750000
        },
        packs: [
            { name: "Limited Top-Up", price: 3.00, creditLimit: 9500000 },
            { name: "Standard Top-Up", price: 5.00, creditLimit: 17000000 },
            { name: "Mega Top-Up", price: 10.00, creditLimit: 36000000 }
        ]
    };

    await knex('system_settings').insert({
        key: 'pricing_config',
        value: defaultPricingConfig
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('system_settings');
    await knex.schema.alterTable('users', (table) => {
        table.dropColumn('ai_credits_used');
        table.dropColumn('ai_credits_limit_override');
        table.dropColumn('ai_billing_start_date');
    });
};
