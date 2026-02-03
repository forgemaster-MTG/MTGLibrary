import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

import { validate } from '../middleware/validate.js';
import { userUpdateSchema, userPermissionsSchema, bulkDeleteSchema } from '../schemas/userSchemas.js';
import { userService } from '../services/userService.js';

const router = express.Router();

// List users (admin use) - protected
// List users (admin use) - protected
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await knex('users')
      .select(
        'users.id',
        'users.firestore_id',
        'users.email',
        'users.username',
        'users.settings',
        'users.data',
        'users.subscription_tier',
        'users.override_tier',
        'users.subscription_status',
        'users.created_at',
        'users.created_at',
        'users.created_at as last_login',
        knex.raw('(SELECT COUNT(*) FROM user_cards WHERE user_cards.user_id = users.id)::int as card_count'),
        knex.raw('(SELECT COUNT(*) FROM user_decks WHERE user_decks.user_id = users.id)::int as deck_count')
      )
      .limit(200);

    // DEBUG: Check counts
    const totalCards = await knex('user_cards').count('id as count').first();
    const totalDecks = await knex('user_decks').count('id as count').first();
    console.log(`[users] DEBUG: Total Cards: ${totalCards?.count}, Total Decks: ${totalDecks?.count}`);

    const debugUser = rows.find(r => r.id === 198);
    if (debugUser) {
      console.log('[users] DEBUG USER 198:', JSON.stringify(debugUser, null, 2));
    }

    if (rows.length > 0) {
      console.log('[users] First User:', JSON.stringify(rows[0], null, 2));
    }

    res.json(rows);
  } catch (err) {
    console.error('[users] list error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  res.json(req.user);
});

// Get user by id (protected)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const r = await knex('users').where({ id: req.params.id }).first();
    if (!r) return res.status(404).json({ error: 'not found' });
    res.json(r);
  } catch (err) {
    console.error('[users] get error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Update user (protected, user can update their own row)
// Update user (protected, user can update their own row)
router.put('/:id', authMiddleware, validate({ body: userUpdateSchema }), async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const updatedUser = await userService.updateUserProfile(userId, req.body, req.user);
    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
});

// Update Permissions & Subscription (Admin Only)
router.put('/:id/permissions', authMiddleware, validate({ body: userPermissionsSchema }), async (req, res) => {
  try {
    const adminUser = req.user;
    const isRoot = adminUser.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
    if (!isRoot && !adminUser.settings?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const targetId = parseInt(req.params.id, 10);
    const { permissions, isAdmin, subscription_tier, user_override_tier, subscription_status } = req.body;

    // Helper to compare tiers
    const TIER_LEVELS = {
      'free': 0,
      'tier_1': 1,
      'tier_2': 2,
      'tier_3': 3,
      'tier_4': 4,
      'tier_5': 5
    };

    // subscription_tier, user_override_tier, subscription_status are optional updates

    const user = await knex('users').where({ id: targetId }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 1. Update Settings (Permissions/Admin)
    const newSettings = {
      ...user.settings,
      permissions: permissions !== undefined ? permissions : user.settings?.permissions,
      isAdmin: isAdmin !== undefined ? isAdmin : user.settings?.isAdmin
    };

    // 2. Validate Tier Constraint logic
    // If Admin attempts to change tier, ensure it's not below the PAID tier (if active)
    if (subscription_tier && user.stripe_subscription_id && user.stripe_customer_id) {
      try {
        const { stripe, mapPriceToTier } = await import('../services/stripe.js');
        if (stripe) {
          const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
          if (sub && sub.status === 'active') {
            const priceId = sub.items.data[0].price.id;
            let paidTier = mapPriceToTier(priceId);

            // Safety: If active sub but price unknown (e.g. config mismatch), treat as at least Tier 1
            if (paidTier === 'free') {
              console.warn(`[UserUpdate] Active sub ${sub.id} has unknown price ${priceId}. Assuming Tier 1.`);
              paidTier = 'tier_1';
            }

            if (TIER_LEVELS[subscription_tier] < TIER_LEVELS[paidTier]) {
              return res.status(400).json({
                error: `Cannot downgrade user below their paid tier (${paidTier}). Upgrade or Cancel subscription first.`
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to validate stripe tier:", e);
        // We allow proceeding if Stripe check fails? Or block? 
        // Let's block to be safe, or just log warn. Block is requested behavior.
        return res.status(500).json({ error: "Failed to validate subscription status with Stripe" });
      }
    }

    // 3. Prepare Subsciption Updates
    const updatePayload = { settings: newSettings };
    if (subscription_tier !== undefined) updatePayload.subscription_tier = subscription_tier;
    if (user_override_tier !== undefined) updatePayload.override_tier = user_override_tier; // Map to DB column 'override_tier'
    if (subscription_status !== undefined) updatePayload.subscription_status = subscription_status;

    const [updated] = await knex('users')
      .where({ id: targetId })
      .update(updatePayload)
      .returning('*');

    res.json(updated);
  } catch (err) {
    console.error('[users] permissions update error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Public/Friend Profile View
router.get('/public/:id', authMiddleware, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const requesterId = req.user.id;

    // 1. Fetch Basic Info
    const user = await knex('users')
      .where('id', targetId)
      // .select('id', 'username', 'is_public_library', 'data', 'created_at') // Limit fields for privacy
      .first();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // 2. Check Permissions (Public or Friend)
    // 2. Check Permissions (Public or Friend)
    // Check settings for legacy or new location
    const isPublic = user.is_public_library || user.settings?.is_public_library;
    let relationship = null;

    // Use loose comparison or ensure strict types. DB IDs are ints.
    // requesterId (from req.user.id) and targetId (parsed int) should match.
    console.log(`[users] GET /public/${targetId} reqBy=${requesterId}. isPublic=${isPublic}`);

    // EXPLICIT SELF-CHECK
    // If user is viewing themselves, always allow.
    if (String(requesterId) === String(targetId)) {
      console.log('[users] Self-access granted.');
      relationship = { status: 'accepted', isSelf: true };
    }
    else if (String(requesterId) !== String(targetId)) {
      const rel = await knex('user_relationships')
        .where(b => b.where('requester_id', requesterId).andWhere('addressee_id', targetId))
        .orWhere(b => b.where('requester_id', targetId).andWhere('addressee_id', requesterId))
        .first();

      if (rel) {
        relationship = {
          id: rel.id,
          status: rel.status,
          type: rel.type,
          direction: rel.requester_id === requesterId ? 'outgoing' : 'incoming'
        };
        console.log(`[users] Relationship found: ${rel.status}`);
      } else {
        console.log(`[users] No relationship found.`);
      }
    } else {
      relationship = { status: 'accepted', isSelf: true };
      console.log(`[users] Is Self.`);
    }

    if (!isPublic && (!relationship || relationship.status !== 'accepted')) {
      console.warn(`[users] Access Denied. Public=${isPublic}, RelStatus=${relationship?.status}`);
      return res.status(403).json({ error: 'Profile is private' });
    }

    // 3. Return Safe Profile Data
    // Hide email, sensitive settings, etc.
    const safeProfile = {
      id: user.id,
      username: user.username,
      is_public_library: user.is_public_library,
      avatar: user.data?.avatar || null,
      bio: user.data?.bio || null,
      joined_at: user.created_at,
      relationship: relationship,
      playstyle: user.settings?.playstyle || null
    };

    res.json(safeProfile);
  } catch (err) {
    console.error('[users] public profile error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Note: Placed ABOVE the delete endpoint to avoid route conflicts if any 
// (though delete is specific verb)

// Bulk Data Deletion (Protected, Danger Zone)
// Bulk Data Deletion (Protected, Danger Zone)
router.delete('/me/data', authMiddleware, validate({ body: bulkDeleteSchema }), async (req, res, next) => {
  try {
    const { target } = req.body; // 'decks', 'collection', 'wishlist', 'all'
    const userId = req.user.id; // Corrected: was req.user.id in original but userId sometimes parsed. Auth middleware guarantees req.user.id is integer.

    await userService.bulkDeleteData(userId, target);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Sync Achievements & Stats (Atomic)
router.post('/:id/achievements', authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (req.user.id !== userId && !req.user.settings?.isAdmin) {
      return res.status(403).json({ error: 'not allowed' });
    }

    const { achievements, stats } = req.body;

    await knex.transaction(async (trx) => {
      const user = await trx('users').where({ id: userId }).first();
      if (!user) throw new Error('User not found');

      const existingData = user.data || {};
      const existingStats = user.settings?.stats || user.stats || {}; // Accommodate legacy locations
      const existingAchievements = existingData.achievements || [];

      // Merge achievements (Unique set)
      const updatedAchievements = Array.from(new Set([...existingAchievements, ...(achievements || [])]));

      // Merge stats
      const updatedStats = { ...existingStats, ...(stats || {}) };

      await trx('users')
        .where({ id: userId })
        .update({
          data: { ...existingData, achievements: updatedAchievements },
          settings: { ...user.settings, stats: updatedStats }
        });
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[users] achievements sync error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// ADMIN: Delete a user by ID
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const adminUser = req.user;
    const isRoot = adminUser.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
    // Strict Admin Check
    if (!isRoot && !adminUser.settings?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const targetId = parseInt(req.params.id, 10);
    if (!targetId) return res.status(400).json({ error: 'Invalid ID' });

    // Prevent deleting self (use the /me/data or cancellation flow for that, or just block here to be safe)
    if (targetId === adminUser.id) return res.status(400).json({ error: 'Cannot delete yourself from Admin panel.' });

    await knex.transaction(async (trx) => {
      // 1. Delete Dependencies
      await trx('user_cards').where({ user_id: targetId }).del();
      await trx('user_decks').where({ user_id: targetId }).del();
      // If table exists
      // await trx('user_relationships').where({ requester_id: targetId }).orWhere({ addressee_id: targetId }).del(); 

      // 2. Delete User
      const count = await trx('users').where({ id: targetId }).del();
      if (count === 0) throw new Error('User not found');
    });

    res.json({ success: true, id: targetId });
  } catch (err) {
    console.error('[users] admin delete error', err);
    res.status(500).json({ error: 'db error: ' + err.message });
  }
});

export default router;
