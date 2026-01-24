
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

async function auditIds() {
    console.log("Connecting...");
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT length(scryfall_id) as len, count(*) 
            FROM user_cards 
            GROUP BY length(scryfall_id)
            ORDER BY len
        `);
        console.log("Distribution of scryfall_id lengths in 'user_cards':");
        console.table(res.rows);

        const malformed = await client.query(`
            SELECT scryfall_id, length(scryfall_id) as len 
            FROM user_cards 
            WHERE length(scryfall_id) != 36 
            LIMIT 10
        `);
        if (malformed.rows.length > 0) {
            console.log("Sample malformed IDs (length != 36):", malformed.rows);
        } else {
            console.log("No IDs found with length != 36.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

auditIds();
