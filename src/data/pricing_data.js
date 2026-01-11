import { TIERS, TIER_CONFIG } from '../config/tiers';

export const FEATURE_GROUPS = [
    {
        name: "Limits",
        items: [
            { label: "Collection size", type: 'limit', key: 'collection' },
            { label: "Wishlist size", type: 'limit', key: 'wishlist' },
            { label: "Deck count", type: 'limit', key: 'decks' },
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
export const getNewFeatures = (currentTier, previousTier) => {
    const current = TIER_CONFIG[currentTier];
    const prev = previousTier ? TIER_CONFIG[previousTier] : null;

    if (!prev) {
        // For the first tier (Free), show some base features manually
        if (currentTier === TIERS.FREE) {
            return {
                limits: [
                    { label: `Collection: ${current.limits.collection}`, type: 'limit' },
                    { label: `Wishlist: ${current.limits.wishlist}`, type: 'limit' },
                    { label: `Decks: ${current.limits.decks}`, type: 'limit' },
                    { label: `Pods (Shared Accounts): 0`, type: 'limit' },
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
    if (current.limits.collection > prev.limits.collection)
        limits.push({ label: `Collection: ${current.limits.collection === Infinity ? 'Unlimited' : current.limits.collection}`, type: 'limit' });
    if (current.limits.wishlist > prev.limits.wishlist)
        limits.push({ label: `Wishlist: ${current.limits.wishlist === Infinity ? 'Unlimited' : current.limits.wishlist}`, type: 'limit' });
    if (current.limits.decks > prev.limits.decks)
        limits.push({ label: `Decks: ${current.limits.decks === Infinity ? 'Unlimited' : current.limits.decks}`, type: 'limit' });

    // Pods Logic: Explicitly show for lower tiers, bold for Wizard
    const isWizard = currentTier === TIERS.TIER_3;
    const isLowerTier = [TIERS.TIER_1, TIERS.TIER_2].includes(currentTier);

    if (current.limits.pods > prev.limits.pods || isLowerTier) {
        limits.push({
            label: `Pods (Shared Accounts): ${current.limits.pods === Infinity ? 'Unlimited' : current.limits.pods}`,
            type: 'limit',
            bold: isWizard,
            tooltip: "Pods allow you to link accounts (friends/family) to share your collection and deck building tools."
        });
    }

    // Check Features
    Object.keys(current.features).forEach(key => {
        if (current.features[key] && !prev.features[key]) {
            // Find readable label from FEATURE_GROUPS if possible, or format key
            const groupItem = FEATURE_GROUPS.flatMap(g => g.items).find(i => i.key === key);
            features.push({ label: groupItem ? groupItem.label : key.replace(/([A-Z])/g, ' $1').trim(), type: 'feature' });
        }
    });

    return { limits, features };
};
