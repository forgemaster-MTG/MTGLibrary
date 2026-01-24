
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

async function checkHiddenChars() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT scryfall_id FROM user_cards WHERE scryfall_id IS NOT NULL LIMIT 1");
        if (res.rows.length === 0) return;

        const id = res.rows[0].scryfall_id;
        console.log(`Analyzing ID: "${id}"`);
        console.log(`Length: ${id.length}`);

        const chars = [];
        for (let i = 0; i < id.length; i++) {
            chars.push({
                char: id[i],
                code: id.charCodeAt(i),
                hex: id.charCodeAt(i).toString(16).padStart(4, '0')
            });
        }
        console.table(chars);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

checkHiddenChars();
