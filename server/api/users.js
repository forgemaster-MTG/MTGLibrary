import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// List users (admin use) - protected
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await knex('users').select('id', 'firestore_id', 'email', 'username', 'settings', 'data', 'subscription_tier', 'override_tier', 'subscription_status').limit(200);
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
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    // User can update self, ADMIN can update anyone
    const isSelf = req.user.id === userId;
    const isAdmin = req.user.settings?.isAdmin || req.user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';

    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'not allowed' });

    const { email, username, first_name, last_name, settings, data } = req.body;
    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (username !== undefined) updateData.username = username;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (req.body.is_public_library !== undefined) updateData.is_public_library = req.body.is_public_library;

    // Only Admin can update settings directly here (which includes permissions)
    // Or self can update generic settings if we allow it, but let's be safe.
    // Assuming 'settings' passed here merges or replaces. 
    // For specific permission updates, we prefer a dedicated endpoint, but this general update is fine for admin too.
    if (settings !== undefined) {
      // Safe update: deep merge or careful replacement recommended.
      // If regular user, maybe prevent overwriting isAdmin/permissions?
      if (!isAdmin && isSelf) {
        // Protect critical fields if user is updating self
        // Logic: Existing settings + new keys, but preventing privilege escalation
        const existing = await knex('users').where({ id: userId }).first();
        const existingSettings = existing.settings || {};
        const safeSettings = { ...existingSettings, ...(settings || {}) };

        // Restore protected fields from existing to ensure no tampering
        safeSettings.isAdmin = existingSettings.isAdmin || false;
        safeSettings.permissions = existingSettings.permissions || [];
        updateData.settings = safeSettings;
      } else {
        updateData.settings = settings;
      }
    }

    if (data !== undefined) updateData.data = data;
    if (req.body.lfg_status !== undefined) {
      updateData.lfg_status = req.body.lfg_status;
      updateData.lfg_last_updated = knex.fn.now();
    }

    const result = await knex('users')
      .where({ id: userId })
      .update(updateData)
      .returning('*');

    const row = Array.isArray(result) ? result[0] : result;
    if (!row) return res.status(404).json({ error: 'User not found after update' });

    res.json(row);
  } catch (err) {
    console.error('[users] update error', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Update Permissions & Subscription (Admin Only)
router.put('/:id/permissions', authMiddleware, async (req, res) => {
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
    const isPublic = user.is_public_library;
    let relationship = null;

    if (requesterId !== targetId) {
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
      }
    } else {
      relationship = { status: 'accepted', isSelf: true };
    }

    if (!isPublic && (!relationship || relationship.status !== 'accepted')) {
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
      relationship: relationship
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
router.delete('/me/data', authMiddleware, async (req, res) => {
  try {
    const { target } = req.body; // 'decks', 'collection', 'wishlist', 'all'
    const userId = req.user.id;

    if (!['decks', 'collection', 'wishlist', 'all'].includes(target)) {
      return res.status(400).json({ error: 'Invalid target' });
    }

    await knex.transaction(async (trx) => {
      if (target === 'decks') {
        // Delete all decks. Cards in them lose their deck link (return to binder) or are deleted?
        // Logic: "Delete Decks" usually implies deleting the lists. Cards remain in collection.
        // We will set deck_id = NULL for all cards in these decks first to be safe (though ON DELETE SET NULL might exist)
        // Actually, if we delete the deck, we want cards to stay in collection ("Binder").
        await trx('user_cards').where({ user_id: userId }).whereNotNull('deck_id').update({ deck_id: null });
        await trx('user_decks').where({ user_id: userId }).del();
      }
      else if (target === 'collection') {
        // Delete all cards. Decks become empty.
        await trx('user_cards').where({ user_id: userId }).del();
      }
      else if (target === 'wishlist') {
        // Delete only wishlist items
        await trx('user_cards').where({ user_id: userId, is_wishlist: true }).del();
      }
      else if (target === 'all') {
        // Wipe everything
        await trx('user_cards').where({ user_id: userId }).del();
        await trx('user_decks').where({ user_id: userId }).del();
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[users] delete data error', err);
    res.status(500).json({ error: 'db error' });
  }
});

export default router;
