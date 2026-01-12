import admin from 'firebase-admin';
import { createRequire } from 'module';
import { knex } from '../db.js';

const require = createRequire(import.meta.url);
const serviceAccount = require('../../serviceAccountKey.json');

// Initialize Firebase admin if not already
try {
	if (!admin.apps || admin.apps.length === 0) {
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount)
		});
	}
} catch (e) {
	// If initialization fails, we still want middleware to throw useful errors
	console.error('[auth] firebase-admin init error', e.message || e);
}

/**
 * Express middleware to verify Firebase ID token (Authorization: Bearer <token>)
 * Attaches `req.user` with the row from Postgres `users` table (and `req.user.data` for raw profile)
 */
async function authMiddleware(req, res, next) {
	const authHeader = (req.headers.authorization || '').trim();
	if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
	const idToken = authHeader.split(' ')[1];
	if (!idToken) return res.status(401).json({ error: 'Missing token' });

	try {
		const decoded = await admin.auth().verifyIdToken(idToken);
		const uid = decoded.uid;

		// Try to find user row in Postgres by firestore_id
		let user = await knex('users').where({ firestore_id: uid }).first();

		// If not found, attempt to fetch profile from Firestore 'users' collection
		if (!user) {
			// Check for referral code in headers
			const referralCode = req.headers['x-referral-code'];
			let referredById = null;
			if (referralCode) {
				try {
					// Referral code can be a username or firestore_id/numeric ID (though UI uses username/uid)
					const referrer = await knex('users')
						.where({ username: referralCode })
						.orWhere({ firestore_id: referralCode })
						.first();
					if (referrer) {
						referredById = referrer.id;
						console.log(`[Auth] New user ${decoded.email} referred by ${referrer.username || referrer.id}`);
					}
				} catch (refErr) {
					console.error('[Auth] Failed to resolve referral code:', refErr);
				}
			}

			try {
				const doc = await admin.firestore().collection('users').doc(uid).get();
				const profile = doc.exists ? doc.data() : null;
				const email = decoded.email || (profile && profile.email) || null;
				const insert = {
					firestore_id: uid,
					email,
					data: { firebase: decoded, profile },
					referred_by: referredById
				};
				const insertResult = await knex('users').insert(insert).returning('*');
				user = (Array.isArray(insertResult) ? insertResult[0] : insertResult) || (await knex('users').where({ firestore_id: uid }).first());
			} catch (e) {
				// If Firestore read fails or there is no doc, still create minimal user
				const email = decoded.email || null;
				const insert = {
					firestore_id: uid,
					email,
					data: { firebase: decoded },
					referred_by: referredById
				};
				try {
					const insertResult = await knex('users').insert(insert).returning('*');
					user = (Array.isArray(insertResult) ? insertResult[0] : insertResult) || (await knex('users').where({ firestore_id: uid }).first());
				} catch (e2) {
					// fallback: fetch existing user row again
					user = await knex('users').where({ firestore_id: uid }).first();
				}
			}

			// --- Post-Creation Logic: Check for pending invitations OR referrals ---
			if (user) {
				// 1. Referral Link Connection
				if (user.referred_by) {
					try {
						// Auto-create relationship as 'friend'
						await knex('user_relationships').insert({
							requester_id: user.referred_by,
							addressee_id: user.id,
							status: 'accepted',
							type: 'friend'
						}).onConflict(['requester_id', 'addressee_id']).merge();
						console.log(`[Auth] Auto-linked new user ${user.id} with referrer ${user.referred_by}`);
					} catch (linkErr) {
						console.error('[Auth] Failed to link referral:', linkErr);
					}
				}

				// 2. Pending Email Invitations
				if (user.email) {
					try {
						const pendingInvites = await knex('pending_external_invitations').where({ invitee_email: user.email, status: 'pending' });
						for (const invite of pendingInvites) {
							// Auto-create relationship
							await knex('user_relationships').insert({
								requester_id: invite.inviter_id,
								addressee_id: user.id,
								status: 'accepted', // Automatically accept since they joined via specific invite
								type: invite.type || 'pod'
							}).onConflict(['requester_id', 'addressee_id']).merge();

							// Mark invite as completed
							await knex('pending_external_invitations').where({ id: invite.id }).update({ status: 'completed' });
						}
					} catch (inviteErr) {
						console.error('[AuthMiddleware] Failed to process pending invitations:', inviteErr);
					}
				}
			}
		}

		if (!user) {
			return res.status(500).json({ error: 'Could not create or find user' });
		}

		// attach both firebase decoded token and DB row
		req.auth = { token: decoded };
		req.user = user;
		next();
	} catch (err) {
		console.error('[auth] token verification error', err);
		return res.status(401).json({ error: `Token verification failed: ${err.message}`, details: err.toString() });
	}
}

export default authMiddleware;
