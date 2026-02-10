import { TIERS, TIER_CONFIG } from '../config/tiers';

export const FEATURE_GROUPS = [
    {
        name: "Core Features",
        items: [
            { label: "Unlimited Collection", type: 'static', value: true },
            { label: "Unlimited Decks", type: 'static', value: true },
            { label: "Unlimited Wishlist", type: 'static', value: true },
            { label: "Pod Count", type: 'limit', key: 'pods' },
        ]
    },
    {
        name: "Collection",
        items: [
            { label: "Organization customization", type: 'static', value: true },
            { label: "Tags", type: 'static', value: true },
            { label: "Bulk Import", type: 'static', value: true },
            { label: "Manual Price Sync", type: 'static', value: true },
            { label: "Smart Binders", type: 'feature', key: 'smartBinders' },
            { label: "Binders", type: 'feature', key: 'binders' },
            { label: "Collection Audit", type: 'feature', key: 'collectionAudit' },
            { label: "Snap Version (Scanner)", type: 'feature', key: 'snapScan' },
            { label: "Quick Scan (Batch)", type: 'feature', key: 'batchScan' },
        ]
    },
    {
        name: "Wishlist",
        items: [
            { label: "Mass Deletion", type: 'static', value: true },
            { label: "Precon Addition", type: 'static', value: true },
        ]
    },
    {
        name: "Decks",
        items: [
            { label: "Public/Private View", type: 'static', value: true },
            { label: "Deck Stats", type: 'static', value: true },
            { label: "Buy on TCGPlayer", type: 'static', value: true },
            { label: "Mockup Deck", type: 'feature', key: 'mockupDeck' },
            { label: "AI Strategy", type: 'feature', key: 'aiStrategy' },
            { label: "Deck Doctor", type: 'feature', key: 'deckDoctor' },
            { label: "Deck Suggestions", type: 'feature', key: 'deckSuggestions' },
            { label: "Deck Audit", type: 'feature', key: 'deckAudit' },
            { label: "Shared edit", type: 'feature', key: 'sharedEdit' },
        ]
    },
    {
        name: "Precons",
        items: [
            { label: "Add to collection", type: 'static', value: true },
            { label: "Add to wishlist", type: 'static', value: true },
            { label: "Buy on TCGPlayer", type: 'static', value: true },
        ]
    },
    {
        name: "Sets",
        items: [
            { label: "Quick Add", type: 'static', value: true },
            { label: "Set Audit", type: 'feature', key: 'setAudit' },
        ]
    },
    {
        name: "AI",
        items: [
            { label: "Chatbot", type: 'static', value: true }, // Mapped to static but could use feature flag if needed
            { label: "Default Oracle", type: 'static', value: true },
            { label: "Custom AI Persona", type: 'feature', key: 'customAiPersona' },
        ]
    },
    {
        name: "Settings",
        items: [
            { label: "Collection Backup", type: 'feature', key: 'collectionBackup' },
            { label: "Deck Backup", type: 'feature', key: 'deckBackup' },
            { label: "Pods / Linking", type: 'limit_check', key: 'pods' },
        ]
    }
];

// Helper to find features new to this tier compared to previous
// Helper to find features new to this tier compared to previous
export const getNewFeatures = (currentTier, previousTier, dynamicConfig = null) => {
    const currentStatic = TIER_CONFIG[currentTier];
    const prevStatic = previousTier ? TIER_CONFIG[previousTier] : null;

    // Helper to get effective limits
    const getEffectiveLimits = (tierKey) => {
        const staticLimits = TIER_CONFIG[tierKey].limits;
        if (!dynamicConfig) return staticLimits;

        const map = {
            'free': 'Trial',
            'tier_1': 'Apprentice', 'tier_2': 'Magician', 'tier_3': 'Wizard',
            'tier_4': 'Archmage', 'tier_5': 'Planeswalker'
        };
        const name = map[tierKey];
        const dynTier = name === 'Trial' ? dynamicConfig.trial : (dynamicConfig.tiers ? dynamicConfig.tiers.find(t => t.name === name) : null);

        if (!dynTier) return staticLimits;

        return {
            collection: dynTier.collectionLimit ?? staticLimits.collection,
            decks: dynTier.deckLimit ?? staticLimits.decks,
            wishlist: dynTier.wishlistLimit ?? staticLimits.wishlist,
            pods: dynTier.podLimit ?? staticLimits.pods,
            // aiCredits handled elsewhere
        };
    };

    const currentLimits = getEffectiveLimits(currentTier);
    const prevLimits = previousTier ? getEffectiveLimits(previousTier) : null;

    const isInf = (val) => val === null || val === Infinity || val >= 999999;

    if (!prevLimits) {
        // For the first tier (Free), show some base features manually
        if (currentTier === TIERS.FREE) {
            return {
                limits: [
                    { label: `Collection: ${isInf(currentLimits.collection) ? 'Unlimited' : currentLimits.collection}`, type: 'limit' },
                    { label: `Decks: ${isInf(currentLimits.decks) ? 'Unlimited' : currentLimits.decks}`, type: 'limit' },
                    { label: `Pods (Shared Accounts): ${currentLimits.pods || 0}`, type: 'limit' },
                ],
                features: [
                    { label: "AI Chatbot", type: 'feature' }
                ]
            };
        }
        return { limits: [], features: [] };
    }

    const limits = [];
    const features = [];

    // Check Limits - Order: Collection, Wishlist, Decks, Pods
    if (isInf(currentLimits.collection) && !isInf(prevLimits.collection)) {
        limits.push({ label: `Collection: Unlimited`, type: 'limit' });
    } else if (currentLimits.collection > prevLimits.collection) {
        limits.push({ label: `Collection: ${currentLimits.collection}`, type: 'limit' });
    }

    if (isInf(currentLimits.wishlist) && !isInf(prevLimits.wishlist)) {
        limits.push({ label: `Wishlist: Unlimited`, type: 'limit' });
    } else if (currentLimits.wishlist > prevLimits.wishlist) {
        limits.push({ label: `Wishlist: ${currentLimits.wishlist}`, type: 'limit' });
    }

    if (isInf(currentLimits.decks) && !isInf(prevLimits.decks)) {
        limits.push({ label: `Decks: Unlimited`, type: 'limit' });
    } else if (currentLimits.decks > prevLimits.decks) {
        limits.push({ label: `Decks: ${currentLimits.decks}`, type: 'limit' });
    }

    // Pods Logic
    const isWizard = currentTier === TIERS.TIER_3;
    if (currentLimits.pods > prevLimits.pods || (currentLimits.pods > 0 && prevLimits.pods === 0)) {
        limits.push({
            label: `Pods (Shared Accounts): ${isInf(currentLimits.pods) ? 'Unlimited' : currentLimits.pods}`,
            type: 'limit',
            bold: isWizard,
            tooltip: "Pods allow you to link accounts (friends/family) to share your collection and deck building tools."
        });
    }

    // Check Features (Static only for now)
    Object.keys(currentStatic.features).forEach(key => {
        if (currentStatic.features[key] && !prevStatic.features[key]) {
            const groupItem = FEATURE_GROUPS.flatMap(g => g.items).find(i => i.key === key);
            features.push({ label: groupItem ? groupItem.label : key.replace(/([A-Z])/g, ' $1').trim(), type: 'feature' });
        }
    });

    return { limits, features };
};
