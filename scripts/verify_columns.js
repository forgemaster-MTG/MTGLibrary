
import knex from 'knex';
import knexConfig from '../knexfile.cjs';
import dotenv from 'dotenv';
dotenv.config();

const db = knex(knexConfig.development);

async function verify() {
    try {
        const hasSubTier = await db.schema.hasColumn('users', 'subscription_tier');
        const hasOverride = await db.schema.hasColumn('users', 'override_tier');
        console.log('subscription_tier:', hasSubTier);
        console.log('override_tier:', hasOverride);
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await db.destroy();
    }
}

verify();
