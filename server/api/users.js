import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// List users (admin use) - protected
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rows = await knex('users').select('id', 'firestore_id', 'email', 'username', 'settings', 'data').limit(200);
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

// Update Permissions (Admin Only)
router.put('/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const adminUser = req.user;
    const isRoot = adminUser.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
    if (!isRoot && !adminUser.settings?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const targetId = parseInt(req.params.id, 10);
    const { permissions, isAdmin } = req.body; // Expect { permissions: ['manage_tickets'], isAdmin: boolean }

    const user = await knex('users').where({ id: targetId }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newSettings = {
      ...user.settings,
      permissions: permissions || [],
      isAdmin: isAdmin === true // Explicit set
    };

    const [updated] = await knex('users')
      .where({ id: targetId })
      .update({ settings: newSettings })
      .returning('*');

    res.json(updated);
  } catch (err) {
    console.error('[users] permissions update error', err);
    res.status(500).json({ error: 'db error' });
  }
});

export default router;
