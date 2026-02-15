
import { knex } from '../server/db.js';

async function verifyLedger() {
    try {
        const userId = 8; // From the logs provided by user
        console.log(`Checking ledger for User ID: ${userId} in 'public.user_credit_logs'...`);

        const logs = await knex('public.user_credit_logs')
            .where({ user_id: userId })
            .orderBy('created_at', 'desc');

        console.log(`Found ${logs.length} logs.`);
        if (logs.length > 0) {
            console.log('Latest Log:', JSON.stringify(logs[0], null, 2));
        }

        const user = await knex('users').where({ id: userId }).first();
        if (user) {
            console.log('User Credits:', {
                monthly: user.credits_monthly,
                topup: user.credits_topup,
                ai_used: user.ai_credits_used
            });
        } else {
            console.log('User 8 NOT FOUND in users table!');
        }

        // Diagnostics
        const dbInfo = await knex.raw('SELECT current_database() as db, current_schema() as schema');
        const tableCheck = await knex.raw("SELECT to_regclass('public.user_credit_logs') as exists_public");
        console.log('DB Info:', dbInfo.rows[0]);
        console.log('Table Exists:', tableCheck.rows[0]);

    } catch (err) {
        console.error('Error verifying ledger:', err);
    } finally {
        await knex.destroy();
    }
}

verifyLedger();
