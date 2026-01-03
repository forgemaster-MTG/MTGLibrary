import dotenv from 'dotenv';
dotenv.config();
import knexConfig from '../knexfile.cjs';
import knexPkg from 'knex';
import { Model } from 'objection';

const rawEnv = process.env.NODE_ENV || 'development';
// Unwrap default export if present (CJS/ESM interop)
const configSource = knexConfig.default || knexConfig;

// Map unknown environments (like 'staging') to 'production' config
const env = (configSource[rawEnv]) ? rawEnv : 'production';

console.log(`[DB] Initializing DB connection...`);
console.log(`[DB] Raw NODE_ENV: ${rawEnv}`);
console.log(`[DB] Resolved Config Key: ${env}`);

if (!configSource[env]) {
    console.error(`[DB] CRITICAL ERROR: Database configuration not found for '${env}'.`);
    console.error(`[DB] Available configs: ${Object.keys(configSource).join(', ')}`);
    throw new Error(`Missing database config for environment: ${env}`);
}

const config = configSource[env];

// Force SSL off for local Docker communication (Fix for 'server does not support SSL' error)
if (config.connection) {
    if (typeof config.connection === 'object') {
        config.connection.ssl = false;
    }
}

const knex = knexPkg(config);
Model.knex(knex);

export { knex, Model };
