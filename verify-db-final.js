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
    console.log("Connecting to mtg_postgres_db...");
    try {
        await client.connect();
        console.log("Connected Successfully!");

        console.log("checking tables...");
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log("Tables found:", tables.rows.map(r => r.table_name));

        await client.end();
    } catch (e) {
        console.error("Connection Failed:", e.message);
    }
}

run();
