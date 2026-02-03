
import { knex } from '../db.js';
import AppError from '../utils/AppError.js';

class UserService {
    async getUserById(id) {
        return await knex('users').where({ id }).first();
    }

    /**
     * Updates a user profile, handling special fields like subscriptions, settings, and referrals.
     * @param {number} userId - ID of user to update
     * @param {Object} payload - Raw body data from request
     * @param {Object} actor - The user performing the update (req.user)
     */
    async updateUserProfile(userId, payload, actor) {
        // Authorization Logic
        const isSelf = actor.id === userId;
        const isAdmin = actor.settings?.isAdmin || actor.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';

        if (!isSelf && !isAdmin) {
            throw new AppError('Not authorized to update this user', 403);
        }

        const { email, username, first_name, last_name, is_public_library, settings, data, lfg_status } = payload;

        // Deep copy settings or init new
        let newSettings = settings ? { ...settings } : {};
        const updateData = {};

        // --- Subscription & Tier Logic ---
        // Extract root columns from settings if present (Backward comp with clients sending everything in settings)
        const { subscription_status, subscription_tier, trial_start_date, trial_end_date } = newSettings;
        if (subscription_status !== undefined) {
            updateData.subscription_status = subscription_status;
            delete newSettings.subscription_status;
        }
        if (subscription_tier !== undefined) {
            updateData.subscription_tier = subscription_tier;
            delete newSettings.subscription_tier;
        }
        if (trial_start_date !== undefined) {
            updateData.trial_start_date = trial_start_date;
            delete newSettings.trial_start_date;
        }
        if (trial_end_date !== undefined) {
            updateData.trial_end_date = trial_end_date;
            delete newSettings.trial_end_date;
        }

        if (is_public_library !== undefined) newSettings.is_public_library = is_public_library;

        if (email !== undefined) updateData.email = email;
        if (username !== undefined) updateData.username = username;
        if (first_name !== undefined) updateData.first_name = first_name;
        if (last_name !== undefined) updateData.last_name = last_name;

        // Settings Merging Logic
        // We only really update settings if it's passed or public lib changed
        if (settings !== undefined || is_public_library !== undefined) {
            if (!isAdmin && isSelf) {
                // Protect critical fields
                const existing = await knex('users').where({ id: userId }).first();
                const existingSettings = existing.settings || {};
                const safeSettings = { ...existingSettings, ...newSettings };

                safeSettings.isAdmin = existingSettings.isAdmin || false;
                safeSettings.permissions = existingSettings.permissions || [];
                updateData.settings = safeSettings;
            } else {
                updateData.settings = newSettings;
            }
        }

        // Referral Code Logic
        if (data && data.referral_code) {
            // Dynamic import to avoid circular dep if utils imports user service? (Unlikely but safe)
            const { processReferralSignup } = await import('../utils/referrals.js');
            await processReferralSignup(userId, data.referral_code);
            delete data.referral_code;
        }

        if (data !== undefined) updateData.data = data;

        if (lfg_status !== undefined) {
            updateData.lfg_status = lfg_status;
            updateData.lfg_last_updated = knex.fn.now();
        }

        const result = await knex('users')
            .where({ id: userId })
            .update(updateData)
            .returning('*');

        const row = Array.isArray(result) ? result[0] : result;
        if (!row) throw new AppError('User not found after update', 404);

        return row;
    }

    // Generic simple update (legacy or admin tools)
    async updateUser(id, data) {
        const result = await knex('users')
            .where({ id })
            .update(data)
            .returning('*');
        return Array.isArray(result) ? result[0] : result;
    }

    async updatePermissions(targetUserId, updates, adminUser) {
        const result = await knex('users')
            .where({ id: targetUserId })
            .update(updates)
            .returning('*');

        return Array.isArray(result) ? result[0] : result;
    }

    async bulkDeleteData(userId, target) {
        const trx = await knex.transaction();
        try {
            if (target === 'decks') {
                // Per old controller logic, decks deleted, cards stay but lose deck_id
                await trx('user_cards').where({ user_id: userId }).whereNotNull('deck_id').update({ deck_id: null });
                await trx('user_decks').where({ user_id: userId }).del();
            }
            else if (target === 'collection') {
                await trx('user_cards').where({ user_id: userId }).del();
            }
            else if (target === 'wishlist') {
                await trx('user_cards').where({ user_id: userId, is_wishlist: true }).del();
            }
            else if (target === 'all') {
                await trx('user_cards').where({ user_id: userId }).del();
                await trx('user_decks').where({ user_id: userId }).del();
            }

            await trx.commit();
            return { success: true };
        } catch (err) {
            await trx.rollback();
            throw new AppError('Bulk delete failed', 500);
        }
    }
}

export const userService = new UserService();
