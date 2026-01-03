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

        // Check for duplicates in a set
        const setCode = 'lea'; // Example set
        console.log(`Checking cards for set: ${setCode}`);

        const countRes = await client.query(`SELECT COUNT(*) FROM cards WHERE setcode = '${setCode}'`);
        const distinctRes = await client.query(`SELECT COUNT(DISTINCT uuid) FROM cards WHERE setcode = '${setCode}'`);

        console.log(`Total cards: ${countRes.rows[0].count}`);
        console.log(`Distinct UUIDs: ${distinctRes.rows[0].count}`);

        // Check data -> id
        const dataRes = await client.query(`SELECT uuid, data->>'id' as json_id FROM cards WHERE setcode = '${setCode}' LIMIT 5`);
        console.log("Sample IDs:");
        dataRes.rows.forEach(r => console.log(`UUID: ${r.uuid}, JSON ID: ${r.json_id}`));

        await client.end();
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

run();
