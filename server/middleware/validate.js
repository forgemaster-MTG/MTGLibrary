
import { z } from 'zod';

/**
 * Generic validation middleware
 * @param {Object} schemas - Object containing Zod schemas for { body, query, params }
 */
export const validate = (schemas) => (req, res, next) => {
    try {
        if (schemas.body) {
            req.body = schemas.body.parse(req.body);
        }
        if (schemas.query) {
            req.query = schemas.query.parse(req.query);
        }
        if (schemas.params) {
            req.params = schemas.params.parse(req.params);
        }
        next();
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: (err.errors || []).map(e => ({
                    path: e.path.join('.'),
                    message: e.message
                }))
            });
        }
        next(err);
    }
};
