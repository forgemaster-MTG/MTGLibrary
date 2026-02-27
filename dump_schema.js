const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mtg_postgres_db',
    password: '',
    port: 5432,
});

async function getSchema() {
    try {
        const minter = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cards';
    `);
        console.log(minter.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

getSchema();
