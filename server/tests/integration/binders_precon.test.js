import request from 'supertest';
import { describe, it, expect, afterAll, vi } from 'vitest';

// Mock auth middleware BEFORE importing app
vi.mock('../../middleware/auth.js', () => ({
    default: (req, res, next) => {
        req.user = { id: 1, email: 'test@example.com' }; // Mock authenticated user
        next();
    }
}));

import { app } from '../../index.js';
import { knex } from '../../db.js';

describe('Binders & Precons API', () => {

    describe('GET /api/binders', () => {
        it('should return a list of binders', async () => {
            const res = await request(app).get('/api/binders');
            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBe(true);

            if (res.body.length > 0) {
                const binder = res.body[0];
                expect(binder).toHaveProperty('id');
                // The actual property might be 'name' or 'title' depending on DB schema, 
                // but checking for ID ensures we got an object.
            }
        });
    });

    describe('GET /api/precons', () => {
        it('should return a list of precons', async () => {
            const res = await request(app).get('/api/precons');
            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    afterAll(async () => {
        await knex.destroy();
    });
});
