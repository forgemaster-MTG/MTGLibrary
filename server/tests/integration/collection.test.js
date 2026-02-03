
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { knex } from '../../db.js';

// Mock Auth Middleware
vi.mock('../../middleware/auth.js', () => ({
    default: (req, res, next) => {
        const testUserId = req.headers['x-test-user-id'];
        if (testUserId) {
            req.user = { id: parseInt(testUserId), username: 'TestUser', firestore_id: 'test_uid' };
            next();
        } else {
            res.status(401).json({ error: 'unauthorized' });
        }
    }
}));

import { app } from '../../index.js';

describe('Collection API Integration', () => {
    let testUserId;
    let cardId;

    beforeAll(async () => {
        const [user] = await knex('users').insert({
            firestore_id: 'test_coll_user_' + Date.now(),
            email: 'colltest@example.com',
            username: 'CollectionTester',
            settings: { override_tier: 'pro' } // Ensure no limits for test
        }).returning('*');
        testUserId = user.id;
    });

    afterAll(async () => {
        if (testUserId) {
            await knex('user_cards').where({ user_id: testUserId }).del();
            await knex('users').where({ id: testUserId }).del();
        }
        await knex.destroy();
    });

    it('should add a card to collection', async () => {
        const payload = {
            scryfall_id: 'test_scryfall_1',
            name: 'Black Lotus',
            set_code: 'LEA',
            collector_number: '232',
            finish: 'nonfoil',
            count: 1
        };

        const res = await request(app)
            .post('/api/collection')
            .set('x-test-user-id', testUserId)
            .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Black Lotus');
        expect(res.body.count).toBe(1);
        cardId = res.body.id;
    });

    it('should increment count if adding existing card', async () => {
        const payload = {
            scryfall_id: 'test_scryfall_1',
            name: 'Black Lotus',
            set_code: 'LEA',
            collector_number: '232',
            finish: 'nonfoil',
            count: 2
        };

        const res = await request(app)
            .post('/api/collection')
            .set('x-test-user-id', testUserId)
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(cardId); // Same ID
        expect(res.body.count).toBe(3); // 1 + 2
    });

    it('should list collection with filters', async () => {
        const res = await request(app)
            .get('/api/collection')
            .query({ name: 'Lotus' })
            .set('x-test-user-id', testUserId);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].name).toBe('Black Lotus');
    });

    it('should batch delete cards', async () => {
        const res = await request(app)
            .delete('/api/collection/batch/delete') // The endpoint is specifically for batch deletion
            .set('x-test-user-id', testUserId)
            .send({ cardIds: [cardId] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify empty
        const list = await request(app)
            .get('/api/collection')
            .set('x-test-user-id', testUserId);

        expect(list.body.length).toBe(0);
    });
});
