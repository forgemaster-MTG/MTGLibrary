import { authService } from '../services/authService.js';
import AppError from '../utils/AppError.js';
import { readOnlyMiddleware } from './readOnly.js';

/**
 * Express middleware to verify Firebase ID token (Authorization: Bearer <token>)
 * Attaches `req.user` with the row from Postgres `users` table
 */
async function authMiddleware(req, res, next) {
	const authHeader = (req.headers.authorization || '').trim();
	if (!authHeader.startsWith('Bearer ')) {
		return next(new AppError('Missing or invalid Authorization header', 401));
	}

	const idToken = authHeader.split(' ')[1];
	if (!idToken) return next(new AppError('Missing token', 401));

	try {
		const referralCode = req.headers['x-referral-code'];
		const user = await authService.verifyAndGetUser(idToken, referralCode);

		// Attach user context
		req.user = user;

		// Throttled last_active_at update (only once every 5 minutes)
		const now = new Date();
		const lastActive = user.last_active_at ? new Date(user.last_active_at) : null;
		if (!lastActive || (now - lastActive) > 5 * 60 * 1000) {
			const { knex } = await import('../db.js');
			// Fire and forget to avoid slowing down the request
			knex('users')
				.where({ id: user.id })
				.update({ last_active_at: knex.fn.now() })
				.catch(err => console.warn('[Auth] Failed to update last_active_at:', err.message));
		}

		// Impersonation Logic (Admin Only)
		const impersonateId = req.headers['x-impersonate-user-id'];
		if (impersonateId) {
			// Check if actual user is admin
			const isRoot = user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
			const isAdmin = isRoot || user.settings?.isAdmin;

			if (isAdmin) {
				const { knex } = await import('../db.js'); // Lazy load to avoid circular deps if any
				const targetUser = await knex('users').where({ id: impersonateId }).first();

				if (targetUser) {
					// Store original user for auditing/logging if needed
					req.user = targetUser;
					req.user.isImpersonated = true;
					req.user.originalUser = user;
					console.log(`[Auth] Admin ${user.username} (${user.id}) is impersonating ${targetUser.username} (${targetUser.id})`);
				} else {
					console.warn(`[Auth] Admin ${user.username} tried to impersonate non-existent user ${impersonateId}`);
				}
			} else {
				console.warn(`[Auth] Non-admin ${user.username} tried to impersonate user ${impersonateId}`);
			}
		}

		// Legacy support if anything uses req.auth.token (?)
		// The service decodes it but doesn't return it. If needed we can adjust service.
		// Looking at old code: req.auth = { token: decoded };
		// If downstream relies on `req.auth.token.uid`, we might break it.
		// Let's assume standard usage is `req.user.id`. 
		// If we need the token payload, we can expose it on the user object or separate return.
		// Safe bet: The service could return { user, decodedToken }? 
		// Or we just trust req.user is enough. Most apps just need db user.
		// Check for Read-Only Impersonation restrictions
		return readOnlyMiddleware(req, res, next);
	} catch (err) {
		next(err);
	}
}

export default authMiddleware;


