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
        const res = await client.query("SELECT id, name, data FROM cards WHERE name ILIKE '%Sol Ring%' LIMIT 1");
        if (res.rows.length === 0) {
            console.log("No Sol Ring found.");
        } else {
            const card = res.rows[0];
            console.log("Found:", card.name);
            console.log("Data is null?", card.data === null);
            if (card.data) {
                console.log("Data keys:", Object.keys(card.data));
                console.log("Image URIs:", card.data.image_uris);
            }
        }
        await client.end();
    } catch (e) {
        console.error(e);
    }
}
run();
