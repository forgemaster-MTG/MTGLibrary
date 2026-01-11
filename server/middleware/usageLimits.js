import { knex } from '../db.js';
import { getTierConfig } from '../config/tiers.js';

/**
 * Core logic to check if a user can add a resource.
 * @param {string} userId - User ID
 * @param {string} tierId - User's tier ID
 * @param {string} resourceType - 'decks', 'collection', 'wishlist'
 * @param {number} amount - Amount to add
 * @throws {Error} - If limit is reached
 */
export async function verifyLimit(userId, tierId, resourceType, amount = 1) {
    const config = getTierConfig(tierId);
    const limit = config.limits[resourceType];

    // If infinity, pass
    if (limit === Infinity) return;

    // Count current usage
    let currentCount = 0;

    if (resourceType === 'decks') {
        const result = await knex('user_decks')
            .where({ user_id: userId })
            .count('id as count')
            .first();
        currentCount = parseInt(result.count, 10);
    } else if (resourceType === 'collection') {
        const result = await knex('user_cards')
            .where({ user_id: userId })
            .andWhere(function () {
                this.whereNull('deck_id').orWhereNotNull('deck_id');
            })
            .where('is_wishlist', false)
            .sum('count as total_cards')
            .first();
        currentCount = parseInt(result.total_cards || 0, 10);
    } else if (resourceType === 'wishlist') {
        const result = await knex('user_cards')
            .where({ user_id: userId })
            .where('is_wishlist', true)
            .sum('count as total_cards')
            .first();
        currentCount = parseInt(result.total_cards || 0, 10);
    }

    if (currentCount + amount > limit) {
        const error = new Error(`Limit reached for ${resourceType}`);
        error.code = 'LIMIT_REACHED';
        error.limit = limit;
        error.current = currentCount;
        error.tier = config.name;
        // error.status = 403; // Optional metadata
        throw error;
    }
}

/**
 * Middleware factory to check limits before allowing an action.
 */
export function checkLimit(resourceType, amount = 1) {
    return async (req, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

            const tierId = req.user.override_tier || req.user.subscription_tier || 'free';

            await verifyLimit(req.user.id, tierId, resourceType, amount);

            next();

        } catch (err) {
            if (err.code === 'LIMIT_REACHED') {
                return res.status(403).json({
                    error: err.message,
                    code: err.code,
                    limit: err.limit,
                    current: err.current,
                    tier: err.tier
                });
            }
            console.error('[usageLimits] error', err);
            res.status(500).json({ error: 'Failed to verify usage limits' });
        }
    };
}
