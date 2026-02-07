import AppError from '../utils/AppError.js';

/**
 * Middleware to preventing state-changing operations during impersonation.
 * Should be placed AFTER authMiddleware.
 */
export const readOnlyMiddleware = (req, res, next) => {
    // Only enforce if user is impersonating
    if (req.user && req.user.isImpersonated) {
        // Allow GET, HEAD, OPTIONS
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return next();
        }

        // Block everything else
        console.warn(`[ReadOnly] Blocked ${req.method} request to ${req.originalUrl} by impersonator ${req.user.originalUser.username}`);
        return next(new AppError('Action not allowed while impersonating (Read-Only Mode)', 403));
    }
    next();
};

export default readOnlyMiddleware;
