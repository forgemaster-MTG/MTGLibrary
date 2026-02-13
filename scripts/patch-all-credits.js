import { knex } from '../server/db.js';

async function patchCredits() {
    try {
        console.log('Patching users with missing monthly credits...');

        // Target: Any user with 0 or null monthly credits, or specifically free tier users below the limit
        const result = await knex('users')
            .where('credits_monthly', '<', 750000)
            .orWhereNull('credits_monthly')
            .update({
                credits_monthly: 750000
            });

        console.log(`Success! Updated ${result} users to 750,000 monthly credits.`);
        process.exit(0);
    } catch (err) {
        console.error('Error during patch:', err);
        process.exit(1);
    }
}

patchCredits();
