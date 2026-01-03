require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
<<<<<<< Updated upstream
    connection: process.env.DATABASE_URL || {
      host: process.env.PGHOST,
      port: 6469 || 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE
    },
    migrations: {
      directory: './migrations'
    }
  },
  staging: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: process.env.PGHOST,
      port: 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE
=======
    connection: process.env.DEV_DATABASE_URL || {
      host: (process.env.PGHOST === 'postgres' || process.env.PGHOST === 'postgres-dev' || process.env.POSTGRES_HOST === 'postgres')
        ? 'localhost'
        : (process.env.PGHOST || process.env.POSTGRES_HOST || 'localhost'),
      port: process.env.PGPORT || process.env.POSTGRES_PORT || 6470,
      user: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
      database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'mtg_postgres_db_dev'
>>>>>>> Stashed changes
    },
    migrations: {
      directory: './migrations'
    }
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations'
    }
  }
};
