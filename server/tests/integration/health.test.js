
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
// We need to import the app, but server/index.js might start listening immediately.
// Ideally, we should export the app separately. 
// For now, let's assume we can import it or duplicate the setup for testing.
// Importing `server/index.js` usually triggers `app.listen`, which might conflict or hang.
// Let's check `server/index.js` content from earlier step (Step 196).
// It has `const server = app.listen(...)`.
// This is not ideal for testing.
// Strategy: Create a `server/app.js` that exports `app`, and `server/index.js` imports it and listens.
// Or just let it start and listen on a random port? 
// The easiest way without refactoring entry point right now is to just request the running localhost if we assume it's running?
// No, integration tests should spin up their own instance or allow supertest to bind.

// Let's try to refactor server/index.js slightly to export `app`.
// But first, let's write the test assuming we can get the `app`.
// I will start by refactoring `server/index.js` to export `app` and `server` instance.

// Wait, I can't see server/index.js right now. I should verify if I can export it safely.
// If I can't refactor easily, I might use a test-specific entry point that constructs the app.

// Let's try to hit the running server URL first? No, that's E2E.
// Better: Refactor `server/index.js` to `export const app = ...` and ensure `app.listen` is conditional or wrapped?
// Or simply `export { app, server }`.
// If I import it, the code runs. `app.listen` starts the server. 
// Tests can close it?
// `afterAll(() => server.close())`

import { app, server } from '../../index.js'; // Adjust path if needed

describe('Health API', () => {
    afterAll((done) => {
        if (server) {
            server.close(done);
        } else {
            done();
        }
    });

    it('GET /api/health returns 200', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'ok' });
    });
});
