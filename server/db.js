import dotenv from 'dotenv';
dotenv.config();
import knexConfig from '../knexfile.cjs';
import knexPkg from 'knex';
import { Model } from 'objection';

const env = process.env.NODE_ENV || 'development';
// Force SSL off for local Docker communication (Fix for 'server does not support SSL' error)
if (knexConfig[env] && knexConfig[env].connection) {
    if (typeof knexConfig[env].connection === 'object') {
        knexConfig[env].connection.ssl = false;
    } else if (typeof knexConfig[env].connection === 'string') {
        // If connection string has ?ssl=true, removing it is complex, but usually object config is used.
        // For safety, we can parse it only if needed, but let's assume object config from knexfile.
    }
}
const knex = knexPkg(knexConfig[env]);
Model.knex(knex);

export { knex, Model };
