
import { knex } from '../server/db.js';
import { PricingService } from '../server/services/PricingService.js';
import dotenv from 'dotenv';
dotenv.config();


async function run() {
    try {
        console.log('Starting credit backfill...');
        const freeLimit = await PricingService.getLimitForTier('free');
        console.log(`Target Free/Trial Limit: ${freeLimit}`);

        const result = await knex('users')
            .where(builder => {
                builder.whereNull('subscription_tier')
                    .orWhere('subscription_tier', 'free')
                    .orWhere('subscription_tier', 'trial');
            })
            .andWhere(builder => {
                 builder.whereNull('credits_monthly')
                        .orWhere('credits_monthly', '<', freeLimit);
            })
            .update({ credits_monthly: freeLimit });

        console.log(`✅ Backfill Complete. Updated ${result} users to have ${freeLimit} credits.`);
    } catch (e) {
        console.error('❌ Backfill failed:', e);
    } finally {
        await knex.destroy();
        process.exit(0);
    }
}

run();
