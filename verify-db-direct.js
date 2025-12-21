import pg from 'pg';
const { Client } = pg;

const client = new Client({
    host: '10.0.0.27',
    port: 6468,
    user: 'admin',
    password: 'Pass4Kincaid!',
    database: 'postgres' // Connect to default DB to list others
});

async function run() {
    console.log("Attempting connection to 10.0.0.27:6468 (postgres db)...");
    try {
        await client.connect();
        console.log("Connected! Listing databases:");
        const res = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
        res.rows.forEach(r => console.log(' - ' + r.datname));
        await client.end();
        return;
    } catch (e) {
        console.error("Connection Failed:", e.message);
    }

    // Fallback to localhost
    console.log("Attempting connection to localhost...");
    const clientLocal = new Client({
        host: 'localhost',
        user: 'admin',
        password: 'Pass4Kincaid!',
        database: 'mtglibrary_dev'
    });

    try {
        await clientLocal.connect();
        console.log("Connected successfully to localhost!");
        const res = await clientLocal.query('SELECT NOW()');
        console.log("Current Time from DB:", res.rows[0]);
        await clientLocal.end();
    } catch (e) {
        console.error("Connection to localhost Failed:", e.message);
    }
}

run();
