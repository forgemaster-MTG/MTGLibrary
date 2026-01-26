import { knex } from '../db.js';
import admin from '../firebaseAdmin.js';

/**
 * Syncs a user's entire card collection from Postgres to Firestore.
 * This is a one-way sync: Postgres (Source) -> Firestore (Destination).
 * 
 * @param {number} userId - The internal Postgres ID of the user.
 * @returns {Promise<{ success: boolean, stats: object, error: string }>}
 */
export async function syncUserToFirestore(userId) {
    console.log(`[FirestoreSync] Starting sync for User ${userId}...`);
    const stats = {
        upserted: 0,
        deleted: 0,
        total_pg: 0,
        total_fs: 0
    };

    try {
        // 1. Get User & Firestore ID
        const user = await knex('users').where({ id: userId }).first();
        if (!user) throw new Error(`User ${userId} not found`);
        if (!user.firestore_id) throw new Error(`User ${userId} has no firestore_id`);

        const firestoreId = user.firestore_id;
        const collectionRef = admin.firestore().collection('users').doc(firestoreId).collection('collection');

        // 2. Fetch Source Data (Postgres)
        const pgCards = await knex('user_cards')
            .where({ user_id: userId })
            // Optional: filtering or ordering?
            .select('*'); // We need all fields to display in app

        stats.total_pg = pgCards.length;

        // 3. Fetch Destination Data (Firestore) to find orphans
        const snapshot = await collectionRef.get();
        const existingDocIds = new Set(snapshot.docs.map(d => d.id));
        stats.total_fs = existingDocIds.size;

        // 4. Batch Operations
        const BATCH_SIZE = 50; // Reduced from 450 to 50 to avoid 10MB limit errors
        let batch = admin.firestore().batch();
        let opCount = 0;

        const commitBatch = async () => {
            if (opCount > 0) {
                await batch.commit();
                batch = admin.firestore().batch();
                opCount = 0;
            }
        };

        // A. Upsert (Set) all PG cards
        for (const card of pgCards) {
            const docId = String(card.id); // Use PG ID as Doc ID

            // Clean undefined values
            const payload = JSON.parse(JSON.stringify(card));

            // Ensure dates are strings or timestamps if needed, JSON.stringify handles most.
            // Firestore doesn't like undefined, but JSON.parse/stringify removes them.

            const docRef = collectionRef.doc(docId);
            batch.set(docRef, payload);

            existingDocIds.delete(docId); // Mark as kept
            stats.upserted++;
            opCount++;

            if (opCount >= BATCH_SIZE) await commitBatch();
        }

        // B. Delete Orphans (Cards in FS but not in PG)
        for (const orphanId of existingDocIds) {
            const docRef = collectionRef.doc(orphanId);
            batch.delete(docRef);
            stats.deleted++;
            opCount++;

            if (opCount >= BATCH_SIZE) await commitBatch();
        }

        // Final commit
        await commitBatch();

        console.log(`[FirestoreSync] Sync Complete for User ${userId}.`, stats);
        return { success: true, stats };

    } catch (err) {
        console.error(`[FirestoreSync] Error syncing User ${userId}:`, err);
        return { success: false, error: err.message, stats };
    }
}
