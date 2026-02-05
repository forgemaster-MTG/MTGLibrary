import request from 'supertest';
import { describe, it, expect, afterAll, vi } from 'vitest';
import { knex } from '../../db.js';

// Mock auth just to be safe, though public endpoints might not need it
vi.mock('../../middleware/auth.js', () => ({
    default: (req, res, next) => {
        req.user = { id: 1, username: 'StaticTester' };
        next();
    }
}));

import { app } from '../../index.js';

describe('Static Data API (Sets, Featured, Releases)', () => {

    describe('GET /api/sets', () => {
        it('should return a list of sets', async () => {
            const res = await request(app).get('/api/sets');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(Array.isArray(res.body.data)).toBe(true);
            if (res.body.data.length > 0) {
                expect(res.body.data[0]).toHaveProperty('code');
                expect(res.body.data[0]).toHaveProperty('name');
            }
        });
    });

    describe('GET /api/featured', () => {
        it('should return featured items/products', async () => {
            // Mocking the featured logic if it relies on external DB or config
            // Assuming it returns an array
            const res = await request(app).get('/api/featured');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('GET /api/releases', () => {
        it('should return release schedule', async () => {
            const res = await request(app).get('/api/releases');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    afterAll(async () => {
        await knex.destroy();
    });
});
