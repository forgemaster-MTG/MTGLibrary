/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
console.error(`!!! KNEXFILE LOADING. NODE_ENV is: "${process.env.NODE_ENV}"`);
const dotenv = require('dotenv');
const path = require('path');
const nodeEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();
dotenv.config({ path: path.join(__dirname, `.env.${nodeEnv}`) });
dotenv.config();

const configs = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.PGHOST || 'postgres',
      port: process.env.PGPORT || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'mtg_postgres_db'
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    }
  },

  staging: {
    client: 'pg',
    connection: {
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    }
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: false // Usually off for internal Docker networks
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    }
  }
};

const activeConfig = configs[nodeEnv] || configs.development;
if (activeConfig.connection) {
  console.log(`[Knexfile] Target database host: ${activeConfig.connection.host || '127.0.0.1'}`);
}

// Export only the active config - this makes Knex CLI much more reliable 
// when environment variables are passed through sudo/Docker.
module.exports = activeConfig;
