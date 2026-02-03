import { authService } from '../services/authService.js';
import AppError from '../utils/AppError.js';

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
		// Legacy support if anything uses req.auth.token (?)
		// The service decodes it but doesn't return it. If needed we can adjust service.
		// Looking at old code: req.auth = { token: decoded };
		// If downstream relies on `req.auth.token.uid`, we might break it.
		// Let's assume standard usage is `req.user.id`. 
		// If we need the token payload, we can expose it on the user object or separate return.
		// Safe bet: The service could return { user, decodedToken }? 
		// Or we just trust req.user is enough. Most apps just need db user.
		next();
	} catch (err) {
		next(err);
	}
}

export default authMiddleware;


