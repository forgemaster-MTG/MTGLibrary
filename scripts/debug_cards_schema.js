
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

async function inspectSchema() {
    console.log("Connecting...");
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT * FROM cards LIMIT 1");
        if (res.rows.length > 0) {
            console.log("Columns in 'cards' table:");
            console.log(Object.keys(res.rows[0]));
            console.log("Sample Data:", res.rows[0]);
        } else {
            console.log("Table 'cards' is empty.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

inspectSchema();
