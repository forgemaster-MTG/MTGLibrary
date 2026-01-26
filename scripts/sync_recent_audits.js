import { knex } from '../server/db.js';
import admin from '../server/firebaseAdmin.js';

async function syncRecentAudits() {
    console.log('Starting sync for audits completed in recent window...');

    try {
        // Use database time for consistency
        const sessions = await knex('audit_sessions')
            .where('ended_at', '>=', knex.raw("NOW() - INTERVAL '36 HOURS'"))
            .where({ status: 'completed' })
            .select('user_id', 'id', 'ended_at');

        if (sessions.length === 0) {
            console.log('No audits found in the last 36 hours.');
            process.exit(0);
        }

        const userIds = [...new Set(sessions.map(s => s.user_id))];
        console.log(`Found ${sessions.length} sessions for ${userIds.length} users.`);

        for (const userId of userIds) {
            await syncUserCollection(userId);
        }

        console.log('All syncs completed.');
        process.exit(0);

    } catch (err) {
        console.error('Script failed:', err);
        process.exit(1);
    }
}

async function syncUserCollection(userId) {
    console.log(`[User ${userId}] Starting sync...`);

    try {
        const user = await knex('users').where({ id: userId }).first();
        if (!user || !user.firestore_id) {
            console.warn(`[User ${userId}] Skipped: No firestore_id found.`);
            return;
        }

        const firestoreId = user.firestore_id;
        const collectionRef = admin.firestore().collection('users').doc(firestoreId).collection('collection');

        // A. Fetch Postgres Data
        const pgCards = await knex('user_cards').where({ user_id: userId });
        console.log(`[User ${userId}] DB Cards: ${pgCards.length}`);

        // B. Fetch Firestore Data
        let fsDocIds = new Set();
        try {
            const snapshot = await collectionRef.get();
            fsDocIds = new Set(snapshot.docs.map(d => d.id));
            console.log(`[User ${userId}] FS Docs: ${snapshot.size}`);
        } catch (e) {
            console.error(`[User ${userId}] Firestore Read Failed:`, e.message);
            throw e; // Re-throw to stop sync if we can't read source of truth for deletes
        }

        // C. Sync Logic 
        const batchHandler = async (operations) => {
            const MAX_BATCH = 450; // Safety margin below 500
            let batch = admin.firestore().batch();
            let count = 0;

            for (const op of operations) {
                op(batch);
                count++;
                if (count >= MAX_BATCH) {
                    await batch.commit();
                    batch = admin.firestore().batch();
                    count = 0;
                }
            }
            if (count > 0) await batch.commit();
        };

        const operations = [];

        // 1. Upserts
        for (const card of pgCards) {
            const docId = String(card.id);
            const data = JSON.parse(JSON.stringify(card));
            operations.push((batch) => batch.set(collectionRef.doc(docId), data));
            fsDocIds.delete(docId);
        }

        // 2. Deletes
        for (const orphanId of fsDocIds) {
            operations.push((batch) => batch.delete(collectionRef.doc(orphanId)));
        }

        console.log(`[User ${userId}] Committing ${operations.length} operations...`);
        await batchHandler(operations);
        console.log(`[User ${userId}] Sync Complete.`);

    } catch (err) {
        console.error(`[User ${userId}] Sync Error:`, err.message);
    }
}

syncRecentAudits();
