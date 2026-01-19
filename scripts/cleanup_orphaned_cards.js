
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

const DRY_RUN = !process.argv.includes('--execute');

async function cleanupOrphanedCards() {
    console.log(`--- Starting Orphaned Card Cleanup (Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}) ---`);
    console.log(`Connecting to DB...`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Identify Orphaned Cards
        // user_cards.scryfall_id should exist in cards.id (based on schema assumption, verifying with query below)
        // Adjust column names if schema differs (e.g. cards.uuid)

        console.log("Checking for 'user_cards' pointing to non-existent 'cards'...");

        // Note: cards table has 'uuid' column which matches user_cards.scryfall_id
        const res = await client.query(`
            SELECT uc.id, uc.user_id, uc.scryfall_id, uc.name 
            FROM user_cards uc
            LEFT JOIN cards c ON uc.scryfall_id = c.uuid
            WHERE c.uuid IS NULL
        `);

        if (res.rows.length === 0) {
            console.log("✅ No orphaned user_cards found.");
        } else {
            console.log(`⚠️ Found ${res.rows.length} orphaned user_cards.`);

            // Stats
            const sample = res.rows.slice(0, 5).map(r => `${r.name} (${r.scryfall_id})`);
            console.log(`Sample Orphans:`);
            sample.forEach(s => console.log(`   - ${s}`));

            if (!DRY_RUN) {
                console.log("\n🛑 EXECUTING DELETION...");
                const ids = res.rows.map(r => r.id);

                await client.query(`
                    DELETE FROM user_cards 
                    WHERE id = ANY($1::uuid[])
                `, [ids]);

                console.log(`   -> Deleted ${ids.length} rows.`);
                await client.query('COMMIT');
                console.log("✅ Cleanup Successful.");
            } else {
                console.log("\nℹ️  This was a DRY RUN. No changes made.");
                console.log("Run with --execute to perform deletion.");
                await client.query('ROLLBACK');
            }
        }

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Critical Error:", e);
    } finally {
        client.release();
        pool.end();
    }
}

cleanupOrphanedCards();
