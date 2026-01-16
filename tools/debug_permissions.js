
import { knex } from '../server/db.js';

const run = async () => {
    try {
        console.log('--- Debugging Permissions ---');

        // 1. Get Target User (ID 8)
        const targetUser = await knex('users').where('id', 8).first();
        if (!targetUser) {
            console.log('Target user 8 NOT FOUND');
        } else {
            console.log(`Target User 8: ${targetUser.username}, is_public_library=${targetUser.is_public_library}`);
        }

        // 2. Get Current User (Assuming username is FORGE MASTER from logs)
        const currentUser = await knex('users').where('username', 'FORGE MASTER').first();
        if (!currentUser) {
            console.log('Current user "FORGE MASTER" NOT FOUND. Listing all users to identify...');
            const all = await knex('users').select('id', 'username');
            console.log(all);
            return;
        }
        console.log(`Current User: ${currentUser.username} (ID: ${currentUser.id})`);

        // 3. Check Friendship
        const rel = await knex('user_relationships')
            .where(b => b.where('requester_id', currentUser.id).andWhere('addressee_id', 8))
            .orWhere(b => b.where('requester_id', 8).andWhere('addressee_id', currentUser.id))
            .first();

        console.log('Relationship Record:', rel);

    } catch (err) {
        console.error('Debug script failed:', err);
    } finally {
        await knex.destroy();
    }
};

run();
