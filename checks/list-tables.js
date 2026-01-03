import pg from 'pg';
const client = new pg.Client({
    host: '10.0.0.27',
    port: 6468,
    user: 'admin',
    password: 'Pass4Kincaid!',
    database: 'mtg_postgres_db'
});
await client.connect();
const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
console.log(res.rows.map(r => r.table_name));
await client.end();
