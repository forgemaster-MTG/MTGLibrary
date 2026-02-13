import { knex } from '../server/db.js';

async function listUsers() {
    try {
        const users = await knex('users')
            .select('id', 'username', 'email', 'credits_monthly', 'credits_topup', 'subscription_tier')
            .limit(10);

        console.log('--- Current Users (Top 10) ---');
        console.table(users);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

listUsers();
