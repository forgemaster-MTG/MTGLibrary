import { knex } from '../db.js';
import { PricingService } from './PricingService.js';

export const CreditResetService = {
    /**
     * Resets monthly credits for all users based on their current tier.
     * This should be run monthly.
     */
    async resetAllUsers() {
        console.log('[CreditResetService] Starting global monthly credit reset...');

        try {
            // Fetch all tiers to ensure we have the latest limits
            const config = await PricingService.getConfig();
            const tiers = ['free', 'tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5'];

            let totalUpdated = 0;
            const now = new Date();

            for (const tierId of tiers) {
                const limit = await PricingService.getLimitForTier(tierId);

                const count = await knex('users')
                    .where({ subscription_tier: tierId })
                    .update({
                        credits_monthly: limit,
                        last_credit_reset: now
                    });

                console.log(`[CreditResetService] Reset ${count} users in tier: ${tierId} to ${limit.toLocaleString()} credits.`);
                totalUpdated += count;
            }

            console.log(`[CreditResetService] Successfully reset ${totalUpdated} users.`);
            return totalUpdated;
        } catch (err) {
            console.error('[CreditResetService] Global reset failed:', err);
            throw err;
        }
    },

    /**
     * Resets credits for a specific user.
     */
    async resetUser(userId) {
        const user = await knex('users').where({ id: userId }).first();
        if (!user) throw new Error('User not found');

        const limit = await PricingService.getLimitForTier(user.subscription_tier);
        const now = new Date();

        await knex('users')
            .where({ id: userId })
            .update({
                credits_monthly: limit,
                last_credit_reset: now
            });

        console.log(`[CreditResetService] Reset credits for ${user.username || user.email} to ${limit.toLocaleString()}`);
        return limit;
    },

    /**
     * Checks if a user's credits need resetting (older than 30 days) and triggers reset if so.
     */
    async checkAndResetUser(userId) {
        try {
            const user = await knex('users')
                .select('id', 'last_credit_reset', 'subscription_tier', 'username')
                .where({ id: userId })
                .first();

            if (!user) return;

            const now = new Date();
            const lastReset = user.last_credit_reset ? new Date(user.last_credit_reset) : null;

            // If never reset, or reset more than 30 days ago
            // 30 days = 30 * 24 * 60 * 60 * 1000 ms
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

            if (!lastReset || (now - lastReset) > thirtyDaysMs) {
                console.log(`[CreditResetService] Automated reset triggered for ${user.username || user.id}. Days since last: ${lastReset ? ((now - lastReset) / 1000 / 60 / 60 / 24).toFixed(1) : 'NEVER'}`);
                await this.resetUser(userId);
            }
        } catch (err) {
            console.error(`[CreditResetService] Error checking reset for user ${userId}:`, err);
        }
    }
};
