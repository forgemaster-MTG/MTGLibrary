
import admin from '../firebaseAdmin.js';
import { knex } from '../db.js';
import AppError from '../utils/AppError.js';
import { PricingService } from './PricingService.js';


class AuthService {
    /**
     * Verifies Firebase token, finds/creates user, and handles post-creation logic.
     * @param {string} token - The Bearer token
     * @param {string} [referralCode] - Optional referral code from headers
     * @returns {Promise<Object>} The user row
     */
    async verifyAndGetUser(token, referralCode = null) {
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (err) {
            throw new AppError('Invalid or expired token', 401);
        }

        const { uid, email } = decodedToken;

        // 1. Try to find user in local DB by Firestore ID
        let user = await knex('users').where({ firestore_id: uid }).first();

        // 2. Fallback: Find by Email (Link accounts)
        if (!user && email) {
            user = await knex('users').whereRaw('lower(email) = ?', [email.toLowerCase()]).first();
            if (user) {
                console.log(`[AuthService] Linked new auth UID ${uid} to existing user ${user.id} (${user.email})`);
                // Note: We don't overwrite firestore_id here to avoid breaking other logins, but sharing the row is fine.
            }
        }

        // 3. Create User & Process Onboarding if not found
        if (!user) {
            user = await this.createNewUser(decodedToken, referralCode);
        }

        return user;
    }

    async createNewUser(decodedToken, referralCode) {
        const { uid, email } = decodedToken;
        let referredById = null;

        // Resolve Referral Code
        if (referralCode) {
            try {
                const referrer = await knex('users')
                    .where({ username: referralCode })
                    .orWhere({ firestore_id: referralCode })
                    .first();
                if (referrer) {
                    referredById = referrer.id;
                    console.log(`[AuthService] Resolved referral code '${referralCode}' to user ${referrer.id}`);
                }
            } catch (err) {
                console.warn('[AuthService] Failed to resolve referral:', err);
            }
        }

        // Fetch additional profile data from Firestore (if available)
        let profile = null;
        try {
            const doc = await admin.firestore().collection('users').doc(uid).get();
            if (doc.exists) profile = doc.data();
        } catch (err) {
            // Ignore firestore errors
        }

        // START FIX: Get Initial Credits
        const initialCredits = await PricingService.getLimitForTier('free');
        // END FIX

        // Insert new user
        const insertData = {
            firestore_id: uid,
            email: email || (profile && profile.email) || null,
            data: { firebase: decodedToken, profile }, // Store raw providers data
            referred_by: referredById,
            credits_monthly: initialCredits,
        };


        // Try insert
        let user;
        try {
            const [newUser] = await knex('users').insert(insertData).returning('*');
            user = newUser;
        } catch (err) {
            // Retry fetch in case of race condition
            user = await knex('users').where({ firestore_id: uid }).first();
        }

        if (!user) throw new AppError('Failed to create user account', 500);

        // Run Post-Creation Async Tasks (don't await them to speed up response?)
        // Actually, better to await to ensure consistency for first login.
        await this.handlePostCreation(user);

        return user;
    }

    async handlePostCreation(user) {
        // 1. Link Referrer as Friend
        if (user.referred_by) {
            try {
                await knex('user_relationships').insert({
                    requester_id: user.referred_by,
                    addressee_id: user.id,
                    status: 'accepted',
                    type: 'friend'
                }).onConflict(['requester_id', 'addressee_id']).merge();
            } catch (err) {
                console.error('[AuthService] Referral linking failed:', err);
            }
        }

        // 2. Process Pending Email Invitations
        if (user.email) {
            try {
                const pendingInvites = await knex('pending_external_invitations')
                    .where({ invitee_email: user.email, status: 'pending' });

                for (const invite of pendingInvites) {
                    await knex('user_relationships').insert({
                        requester_id: invite.inviter_id,
                        addressee_id: user.id,
                        status: 'accepted',
                        type: invite.type || 'pod'
                    }).onConflict(['requester_id', 'addressee_id']).merge();

                    await knex('pending_external_invitations')
                        .where({ id: invite.id })
                        .update({ status: 'completed' });
                }
            } catch (err) {
                console.error('[AuthService] Invitation processing failed:', err);
            }
        }
    }
}

export const authService = new AuthService();
