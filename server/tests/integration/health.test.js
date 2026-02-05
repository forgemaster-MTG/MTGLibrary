import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../../index.js';

describe('Health Check API', () => {
    it('GET /api/health should return 200 and db connected status', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('db', 'connected');
        expect(res.body).toHaveProperty('timestamp');
    });
});
