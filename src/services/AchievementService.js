
import { ACHIEVEMENTS } from '../data/achievements';
import { api } from './api';

class AchievementService {
    constructor() {
        this.listeners = [];
        // In-memory cache of user metrics (populated on load)
        this.metrics = {
            total_cards: 0,
            total_value: 0,
            foil_count: 0,
            audits_completed: 0,
            perfect_audits: 0,
            decks_created: 0,
            account_age_days: 0
        };
        this.unlockedIds = new Set();
        this.userId = null;
    }

    /**
     * Subscribe to new unlocks (for UI toasts)
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Load initial state from backend (User Profile)
     */
    async loadUserAchievements(userProfile) {
        if (!userProfile) return;

        this.userId = userProfile.id; // Store ID for updates

        // Check nested data (userProfile.data.achievements)
        // If not found, check existing path just in case
        const savedIds = userProfile.data?.achievements || userProfile.achievements || [];

        if (Array.isArray(savedIds)) {
            savedIds.forEach(id => this.unlockedIds.add(id));
        }

        const savedStats = userProfile.data?.stats || userProfile.stats || {};
        this.metrics = { ...this.metrics, ...savedStats };
    }

    check(updates) {
        // If we haven't loaded user data yet, don't trigger unlocks to avoid spamming "new" unlocks 
        // that are actually just existing ones we haven't fetched yet.
        if (!this.userId) {
            this.metrics = { ...this.metrics, ...updates };
            return [];
        }

        // Update local metrics
        this.metrics = { ...this.metrics, ...updates };

        const newUnlocks = [];

        ACHIEVEMENTS.forEach(ach => {
            if (this.unlockedIds.has(ach.id)) return; // Already unlocked

            const currentValue = this.metrics[ach.metric] || 0;

            if (currentValue >= ach.target) {
                // UNLOCKED!
                this.unlockedIds.add(ach.id);
                newUnlocks.push(ach);

                // Notify listeners for UI Toasts
                this.listeners.forEach(cb => cb(ach));
            }
        });

        if (newUnlocks.length > 0) {
            this.syncUnlocks(newUnlocks.map(u => u.id), updates);
        }

        return newUnlocks;
    }

    /**
     * Calculate progress percentage for a specific achievement
     */
    getProgress(achievementId) {
        const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!ach) return 0;
        if (this.unlockedIds.has(achievementId)) return 100;

        const current = this.metrics[ach.metric] || 0;
        const target = ach.target || 1;

        return Math.min(100, Math.round((current / target) * 100));
    }

    /**
     * Get current value for an achievement's metric
     */
    getCurrentValue(achievementId) {
        const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!ach) return 0;
        return this.metrics[ach.metric] || 0;
    }

    /**
     * Subscribe to sync events (for query invalidation)
     */
    onSync(callback) {
        if (!this.syncListeners) this.syncListeners = [];
        this.syncListeners.push(callback);
        return () => {
            this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Persist unlocks to backend
     */
    async syncUnlocks(newIds, statsUpdates = {}) {
        try {
            console.log('[AchievementService] Syncing unlocks:', newIds);

            if (!this.userId) {
                console.warn('[AchievementService] No userId loaded, cannot sync.');
                return;
            }

            // Calls new atomic endpoint
            await api.post(`/api/users/${this.userId}/achievements`, {
                achievements: newIds,
                stats: statsUpdates // We send the partial updates to be merged server-side
            });

            // Notify sync listeners so they can refresh profiles
            if (this.syncListeners) {
                this.syncListeners.forEach(cb => cb());
            }

        } catch (err) {
            console.error('Failed to sync achievements', err);
        }
    }

    // Calls new atomic endpoint
    /**
     * RESET achievements (Admin/Debug)
     */
    reset() {
        this.unlockedIds.clear();
        this.metrics = {
            total_cards: 0,
            total_value: 0,
            foil_count: 0,
            audits_completed: 0,
            perfect_audits: 0,
            decks_created: 0,
            account_age_days: 0
        };
        console.log('[AchievementService] Reset complete');
        // Ideally sync this reset to backend too
        if (this.userId) {
            this.syncUnlocks([]); // Sync empty list
        }
    }
}

export const achievementService = new AchievementService();
