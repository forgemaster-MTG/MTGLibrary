
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    dotenv.config({ path: path.join(__dirname, '../.env.production') });
}

const connectionString = databaseUrl || process.env.DATABASE_URL || "postgres://admin:Pass4Kincaid!@10.0.0.27:6468/mtg_postgres_db";

const { Pool } = pg;
const pool = new Pool({
    connectionString,
    ssl: false
});

async function checkSchema() {
    console.log("Connecting...");
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'user_cards' AND column_name = 'scryfall_id'
        `);
        console.log("Schema Info for 'user_cards.scryfall_id':", res.rows[0]);

        const sample = await client.query("SELECT scryfall_id, length(scryfall_id) as len FROM user_cards WHERE scryfall_id IS NOT NULL LIMIT 5");
        console.log("Sample Data with Lengths:", sample.rows);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

checkSchema();
