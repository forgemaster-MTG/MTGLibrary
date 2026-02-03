
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app, server } from '../../index.js';

describe('Search API', () => {
    // Shared server cleanup to prevent hanging handles
    afterAll((done) => {
        if (server) {
            server.close(done);
        } else {
            done();
        }
    });

    it('POST /api/cards/search returns 200 for valid text query', async () => {
        // Assuming database has some cards. If empty, it returns empty array but 200 OK.
        const res = await request(app)
            .post('/api/cards/search')
            .send({ text: 'Sol Ring' }); // 'text' is the field for name search based on viewed code

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/cards/search checking validation rejection', async () => {
        const res = await request(app)
            .post('/api/cards/search')
            .send({ text: 12345 }); // Invalid type (should be string)

        // Zod validation should catch this
        // Expect 400 Bad Request
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ status: 'error' });
    });
});
