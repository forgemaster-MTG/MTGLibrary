
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
    /**
     * Deduct credits from user's balance and log the transaction.
     * Prioritizes 'credits_monthly' before 'credits_topup'.
     */
    async deductCredits(userId, cost, description = 'AI Usage', metadata = {}) {
        // Use a transaction to ensure atomicity
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

            // Calculate Deduction Split
            let monthlyDeducted = 0;
            let topupDeducted = 0;

            if (monthly >= cost) {
                monthly -= cost;
                monthlyDeducted = cost;
            } else {
                const remainder = cost - monthly;
                monthlyDeducted = monthly; // All monthly used
                monthly = 0;

                topupDeducted = remainder;
                topup = Math.max(0, topup - remainder);
            }

            // Determine Credit Type for Log
            let creditType = 'monthly';
            if (monthlyDeducted > 0 && topupDeducted > 0) creditType = 'mixed';
            else if (topupDeducted > 0) creditType = 'topup';

            // Update DB
            await trx('users').where({ id: userId }).update({
                credits_monthly: monthly,
                credits_topup: topup
            });

            try {
                await trx('users').where({ id: userId }).increment('ai_credits_used', cost);
            } catch (ignore) { }

            // Log Transaction
            await trx('public.user_credit_logs').insert({
                user_id: userId,
                amount: -cost, // Negative for usage
                balance_after: monthly + topup, // New balance after deduction
                credit_type: creditType,
                transaction_type: 'usage',
                description: description,
                metadata: {
                    ...metadata,
                    monthly_deducted: monthlyDeducted,
                    topup_deducted: topupDeducted
                }
            });

            return { credits_monthly: monthly, credits_topup: topup, total: monthly + topup };
        });
    },

    /**
     * Add credits to user's balance and log the transaction.
     */
    async addCredits(userId, amount, type, description, metadata = {}) {
        return await knex.transaction(async (trx) => {
            const column = type === 'monthly' ? 'credits_monthly' : 'credits_topup';

            // If it's a 'set' operation (like monthly reset), we need to read first? 
            // Usually we increment topups, but SET monthly. 
            // For now, let's assume ADDITION (increment) unless specified.

            if (metadata.operation === 'set') {
                // This is for resets (e.g. monthly subscription renewal sets it to X)
                await trx('users').where({ id: userId }).update({ [column]: amount });
            } else {
                await trx('users').where({ id: userId }).increment(column, amount);
            }

            // Get new balance for logging
            const updatedUser = await trx('users').where({ id: userId }).select('credits_monthly', 'credits_topup').first();
            const newBalance = parseInt(updatedUser.credits_monthly || 0, 10) + parseInt(updatedUser.credits_topup || 0, 10);

            await trx('public.user_credit_logs').insert({
                user_id: userId,
                amount: amount,
                balance_after: newBalance,
                credit_type: type, // 'monthly' or 'topup'
                transaction_type: metadata.transaction_type || 'manual_adjustment',
                description: description,
                metadata: metadata
            });
        });
    }
};
