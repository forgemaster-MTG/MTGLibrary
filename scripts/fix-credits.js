import { knex } from '../server/db.js';

async function fixCredits() {
    try {
        console.log('Searching for User #8 or FORGE MASTER...');
        const user = await knex('users')
            .where({ id: 8 })
            .orWhere('username', 'ILIKE', '%FORGE MASTER%')
            .first();

        if (!user) {
            console.error('User not found');
            process.exit(1);
        }

        console.log(`Found User: ${user.username} (ID: ${user.id})`);
        console.log(`Current Credits - Monthly: ${user.credits_monthly}, Top-up: ${user.credits_topup}`);

        // Giving a healthy balance
        const monthly = 500000;
        const topup = 750000;

        await knex('users')
            .where({ id: user.id })
            .update({
                credits_monthly: monthly,
                credits_topup: topup,
                subscription_tier: 'tier_5' // Planeswalker
            });

        const updated = await knex('users').where({ id: user.id }).first();
        console.log(`Updated Credits - Monthly: ${updated.credits_monthly}, Top-up: ${updated.credits_topup}`);
        console.log(`Tier: ${updated.subscription_tier}`);

        console.log('Success!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixCredits();
