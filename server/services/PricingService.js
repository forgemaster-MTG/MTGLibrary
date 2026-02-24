import { knex } from '../db.js';

let cachedConfig = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minute cache for config

export const PricingService = {

    /**
     * Fetch current pricing configuration from DB or return defaults
     */
    async getConfig() {
        const now = Date.now();
        if (cachedConfig && (now - lastFetch < CACHE_TTL)) {
            return cachedConfig;
        }

        try {
            const row = await knex('system_settings').where({ key: 'pricing_config' }).first();
            if (row && row.value) {
                cachedConfig = row.value;
                lastFetch = now;
                return cachedConfig;
            }
        } catch (e) {
            console.error('[PricingService] Failed to load config from DB', e);
        }

        // Return defaults if DB empty or error (Bootstrap)
        return this.getDefaults();
    },

    /**
     * Save new configuration to DB
     */
    async saveConfig(newConfig) {
        // Basic validation
        if (!newConfig.tiers || !newConfig.assumptions) {
            throw new Error('Invalid configuration structure');
        }

        await knex('system_settings')
            .insert({
                key: 'pricing_config',
                value: JSON.stringify(newConfig),
                updated_at: new Date()
            })
            .onConflict('key')
            .merge();

        // Invalidate cache
        cachedConfig = newConfig;
        lastFetch = Date.now();
        return cachedConfig;
    },

    /**
     * Calculate derived stats based on assumptions (Used for Simulation/Validation)
     */
    calculateStats(config) {
        const { assumptions, tiers, packs } = config;

        // Helper calculations mirror the frontend/verification logic
        const calculateStripe = (price) => (price * 0.029) + 0.30;
        const calculateRequiredProfit = (price) => price * (assumptions.marginPercent / 100);

        const processItem = (item) => {
            const stripe = calculateStripe(item.price);
            const profit = calculateRequiredProfit(item.price);
            // Hosting cost applies to Tiers (monthly), not Packs (one-time) usually?
            // Actually hosting is monthly. Packs are one-time.
            // Let's assume Hosting is deducted for Tiers.
            const isTier = !!item.name.match(/Apprentice|Magician|Wizard|Archmage|Planeswalker/);
            const hosting = isTier ? assumptions.hostingCost : 0;

            const aiBudget = item.price - stripe - profit - hosting;
            const safeBudget = aiBudget > 0 ? aiBudget : 0;

            // Pro Token Cost = $X per 1M.
            // 1 Pro Token = 'exchangeRate' Credits.
            const costPerMillionProTokens = assumptions.proTokenCost;
            const proTokensPurchasable = (safeBudget / costPerMillionProTokens) * 1000000;

            const maxCredits = proTokensPurchasable * assumptions.exchangeRate;

            // Round to nearest 500k for "Suggested Limit"
            const suggestLimit = Math.floor(maxCredits / 500000) * 500000;

            // Est Decks
            const costPerDeckCredits = 45000 * assumptions.exchangeRate;
            const estDecks = Math.floor(suggestLimit / costPerDeckCredits);

            return {
                ...item,
                metrics: {
                    stripe,
                    requiredProfit: profit,
                    hosting,
                    aiBudget: safeBudget,
                    maxCredits,
                    suggestedLimit: suggestLimit,
                    estDecks
                }
            };
        };

        return {
            assumptions,
            tiers: tiers.map(processItem),
            packs: packs.map(processItem)
        };
    },

    getDefaults() {
        return {
            assumptions: {
                marginPercent: 33,
                hostingCost: 0.25,
                avgUsagePercent: 80,
                proTokenCost: 2.50,
                exchangeRate: 6, // 6M credits per $1
                imageCostMarket: 0.03, // $0.03 market cost
                fastImageCostMarket: 0.01, // $0.01 market cost
                imageMarkup: 1.15 // 115% markup
            },
            tiers: [
                {
                    name: "Apprentice",
                    price: 2.99,
                    creditLimit: 8000000,
                    limits: { collection: Infinity, wishlist: Infinity, decks: Infinity, pods: 0 }
                },
                {
                    name: "Magician",
                    price: 4.99,
                    creditLimit: 15000000,
                    limits: { collection: Infinity, wishlist: Infinity, decks: Infinity, pods: 0 }
                },
                {
                    name: "Wizard",
                    price: 9.99,
                    creditLimit: 35000000,
                    limits: { collection: Infinity, wishlist: Infinity, decks: Infinity, pods: 3 }
                },
                {
                    name: "Archmage",
                    price: 14.99,
                    creditLimit: 54000000,
                    limits: { collection: Infinity, wishlist: Infinity, decks: Infinity, pods: 5 }
                },
                {
                    name: "Planeswalker",
                    price: 19.99,
                    creditLimit: 73000000,
                    limits: { collection: Infinity, wishlist: Infinity, decks: Infinity, pods: Infinity }
                }
            ],
            trial: {
                creditLimit: 750000,
                limits: { collection: Infinity, wishlist: Infinity, decks: Infinity, pods: 0 }
            },
            packs: [
                { name: "Limited Top-Up", price: 3.00, creditLimit: 9500000 },
                { name: "Standard Top-Up", price: 5.00, creditLimit: 17000000 },
                { name: "Mega Top-Up", price: 10.00, creditLimit: 36000000 }
            ]
        };
    },

    async calculateTopUpCost(credits) {
        const config = await this.getConfig();
        const { assumptions } = config;

        // Budget = (Credits / ExchangeRate / 1M) * ProTokenCost
        // Price = (Budget + 0.30) / (1 - 0.029 - Margin)

        const requiredBudget = (credits / assumptions.exchangeRate / 1000000) * assumptions.proTokenCost;

        const STRIPE_FIXED = 0.30;
        const STRIPE_PERCENT = 0.029;
        const margin = assumptions.marginPercent / 100;

        let price = (requiredBudget + STRIPE_FIXED) / (1 - STRIPE_PERCENT - margin);
        return Math.max(3.00, price);
    },

    /**
     * Get the Credit Limit for a specific Tier ID (e.g. 'tier_1')
     */
    async getLimitForTier(tierId) {
        const config = await this.getConfig();
        // Map TIER_1 -> "Apprentice"
        // We need a mapping or we store IDs in the config.
        // Current config uses Names. Let's map.
        const NAME_MAP = {
            'free': 'Trial',
            'tier_1': 'Apprentice',
            'tier_2': 'Magician',
            'tier_3': 'Wizard',
            'tier_4': 'Archmage',
            'tier_5': 'Planeswalker'
        };

        const name = NAME_MAP[tierId] || 'Trial';
        if (name === 'Trial') return config.trial.creditLimit;

        const tier = config.tiers.find(t => t.name === name);
        return tier ? tier.creditLimit : config.trial.creditLimit;
    }
};
