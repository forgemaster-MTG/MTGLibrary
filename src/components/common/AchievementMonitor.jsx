
import React, { useEffect } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { useAuth } from '../../contexts/AuthContext';
import { achievementService } from '../../services/AchievementService';

/**
 * Passive monitor that watches collection data and user profile
 * to trigger "State-based" achievements (e.g. Total Value, Total Cards, Account Age).
 */
const AchievementMonitor = () => {
    const { userProfile, refreshUserProfile } = useAuth();
    const { cards } = useCollection();

    useEffect(() => {
        // Listen for sync events to refresh the profile immediately
        const unsubsribeSync = achievementService.onSync(() => {
            console.log('[AchievementMonitor] Achievement sync detected, refreshing profile...');
            refreshUserProfile();
        });

        return () => unsubsribeSync();
    }, [refreshUserProfile]);

    useEffect(() => {
        if (!userProfile) return;

        // CRITICAL: Load existing achievements first so we don't re-trigger them!
        achievementService.loadUserAchievements(userProfile);

        const updates = {};

        // 1. Account Age
        if (userProfile.createdAt) {
            const created = new Date(userProfile.createdAt);
            const now = new Date();
            const diffTime = Math.abs(now - created);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            updates.account_age_days = diffDays;
        }

        // 2. Collection Stats (if loaded)
        if (cards && cards.length > 0) {
            const ownedCards = cards.filter(c => !c.is_wishlist && !c.deck_id);

            updates.total_cards = ownedCards.length;

            updates.total_value = ownedCards.reduce((acc, c) => {
                const price = (c.finish === 'foil' ? c.prices?.usd_foil : c.prices?.usd) || 0;
                return acc + Number(price);
            }, 0);

            updates.foil_count = ownedCards.filter(c => c.finish === 'foil').length;

            // Color Counts
            updates.count_white = ownedCards.filter(c => c.colors?.includes('W')).length;
            updates.count_blue = ownedCards.filter(c => c.colors?.includes('U')).length;
            updates.count_black = ownedCards.filter(c => c.colors?.includes('B')).length;
            updates.count_red = ownedCards.filter(c => c.colors?.includes('R')).length;
            updates.count_green = ownedCards.filter(c => c.colors?.includes('G')).length;

            // Type Counts (Rough heuristic)
            updates.count_creature = ownedCards.filter(c => c.type_line?.toLowerCase().includes('creature')).length;
            updates.count_artifact = ownedCards.filter(c => c.type_line?.toLowerCase().includes('artifact')).length;
            updates.count_land_special = ownedCards.filter(c => c.type_line?.toLowerCase().includes('land') && !c.type_line?.includes('Basic')).length;
            updates.count_spell = ownedCards.filter(c => c.type_line?.toLowerCase().includes('instant') || c.type_line?.toLowerCase().includes('sorcery')).length;

            // Rarity
            updates.count_mythic = ownedCards.filter(c => c.rarity === 'mythic').length;
        }

        // Run Check
        if (Object.keys(updates).length > 0) {
            achievementService.check(updates);
        }

    }, [cards, userProfile]);

    return null; // Renderless component
};

export default AchievementMonitor;
