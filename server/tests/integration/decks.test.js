
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { knex } from '../../db.js';

// Mock Auth Middleware to bypass Firebase
// We must mock it BEFORE importing the app
vi.mock('../../middleware/auth.js', () => ({
    default: (req, res, next) => {
        // We will attach the test user dynamically
        // But for this simple mock, we might need a way to pass the user ID.
        // We'll rely on the 'testUser' global or attach it to the request in the test setup? 
        // No, middleware runs on the server.
        // We can use a shared module or just hardcode checking a header?
        // Simplest: Mock returns a user if a specific header is present?
        const testUserId = req.headers['x-test-user-id'];
        if (testUserId) {
            req.user = { id: parseInt(testUserId), username: 'TestUser', firestore_id: 'test_uid' };
            next();
        } else {
            res.status(401).json({ error: 'unauthorized' });
        }
    }
}));

// Import app AFTER mocking
import { app } from '../../index.js';

describe('Decks API Integration', () => {
    let testUserId;
    let deckId;

    beforeAll(async () => {
        // Create Test User
        const [user] = await knex('users').insert({
            firestore_id: 'test_deck_user_' + Date.now(),
            email: 'decktest@example.com',
            username: 'DeckTester'
        }).returning('*');
        testUserId = user.id;
    });

    afterAll(async () => {
        if (testUserId) {
            // Clean up using cascade-like logic manually
            await knex('user_cards').where({ user_id: testUserId }).del();
            await knex('user_decks').where({ user_id: testUserId }).del();
            await knex('users').where({ id: testUserId }).del();
        }
        await knex.destroy();
    });

    it('should create a new deck', async () => {
        const res = await request(app)
            .post('/api/decks')
            .set('x-test-user-id', testUserId)
            .send({
                name: 'Test Deck',
                format: 'Commander',
                commander: { name: 'Sol Ring' }
            });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Test Deck');
        expect(res.body.user_id).toBe(testUserId);
        expect(res.body.is_thematic).toBe(false); // Default
        deckId = res.body.id;
    });

    it('should create a thematic deck', async () => {
        const res = await request(app)
            .post('/api/decks')
            .set('x-test-user-id', testUserId)
            .send({
                name: 'Thematic Test Deck',
                format: 'Commander',
                commander: { name: 'Urza' },
                isThematic: true
            });

        expect(res.status).toBe(201);
        expect(res.body.is_thematic).toBe(true);
        
        // Clean up this specific deck
        await knex('user_decks').where({ id: res.body.id }).del();
    });

    it('should list user decks', async () => {
        const res = await request(app)
            .get('/api/decks')
            .set('x-test-user-id', testUserId);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0].id).toBe(deckId);
    });

    it('should update a deck', async () => {
        const res = await request(app)
            .put(`/api/decks/${deckId}`)
            .set('x-test-user-id', testUserId)
            .send({
                name: 'Updated Deck Name'
            });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Deck Name');
    });

    it('should add cards to deck via batch', async () => {
        // First add a card to DB (Deck needs cards to test batch add logic effectively?)
        // Or batch add can add new cards?
        // Logic says: "Tier 0: Natural Key Match... if not found... Create a new entry"
        // So we can just send new cards.

        const cards = [
            { name: 'Forest', set_code: 'LEA', collector_number: '1', finish: 'nonfoil', count: 1, scryfall_id: 'test_id_1' },
            { name: 'Mountain', set_code: 'LEA', collector_number: '2', finish: 'foil', count: 1, scryfall_id: 'test_id_2' }
        ];

        const res = await request(app)
            .post(`/api/decks/${deckId}/cards/batch`)
            .set('x-test-user-id', testUserId)
            .send({ cards });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify counts
        const deckRes = await request(app)
            .get(`/api/decks/${deckId}`)
            .set('x-test-user-id', testUserId);

        expect(deckRes.body.items.length).toBe(2);
    });

    it('should delete a deck', async () => {
        const res = await request(app)
            .delete(`/api/decks/${deckId}`)
            .query({ deleteCards: 'true' }) // Clean delete
            .set('x-test-user-id', testUserId);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify gone
        const check = await knex('user_decks').where({ id: deckId }).first();
        expect(check).toBeUndefined();
    });
});
