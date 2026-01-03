import pg from 'pg';
const client = new pg.Client({
    host: '10.0.0.27',
    port: 6468,
    user: 'admin',
    password: 'Pass4Kincaid!',
    database: 'mtg_postgres_db'
});
await client.connect();
const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_cards'");
console.log(res.rows);
await client.end();
