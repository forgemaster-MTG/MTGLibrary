import request from 'supertest';
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import { knex } from '../../db.js';

// Mock auth
vi.mock('../../middleware/auth.js', () => ({
    default: (req, res, next) => {
        // We use the ID that we will create in beforeAll
        const userId = req.headers['x-test-user-id'] || 1;
        req.user = { id: parseInt(userId), username: 'SocialTester' };
        next();
    }
}));

import { app } from '../../index.js';

describe('Social & Gameplay API', () => {
    let testUserId;

    beforeAll(async () => {
        // Create user
        const [user] = await knex('users').insert({
            firestore_id: 'social_test_' + Date.now(),
            email: 'social@example.com',
            username: 'SocialTester'
        }).returning('*');
        testUserId = user.id;
    });

    afterAll(async () => {
        if (testUserId) {
            await knex('users').where({ id: testUserId }).del();
        }
        await knex.destroy();
    });

    describe('GET /api/friends', () => {
        it('should return friends list (empty initially)', async () => {
            const res = await request(app)
                .get('/api/friends')
                .set('x-test-user-id', testUserId);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('friends');
            expect(Array.isArray(res.body.friends)).toBe(true);
            expect(Array.isArray(res.body.pending_sent)).toBe(true);
            expect(Array.isArray(res.body.pending_received)).toBe(true);
        });
    });

    describe('GET /api/community/feed', () => {
        it('should return community feed', async () => {
            const res = await request(app)
                .get('/api/community') // Assuming /api/community is the route for feed/list
                .set('x-test-user-id', testUserId);

            // It might be 200 array or object depending on implementation
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/tournaments', () => {
        it('should create a tournament', async () => {
            const res = await request(app)
                .post('/api/tournaments')
                .set('x-test-user-id', testUserId)
                .send({
                    name: 'Test Tournament',
                    format: 'Commander',
                    date: new Date().toISOString()
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Tournament');
        });
    });
});
