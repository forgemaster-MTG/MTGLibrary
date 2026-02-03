
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { userService } from '../../services/userService.js';
import { knex } from '../../db.js';

describe('UserService Integration', () => {
    let testUserId;

    beforeAll(async () => {
        // Create a temporary test user directly in DB
        const [user] = await knex('users').insert({
            firestore_id: 'test_uid_' + Date.now(),
            email: 'test@example.com',
            username: 'TestUser',
            data: { bio: 'Original Bio' },
            settings: { theme: 'dark' }
        }).returning('*');
        testUserId = user.id;
    });

    afterAll(async () => {
        // Cleanup
        if (testUserId) {
            await knex('users').where({ id: testUserId }).del();
        }
        await knex.destroy(); // Ensure connection is closed
    });

    it('should fetch user by ID', async () => {
        const user = await userService.getUserById(testUserId);
        expect(user).toBeDefined();
        expect(user.email).toBe('test@example.com');
    });

    it('should update user profile', async () => {
        const actor = { id: testUserId, settings: { isAdmin: false } }; // Mock actor
        const payload = {
            first_name: 'Test',
            last_name: 'Changed',
            data: { bio: 'Updated Bio' }
        };

        const updated = await userService.updateUserProfile(testUserId, payload, actor);
        expect(updated.first_name).toBe('Test');
        expect(updated.last_name).toBe('Changed');
        expect(updated.data.bio).toBe('Updated Bio');
    });

    it('should prevent unauthorized updates', async () => {
        const otherActor = { id: 9999999, settings: { isAdmin: false } };

        await expect(userService.updateUserProfile(testUserId, { username: 'Hacker' }, otherActor))
            .rejects
            .toThrow(/authorized/);
    });
});
