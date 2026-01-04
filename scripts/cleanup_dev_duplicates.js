import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.development') });

// Use Dev DB URL from env or fallback
const connectionString = process.env.DATABASE_URL || "postgres://admin:Pass4Kincaid!@localhost:5432/mtg_postgres_db_dev";

const { Pool } = pg;
const pool = new Pool({
    connectionString,
    ssl: false
});

async function cleanupDuplicates() {
    console.log("--- Starting Duplicate Cleanup ---");
    console.log(`Connecting to: ${connectionString.split('@')[1]}`); // Mask credentials

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Check for duplicates by firestore_id
        console.log("Checking for duplicate 'firestore_id' in 'users'...");
        const res = await client.query(`
            SELECT firestore_id, COUNT(*), array_agg(id) as ids
            FROM users
            GROUP BY firestore_id
            HAVING COUNT(*) > 1;
        `);

        if (res.rows.length === 0) {
            console.log("✅ No duplicates found for firestore_id.");
        } else {
            console.log(`⚠️ Found ${res.rows.length} sets of duplicates.`);

            for (const row of res.rows) {
                const ids = row.ids.sort((a, b) => a - b); // Sort IDs ascending
                const keepId = ids[0]; // Keep the lowest ID (usually the first created)
                const removeIds = ids.slice(1);

                console.log(`Processing firestore_id: ${row.firestore_id}`);
                console.log(`   Keeping ID: ${keepId}`);
                console.log(`   Removing IDs: ${removeIds.join(', ')}`);

                // Delete duplicates
                await client.query(`
                    DELETE FROM users 
                    WHERE id = ANY($1::int[])
                `, [removeIds]);

                console.log(`   -> Deleted ${removeIds.length} records.`);
            }
        }

        // 2. Check for duplicates by id (PK is usually unique, but if sequence is messed up...)
        // Actually PK violation on restore implies the dump has lines with same ID. 
        // Likely caused by the same row appearing twice or dirty data.

        await client.query('COMMIT');
        console.log("--- Cleanup Complete ---");

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error during cleanup:", e);
    } finally {
        client.release();
        pool.end();
    }
}

cleanupDuplicates();
