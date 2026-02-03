import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment-specific .env file
const nodeEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();
dotenv.config({ path: path.join(__dirname, `../.env.${nodeEnv}`) });
// Also load standard .env as fallback/shared settings
dotenv.config();

// Dynamic import to ensure .env is loaded BEFORE knexfile is evaluated
const knexConfigModule = await import('../knexfile.cjs');
const knexConfig = knexConfigModule.default || knexConfigModule;

import knexPkg from 'knex';
import { Model } from 'objection';

const rawEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();

// Environment mapping logic 
const envMap = {
    'dev': 'development',
    'development': 'development',
    'test': 'development',
    'production': 'production',
    'staging': 'staging'
};

const env = envMap[rawEnv] || 'production';

console.log(`[DB] Initializing database for environment: ${env} (Raw: '${rawEnv}')`);

// Config source from the imported module
const configSource = knexConfig;

if (!configSource[env]) {
    console.error(`[DB] CRITICAL ERROR: Database configuration not found for '${env}'.`);
    console.error(`[DB] Available configs: ${Object.keys(configSource).join(', ')}`);
    throw new Error(`Missing database config for environment: ${env}`);
}

const config = configSource[env];

if (!config.connection) {
    console.error(`[DB] CRITICAL ERROR: Connection settings missing for '${env}'.`);
    console.error(`[DB] Config keys: ${Object.keys(config).join(', ')}`);
    throw new Error(`Connection settings missing for environment: ${env}`);
}

const connInfo = typeof config.connection === 'string' ? config.connection : `${config.connection.host || 'unknown'}:${config.connection.port || '5432'}`;
console.log(`[DB] Using Connection: ${connInfo.replace(/:[^:@/]+@/, ':***@')}`); // Mask password if URL

// Force SSL off for local Docker communication (Fix for 'server does not support SSL' error)
if (config.connection && typeof config.connection === 'object') {
    config.connection.ssl = false;
}

const knex = knexPkg(config);
Model.knex(knex);

export { knex, Model };
