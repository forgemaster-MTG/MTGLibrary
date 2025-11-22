require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: process.env.PGHOST || '10.0.0.27',
      user: process.env.PGUSER || 'admin',
      password: process.env.PGPASSWORD || 'Pass4Kincaid!',
      database: process.env.PGDATABASE || 'mtglibrary_dev'
    },
    migrations: {
      directory: './migrations'
    }
  }
};

