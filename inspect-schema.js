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

        const showSchema = async (tableName) => {
            console.log(`\n--- Schema for ${tableName} ---`);
            const res = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = '${tableName}'
            `);
            res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));
        };

        await showSchema('users');
        await showSchema('cards');

        await client.end();
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

run();
