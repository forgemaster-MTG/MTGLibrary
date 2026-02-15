
import { knex } from '../server/db.js';

async function checkLedger() {
    try {
        // Check migrations table
        const migrations = await knex('knex_migrations').select('*').orderBy('id', 'desc');
        console.log('Migration History:', JSON.stringify(migrations, null, 2));

        // Start checking main table
        console.log('Checking user_credit_logs table...');

        // Check if table exists (via count)
        const count = await knex('user_credit_logs').count('* as total').first();
        console.log('Total rows in user_credit_logs:', count.total);

        // Fetch last 5 logs
        const logs = await knex('user_credit_logs').orderBy('created_at', 'desc').limit(5);
        console.log('Last 5 logs:', JSON.stringify(logs, null, 2));

        // Fetch user credits too
        const users = await knex('users').select('id', 'username', 'credits_monthly', 'credits_topup', 'ai_credits_used').limit(5);
        console.log('User Credits Sample:', JSON.stringify(users, null, 2));

    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await knex.destroy();
    }
}

checkLedger();
