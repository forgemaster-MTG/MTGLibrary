const knex = require('knex');
const path = require('path');
const dotenv = require('dotenv');

// MIRROR server/db.js logic exactly
// FORCE 'development' to fix mismatch
const nodeEnv = 'development';
// db.js is in server/, so it uses ../.env.development
// this script is in scripts/, so it should also use ../.env.development
const envPath = path.join(__dirname, `../.env.${nodeEnv}`);
console.log(`Loading env from: ${envPath}`);
dotenv.config({ path: envPath });
// Also load standard .env as fallback
dotenv.config({ path: path.join(__dirname, '../.env') });

const config = {
    client: 'pg',
    connection: {
        // STRICTLY HARDCODED for Development Server
        host: '10.0.0.27',
        port: 6470,

        // Credentials still come from loaded env or defaults
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: 'mtg_postgres_db_dev'
    },
    migrations: {
        directory: path.join(__dirname, '../migrations'),
        tableName: 'knex_migrations'
    }
};

console.log('Forcing migration with config:');
console.log(`Host: ${config.connection.host}`);
console.log(`Port: ${config.connection.port}`);
console.log(`User: ${config.connection.user}`);
console.log(`DB: ${config.connection.database}`);

const db = knex(config);

db.migrate.latest()
    .then(() => {
        console.log('Migration complete!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
