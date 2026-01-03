import dotenv from 'dotenv';
dotenv.config();
import knexConfig from '../knexfile.cjs';
import knexPkg from 'knex';
import { Model } from 'objection';

const env = process.env.NODE_ENV || 'development';
const config = knexConfig[env];

if (!config) {
    console.error(`[DB] CRITICAL ERROR: No database configuration found for environment: ${env}`);
    console.error(`[DB] Available environments in knexfile.cjs: ${Object.keys(knexConfig).join(', ')}`);
    process.exit(1);
}

console.log(`[DB] Initializing database for environment: ${env}`);

// Force SSL off for local Docker communication (Fix for 'server does not support SSL' error)
if (config.connection && typeof config.connection === 'object') {
    config.connection.ssl = false;
}

const knex = knexPkg(config);
Model.knex(knex);

export { knex, Model };
