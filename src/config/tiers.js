// configuration for pricing tiers
// MIRRORS server/config/tiers.js - Keep in sync!

export const TIERS = {
    FREE: 'free',
    TIER_1: 'tier_1', // Apprentice ($2.99)
    TIER_2: 'tier_2', // Magician ($4.99)
    TIER_3: 'tier_3', // Wizard ($9.99)
    TIER_4: 'tier_4', // Archmage ($14.99)
    TIER_5: 'tier_5', // Planeswalker ($19.99)
};

export const TIER_CONFIG = {
    [TIERS.FREE]: {
        name: 'Initiate',
        prices: { monthly: null, biannual: null, yearly: null }, // Free
        description: 'The journey begins. Unlimited decks and cards, with essential AI tools.',
        limits: {
            collection: Infinity,
            wishlist: Infinity,
            decks: Infinity,
            pods: 0,
            aiCredits: 750000
        },
        features: {
            aiChatbot: true,
            smartBinders: true,
            binders: false,
            collectionAudit: false,
            mockupDeck: false,
            aiStrategy: false,
            deckSuggestions: false,
            deckAudit: false,
            setAudit: false,
            collectionBackup: false,
            deckBackup: false,
            deckDoctor: false,
            sharedEdit: false,
            customAiPersona: false,
            snapScan: true,
            batchScan: false,
            pods: false
        }
    },
    [TIERS.TIER_1]: { // $2.99
        name: 'Apprentice',
        prices: {
            //MTG-Forge Sandbox ID's
            monthly: 'price_1SnvJZDBKqoK8H1Rck5qvWrD', // $2.99
            quarterly: 'price_1StfhDDBKqoK8H1RYlATyyeh',      // $8.99
            biannual: 'price_1SnvRKDBKqoK8H1RKcYMRlz2', // $14.99
            yearly: 'price_1SnvPsDBKqoK8H1RcxwM3gZJ'     // $29.99
        },
        description: 'Perfect for new potential. Unlimited storage to build your foundation.',
        limits: {
            collection: Infinity,
            wishlist: Infinity,
            decks: Infinity,
            pods: 0,
            aiCredits: 7000000
        },
        features: {
            aiChatbot: true,
            smartBinders: true,
            binders: false,
            collectionAudit: false,
            mockupDeck: false,
            aiStrategy: false,
            deckSuggestions: false,
            deckAudit: false,
            setAudit: false,
            collectionBackup: false,
            deckBackup: false,
            deckDoctor: false,
            sharedEdit: false,
            customAiPersona: false,
            snapScan: true,
            batchScan: false,
            pods: false
        }
    },
    [TIERS.TIER_2]: { // $4.99
        name: 'Magician',
        prices: {
            monthly: 'price_1SnvK5DBKqoK8H1Rj7uSTSfw', // $4.99
            quarterly: 'price_1StfgoDBKqoK8H1Rr5pIrd1o',      // $14.99
            biannual: 'price_1SnvVSDBKqoK8H1RFAqc0iIH', // $24.99
            yearly: 'price_1SnvVfDBKqoK8H1RryOTO2p8'     // $49.99
        },
        description: 'Unlock the power of organization. Unlimited decks, cards, and advanced tools.',
        limits: {
            collection: Infinity,
            wishlist: Infinity,
            decks: Infinity,
            pods: 0,
            aiCredits: 11000000
        },
        features: {
            aiChatbot: true,
            smartBinders: true,
            binders: true,
            collectionAudit: true,
            mockupDeck: true,
            aiStrategy: true,
            deckSuggestions: true,
            deckAudit: true,
            setAudit: true,
            collectionBackup: true,
            deckBackup: true,
            deckDoctor: true,
            sharedEdit: false,
            customAiPersona: false,
            snapScan: true,
            batchScan: true,
            pods: false
        }
    },
    [TIERS.TIER_3]: { // $9.99
        name: 'Wizard',
        prices: {
            monthly: 'price_1SnvKxDBKqoK8H1RXvh1VsT3', // $9.99
            quarterly: 'price_1Stf5iDBKqoK8H1RMHbM4yzr',      // $29.99
            biannual: 'price_1SnvUkDBKqoK8H1RgX9mlcxs', // $49.99
            yearly: 'price_1SnvUwDBKqoK8H1RAUVYJtmM'     // $99.99
        },
        description: 'Master your craft. Unlimited decks, cards, Pods, and the AI Deck Doctor.',
        limits: {
            collection: Infinity,
            wishlist: Infinity,
            decks: Infinity,
            pods: 3,
            aiCredits: 24500000
        },
        features: {
            aiChatbot: true,
            smartBinders: true,
            binders: true,
            collectionAudit: true,
            mockupDeck: true,
            aiStrategy: true,
            deckSuggestions: true,
            deckAudit: true,
            setAudit: true,
            collectionBackup: true,
            deckBackup: true,
            deckDoctor: true,
            sharedEdit: true,
            customAiPersona: true,
            snapScan: true,
            batchScan: true,
            pods: true
        }
    },
    [TIERS.TIER_4]: { // $14.99
        name: 'Archmage',
        prices: {
            monthly: 'price_1SnvMxDBKqoK8H1RVcOon0kC', // $14.99
            quarterly: 'price_1Stf5GDBKqoK8H1RthB3bBDC',      // $44.99
            biannual: 'price_1SnvUSDBKqoK8H1RRAXjFJ1h', // $74.99
            yearly: 'price_1SnvUSDBKqoK8H1RBMhvTUZA'     // $149.99
        },
        description: 'Command a vast library. Unlimited decks, cards, and advanced management.',
        limits: {
            collection: Infinity,
            wishlist: Infinity,
            decks: Infinity,
            pods: 5,
            aiCredits: 36500000
        },
        features: {
            aiChatbot: true,
            smartBinders: true,
            binders: true,
            collectionAudit: true,
            mockupDeck: true,
            aiStrategy: true,
            deckSuggestions: true,
            deckAudit: true,
            setAudit: true,
            collectionBackup: true,
            deckBackup: true,
            deckDoctor: true,
            sharedEdit: true,
            customAiPersona: true,
            snapScan: true,
            batchScan: true,
            pods: true
        }
    },
    [TIERS.TIER_5]: { // $19.99
        name: 'Planeswalker',
        prices: {
            monthly: 'price_1SnvSmDBKqoK8H1RCezHNZSu', // $19.99
            quarterly: 'price_1SteBkDBKqoK8H1RoXR18wB2',      // $59.99
            biannual: 'price_1SnvTcDBKqoK8H1RAmz1kB1d', // $99.99
            yearly: 'price_1SnvTcDBKqoK8H1Rn1rFWAws'     // $199.99
        },
        description: 'Rule the multiverse. Unlimited access to all features and storage.',
        limits: {
            collection: Infinity,
            wishlist: Infinity,
            decks: Infinity,
            pods: Infinity,
            aiCredits: 49000000
        },
        features: {
            aiChatbot: true,
            smartBinders: true,
            binders: true,
            collectionAudit: true,
            mockupDeck: true,
            aiStrategy: true,
            deckSuggestions: true,
            deckAudit: true,
            setAudit: true,
            collectionBackup: true,
            deckBackup: true,
            deckDoctor: true,
            sharedEdit: true,
            customAiPersona: true,
            snapScan: true,
            batchScan: true,
            pods: true
        }
    }
};

export function getTierConfig(tierId, permissions = []) {
    const baseConfig = TIER_CONFIG[tierId] || TIER_CONFIG[TIERS.FREE];

    if (permissions && permissions.includes('bypass_tier_limits')) {
        const superConfig = TIER_CONFIG[TIERS.TIER_5];
        return {
            ...superConfig,
            limits: {
                ...superConfig.limits,
                aiCredits: baseConfig.limits.aiCredits // Keep credits from original tier
            }
        };
    }

    return baseConfig;
}
