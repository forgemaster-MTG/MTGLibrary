// configuration for pricing tiers
// Based on the provided pricing sheet

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
        description: 'The journey begins. Track up to 3 decks and 300 cards.',
        limits: {
            collection: 300,
            wishlist: 105,
            decks: 3,
            pods: 0
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
            deckDoctor: false, // Wizard+
            sharedEdit: false, // Wizard+
            customAiPersona: false, // Wizard+
            snapScan: true,
            batchScan: false,
            pods: false
        }
    },
    [TIERS.TIER_1]: { // $2.99
        name: 'Apprentice',
        prices: {
            //MTG-Forge Sandbox ID's
            monthly: 'price_1SnxT7RZLrZbIKATICyA3jfB', // $9.99
            quarterly: 'price_1StfhDDBKqoK8H1RYlATyyeh',      // $8.99
            biannual: 'price_1SnxUeRZLrZbIKATlErTgHtz', // $49.99
            yearly: 'price_1SnxUuRZLrZbIKATm6nmPnUr'     // $99.99
        },
        description: 'Perfect for new potential. Store up to 10 decks and 1,000 cards.',
        limits: {
            collection: 1000,
            wishlist: 300,
            decks: 10,
            pods: 0
        },
        features: {
            aiChatbot: true,
            smartBinders: true,
            binders: false, // Magician+
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
        description: 'Unlock the power of organization. 25 decks, 2,000 cards, and advanced tools.',
        limits: {
            collection: 2000,
            wishlist: 1000,
            decks: 25,
            pods: 0
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
            sharedEdit: false, // Wizard+
            customAiPersona: false, // Wizard+
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
        description: 'Master your craft. 55 decks, 5,000 cards, Pods, and the AI Deck Doctor.',
        limits: {
            collection: 5000,
            wishlist: 2500,
            decks: 55,
            pods: 3
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
        description: 'Command a vast library. 100 decks, 10,000 cards, and advanced management.',
        limits: {
            collection: 10000,
            wishlist: 5000,
            decks: 100,
            pods: 5
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
            pods: Infinity
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

/**
 * Helper to get config for a user given their tier ID (string)
 * Defaults to FREE if not found.
 */
export function getTierConfig(tierId) {
    return TIER_CONFIG[tierId] || TIER_CONFIG[TIERS.FREE];
}
