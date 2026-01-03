import dotenv from 'dotenv';
dotenv.config();
import knexConfig from '../knexfile.cjs';
import knexPkg from 'knex';
import { Model } from 'objection';

<<<<<<< Updated upstream
const env = process.env.NODE_ENV || 'development';
const config = knexConfig[env];

if (!config) {
    console.error(`[DB] CRITICAL ERROR: No database configuration found for environment: ${env}`);
    console.error(`[DB] Available environments in knexfile.cjs: ${Object.keys(knexConfig).join(', ')}`);
    process.exit(1);
}

console.log(`[DB] Initializing database for environment: ${env}`);
=======
const rawEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();
// Unwrap default export if present (CJS/ESM interop)
const configSource = knexConfig.default || knexConfig;

const envMap = {
    'dev': 'development',
    'development': 'development',
    'production': 'production',
    'staging': 'production'
};

const env = envMap[rawEnv] || 'production';

console.log(`[DB] Initializing DB connection...`);
console.log(`[DB] Raw NODE_ENV: '${rawEnv}' (length: ${rawEnv.length})`);
console.log(`[DB] Resolved Config Key: ${env}`);

if (!configSource[env]) {
    console.error(`[DB] CRITICAL ERROR: Database configuration not found for '${env}'.`);
    console.error(`[DB] Available configs: ${Object.keys(configSource).join(', ')}`);
    throw new Error(`Missing database config for environment: ${env}`);
}

const config = configSource[env];
const connInfo = typeof config.connection === 'string' ? config.connection : `${config.connection.host}:${config.connection.port}`;
console.log(`[DB] Using Connection: ${connInfo.replace(/:[^:@/]+@/, ':***@')}`); // Mask password if URL
>>>>>>> Stashed changes

// Force SSL off for local Docker communication (Fix for 'server does not support SSL' error)
if (config.connection && typeof config.connection === 'object') {
    config.connection.ssl = false;
}

const knex = knexPkg(config);
Model.knex(knex);

export { knex, Model };
