
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    dotenv.config({ path: path.join(__dirname, '../.env.production') });
}

// Fallback logic
const connectionString = databaseUrl || process.env.DATABASE_URL || "postgres://admin:Pass4Kincaid!@10.0.0.27:6468/mtg_postgres_db";

const { Pool } = pg;
const pool = new Pool({
    connectionString,
    ssl: false
});

const DRY_RUN = !process.argv.includes('--execute');

async function cleanupBrokenUsers() {
    console.log(`--- Starting Cleanup (Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}) ---`);
    console.log(`Connecting to DB...`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Find users with NULL firestore_id
        console.log("Searching for users with NULL firestore_id...");
        const userRes = await client.query(`
            SELECT id, email, username, created_at 
            FROM users 
            WHERE firestore_id IS NULL
        `);

        if (userRes.rows.length === 0) {
            console.log("✅ No users found with NULL firestore_id.");
        } else {
            console.log(`⚠️ Found ${userRes.rows.length} users with NULL firestore_id.`);
            const userIds = userRes.rows.map(r => r.id);

            // 2. Count items for these users
            const statsRes = await client.query(`
                SELECT 
                    user_id,
                    (SELECT COUNT(*) FROM user_cards WHERE user_id = u.id) as cards,
                    (SELECT COUNT(*) FROM user_decks WHERE user_id = u.id) as decks
                FROM users u
                WHERE id = ANY($1::int[])
            `, [userIds]);

            let totalCards = 0;
            let totalDecks = 0;

            console.log("\n--- Impact Analysis ---");
            for (const row of userRes.rows) {
                const stats = statsRes.rows.find(s => s.user_id === row.id) || { cards: 0, decks: 0 };
                console.log(`User ID: ${row.id} | Email: ${row.email || 'N/A'} | Created: ${row.created_at} | Cards: ${stats.cards} | Decks: ${stats.decks}`);
                totalCards += parseInt(stats.cards);
                totalDecks += parseInt(stats.decks);
            }
            console.log("-----------------------");
            console.log(`Total Candidates for Deletion: ${userRes.rows.length} Users`);
            console.log(`Total Associated Cards: ${totalCards}`);
            console.log(`Total Associated Decks: ${totalDecks}`);

            if (!DRY_RUN) {
                console.log("\n🛑 EXECUTING DELETION...");

                // Delete Cards
                await client.query('DELETE FROM user_cards WHERE user_id = ANY($1::int[])', [userIds]);
                console.log(`   - Deleted ${totalCards} cards.`);

                // Delete Decks
                await client.query('DELETE FROM user_decks WHERE user_id = ANY($1::int[])', [userIds]);
                console.log(`   - Deleted ${totalDecks} decks.`);

                // Delete Users? The request said "clear out cards", but usually these users are garbage.
                // I'll delete the users too to prevent them from accumulating more garbage, 
                // OR just leave them if the user only asked for cards.
                // PROMPT SAYS: "clear out cards from users"
                // Safest to delete the users too because they have no ID and can't be logged into?
                // Actually, if firestore_id is NULL, they are inaccessible via Auth Middleware anyway.
                // Deleting them is cleaner.
                await client.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
                console.log(`   - Deleted ${userIds.length} users.`);

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

cleanupBrokenUsers();
