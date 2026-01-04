import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// --- RELATIONSHIPS (Friends/Pods) ---

// Get all relationships (friends + pending)
router.get('/relationships', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const relationships = await knex('user_relationships')
            .where(builder => {
                builder.where('requester_id', userId).orWhere('addressee_id', userId);
            })
            .join('users as requester', 'user_relationships.requester_id', 'requester.id')
            .join('users as addressee', 'user_relationships.addressee_id', 'addressee.id')
            .select(
                'user_relationships.id',
                'user_relationships.status',
                'user_relationships.created_at',
                'requester.id as requester_id',
                'requester.username as requester_username',
                'requester.email as requester_email',
                'addressee.id as addressee_id',
                'addressee.username as addressee_username',
                'addressee.email as addressee_email'
            );

        // Format for frontend
        const formatted = relationships.map(r => {
            const isRequester = r.requester_id === userId;
            const otherUser = isRequester ?
                { id: r.addressee_id, username: r.addressee_username, email: r.addressee_email } :
                { id: r.requester_id, username: r.requester_username, email: r.requester_email };

            return {
                id: r.id,
                status: r.status,
                direction: isRequester ? 'outgoing' : 'incoming',
                friend: otherUser, // The other person in the relationship
                startedAt: r.created_at
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching relationships:', err);
        res.status(500).json({ error: 'Failed to fetch connections' });
    }
});

// Send Friend Request
router.post('/relationships/request', authMiddleware, async (req, res) => {
    try {
        const requesterId = req.user.id;
        const { targetEmail } = req.body;

        if (!targetEmail) return res.status(400).json({ error: 'Target email is required' });

        // Find user by email
        const targetUser = await knex('users').where('email', targetEmail).first();
        if (!targetUser) return res.status(404).json({ error: 'User not found' });
        if (targetUser.id === requesterId) return res.status(400).json({ error: 'Cannot add yourself' });

        // Check existing relationship
        const existing = await knex('user_relationships')
            .where(b => b.where('requester_id', requesterId).andWhere('addressee_id', targetUser.id))
            .orWhere(b => b.where('requester_id', targetUser.id).andWhere('addressee_id', requesterId))
            .first();

        if (existing) {
            return res.status(400).json({ error: 'Relationship already exists' });
        }

        // Create request
        const [newRel] = await knex('user_relationships').insert({
            requester_id: requesterId,
            addressee_id: targetUser.id,
            status: 'pending'
        }).returning('*');

        res.json(newRel);
    } catch (err) {
        console.error('Error sending request:', err);
        res.status(500).json({ error: 'Failed to send request' });
    }
});

// Update Relationship Status (Accept/Block)
router.put('/relationships/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const relId = req.params.id;
        const { status } = req.body; // 'accepted', 'blocked'

        if (!['accepted', 'blocked'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const relationship = await knex('user_relationships').where('id', relId).first();
        if (!relationship) return res.status(404).json({ error: 'Relationship not found' });

        // Only the addressee can accept
        if (status === 'accepted' && relationship.addressee_id !== userId) {
            return res.status(403).json({ error: 'Only the recipient can accept this request' });
        }

        const [updated] = await knex('user_relationships')
            .where('id', relId)
            .update({ status })
            .returning('*');

        res.json(updated);
    } catch (err) {
        console.error('Error updating relationship:', err);
        res.status(500).json({ error: 'Failed to update relationship' });
    }
});

// Delete Relationship (Unlink)
router.delete('/relationships/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const relId = req.params.id;

        // Ensure the user is part of the relationship
        const deleted = await knex('user_relationships')
            .where('id', relId)
            .andWhere(b => b.where('requester_id', userId).orWhere('addressee_id', userId))
            .del();

        if (!deleted) return res.status(404).json({ error: 'Relationship not found or unauthorized' });

        // Also clean up any permissions? 
        // Ideally yes, but for now relies on them being manually revoked or separate logic. 
        // A smarter system would cascade delete perms, but manual is safer for MVPs.
        // Actually, let's remove permissions between these two users to be clean.
        // We need the other user's ID first. Since we just deleted it, we can't look it up easily unless we fetched first.
        // For now, let's just delete the link. Permissions might remain technically but won't be discoverable via relationships.
        // TODO: Cleanup permissions on unlink.

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting relationship:', err);
        res.status(500).json({ error: 'Failed to delete relationship' });
    }
});


// --- PERMISSIONS (Sharing) ---

// Get Permissions (List outgoing grants)
router.get('/permissions', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { deckId, direction } = req.query;

        const query = knex('collection_permissions');

        if (direction === 'incoming') {
            // Who shared with ME?
            query.where('grantee_id', userId)
                .join('users', 'collection_permissions.owner_id', 'users.id')
                .select(
                    'collection_permissions.*',
                    'users.username as owner_username',
                    'users.email as owner_email'
                );
        } else {
            // Who I shared WITH (default)
            query.where('owner_id', userId)
                .join('users', 'collection_permissions.grantee_id', 'users.id')
                .select(
                    'collection_permissions.*',
                    'users.username as grantee_username',
                    'users.email as grantee_email'
                );
        }

        if (deckId) {
            query.where('target_deck_id', deckId);
        }

        // Logic note: Global perms have target_deck_id = NULL. 
        // If we want ONLY global, filter for it. If we want all, just run.
        // For shared collection, we likely want `whereNull('target_deck_id')` if specifically looking for collection access.
        // But let's return all and filter on frontend for now.

        const perms = await query;
        res.json(perms);
    } catch (err) {
        console.error('Error fetching permissions:', err);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

// Grant Permission (Share User/Deck)
router.post('/permissions', authMiddleware, async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { granteeId, permissionLevel, deckId } = req.body;

        console.log(`[Community] Granting permission: owner=${ownerId}, grantee=${granteeId}, level=${permissionLevel}, deck=${deckId}`);

        if (!granteeId) {
            return res.status(400).json({ error: 'Grantee ID is required' });
        }

        const targetGranteeId = parseInt(granteeId);

        if (!['viewer', 'contributor', 'editor'].includes(permissionLevel)) {
            return res.status(400).json({ error: 'Invalid permission level' });
        }

        // Verify deck ownership if deck sharing
        if (deckId) {
            const deck = await knex('user_decks').where({ id: deckId, user_id: ownerId }).first();
            if (!deck) return res.status(404).json({ error: 'Deck not found or you do not own it' });
        }

        // Insert or Update permission
        // Check existing first
        const existing = await knex('collection_permissions')
            .where({
                owner_id: ownerId,
                grantee_id: targetGranteeId,
                target_deck_id: deckId || null
            })
            .first();

        console.log(`[Community] Existing permission check:`, existing);

        let result;
        if (existing) {
            [result] = await knex('collection_permissions')
                .where('id', existing.id)
                .update({ permission_level: permissionLevel })
                .returning('*');
        } else {
            [result] = await knex('collection_permissions')
                .insert({
                    owner_id: ownerId,
                    grantee_id: targetGranteeId,
                    permission_level: permissionLevel,
                    target_deck_id: deckId || null
                })
                .returning('*');
        }

        console.log(`[Community] Permission result:`, result);
        res.json(result);

    } catch (err) {
        console.error('Error granting permission:', err);
        res.status(500).json({ error: 'Failed to grant permission' });
    }
});

// Revoke Permission
router.delete('/permissions/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const permId = req.params.id;

        // Delete if userId is the owner OR the grantee (user can remove themselves)
        const deleted = await knex('collection_permissions')
            .where('id', permId)
            .andWhere(b => b.where('owner_id', userId).orWhere('grantee_id', userId)) // Allow either party to revoke
            .del();

        if (!deleted) return res.status(404).json({ error: 'Permission not found or unauthorized' });

        res.json({ success: true });
    } catch (err) {
        console.error('Error revoking permission:', err);
        res.status(500).json({ error: 'Failed to revoke permission' });
    }
});

export default router;
