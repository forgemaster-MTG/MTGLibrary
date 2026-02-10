
import { knex } from '../db.js';

export const CreditService = {
    /**
     * Get current credit balance for a user
     */
    async getUserCredits(userId) {
        const user = await knex('users').where({ id: userId }).select('credits_monthly', 'credits_topup').first();
        if (!user) throw new Error('User not found');
        return {
            credits_monthly: parseInt(user.credits_monthly || 0, 10),
            credits_topup: parseInt(user.credits_topup || 0, 10),
            total: parseInt(user.credits_monthly || 0, 10) + parseInt(user.credits_topup || 0, 10)
        };
    },

    /**
     * Check if user has enough credits without deducting
     */
    async hasSufficientCredits(userId, cost) {
        const { total } = await this.getUserCredits(userId);
        return total >= cost;
    },

    /**
     * Deduct credits from user's balance.
     * Prioritizes 'credits_monthly' before 'credits_topup'.
     */
    async deductCredits(userId, cost) {
        // Use a transaction to ensure atomicity and handle race conditions
        return await knex.transaction(async (trx) => {
            const user = await trx('users')
                .where({ id: userId })
                .select('id', 'credits_monthly', 'credits_topup')
                .forUpdate() // Lock the row
                .first();

            if (!user) throw new Error('User not found');

            let monthly = parseInt(user.credits_monthly || 0, 10);
            let topup = parseInt(user.credits_topup || 0, 10);
            const total = monthly + topup;

            if (total < cost) {
                const error = new Error('Insufficient credits');
                error.code = 'INSUFFICIENT_CREDITS';
                error.current = total;
                error.required = cost;
                throw error;
            }

            // Deduction Logic
            if (monthly >= cost) {
                monthly -= cost;
            } else {
                const remainder = cost - monthly;
                monthly = 0;
                topup = Math.max(0, topup - remainder);
            }

            // Update DB
            await trx('users').where({ id: userId }).update({
                credits_monthly: monthly,
                credits_topup: topup
            });

            // Track detailed usage if needed (optional, checking if usage column exists)
            // We saw 'ai_credits_used' in the schema check.
            try {
                await trx('users').where({ id: userId }).increment('ai_credits_used', cost);
            } catch (ignore) {
                // If column missing or issue, don't fail the deduction
            }

            return { credits_monthly: monthly, credits_topup: topup, total: monthly + topup };
        });
    }
};
