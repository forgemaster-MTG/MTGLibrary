import pg from 'pg';
const { Client } = pg;

const client = new Client({
    host: '10.0.0.27',
    port: 6468,
    user: 'admin',
    password: 'Pass4Kincaid!',
    database: 'mtg_postgres_db'
});

async function run() {
    try {
        await client.connect();

        const res = await client.query('SELECT * FROM knex_migrations');
        console.log("Migrations run:", res.rows);

        await client.end();
    } catch (e) {
        console.error("Check Failed (Table might not exist):", e.message);
    }
}

run();
