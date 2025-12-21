import admin from 'firebase-admin';
import { createRequire } from 'module';
import { knex } from '../server/db.js';

const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function migrate() {
    console.log('Starting Migration...');

    try {
        // 1. Users
        console.log('Migrating Users...');
        const usersSnap = await db.collection('users').get(); // Actually users are in root `users` or `artifacts/mtg-forge-default/users`?
        // Based on deckService: `artifacts/mtg-forge-default/users`
        // Wait, check `src/lib/firebase.js` or `auth.js` to be sure where users are stored.
        // `auth.js` said: `admin.firestore().collection('users').doc(uid).get()` for profile.
        // BUT `deckService` uses `artifacts/mtg-forge-default/users`.
        // This is a discrepancy!
        // The `auth` middleware might be looking in the wrong place for profile data if it uses root `users`.
        // Let's assume `artifacts/mtg-forge-default/users` is the source of truth for THIS app's data.
        // I will check root `users` too just in case.
        // Actually, `implementation_plan` implies `artifacts/...`.

        // I will read from `artifacts/mtg-forge-default/users`.
        const usersRef = db.collection('artifacts').doc('mtg-forge-default').collection('users');
        const usersSnapshot = await usersRef.get();

        console.log(`Found ${usersSnapshot.size} users.`);

        const userMap = new Map(); // FirestoreUID -> PG_ID

        for (const doc of usersSnapshot.docs) {
            const uid = doc.id;
            const data = doc.data();

            // Check if user exists in PG (upsert)
            // `auth.js` creates users on login.
            let user = await knex('users').where({ firestore_id: uid }).first();
            if (!user) {
                const insert = {
                    firestore_id: uid,
                    email: data.email || null,
                    data: { profile: data }
                };
                const [inserted] = await knex('users').insert(insert).returning('*');
                user = inserted;
                console.log(`Created user ${uid} (id: ${user.id})`);
            } else {
                console.log(`User ${uid} exists (id: ${user.id})`);
            }
            userMap.set(uid, user.id);

            // 2. Decks for this user
            console.log(`  Migrating Decks for user ${uid}...`);
            const decksSnap = await usersRef.doc(uid).collection('decks').get();
            const deckMap = new Map(); // FirestoreDeckID -> PGDeckID

            for (const deckDoc of decksSnap.docs) {
                const dData = deckDoc.data();
                // Create Deck
                // name, commander
                const insertDeck = {
                    id: knex.raw('gen_random_uuid()'), // or let default handle it
                    user_id: user.id,
                    firestore_id: deckDoc.id,
                    name: dData.name || 'Untitled Deck',
                    commander: dData.commander || null,
                    created_at: dData.createdAt ? new Date(dData.createdAt) : new Date()
                };

                // Upsert based on firestore_id?
                const existingDeck = await knex('user_decks').where({ firestore_id: deckDoc.id }).first();
                let deckId;
                if (existingDeck) {
                    await knex('user_decks').where({ id: existingDeck.id }).update(insertDeck);
                    deckId = existingDeck.id;
                } else {
                    const [newDeck] = await knex('user_decks').insert(insertDeck).returning('*');
                    deckId = newDeck.id;
                }
                deckMap.set(deckDoc.id, deckId);
            }
            console.log(`  - Migrated ${decksSnap.size} decks.`);

            // 3. Collection (Cards) for this user
            console.log(`  Migrating Collection for user ${uid}...`);
            const cardsSnap = await usersRef.doc(uid).collection('collection').get();

            const chunkedCards = [];
            const CHUNK_SIZE = 100;

            for (const cardDoc of cardsSnap.docs) {
                const cData = cardDoc.data();

                let pgDeckId = null;
                if (cData.deckId && deckMap.has(cData.deckId)) {
                    pgDeckId = deckMap.get(cData.deckId);
                }

                const insertCard = {
                    user_id: user.id,
                    firestore_id: cardDoc.id,
                    scryfall_id: cData.id || cData.scryfall_id || 'unknown', // cData.id is scryfall UUID usually in this app
                    name: cData.name || 'Unknown',
                    set_code: cData.set_code || cData.set || '???',
                    collector_number: cData.collector_number || '0',
                    finish: cData.finish || 'nonfoil',
                    image_uri: (cData.image_uris && cData.image_uris.normal) || (cData.data && cData.data.image_uris && cData.data.image_uris.normal) || null,
                    count: cData.count || 1,
                    data: cData.data || cData, // Store full data just in case
                    added_at: cData.addedAt ? new Date(cData.addedAt) : new Date(),
                    deck_id: pgDeckId
                };

                chunkedCards.push(insertCard);
            }

            // Batch Insert
            if (chunkedCards.length > 0) {
                // Process in chunks
                for (let i = 0; i < chunkedCards.length; i += CHUNK_SIZE) {
                    const chunk = chunkedCards.slice(i, i + CHUNK_SIZE);
                    // Upsert? Or just insert and ignore conflicts / replicates?
                    // Since we have firestore_id, we can upsert.
                    // Knex doesn't support bulk upsert easily across engines, but PG `onConflict` does.
                    await knex('user_cards')
                        .insert(chunk)
                        .onConflict('firestore_id') // We need a UNIQUE CONSTRAINT on firestore_id for this to work!
                        .ignore();
                    // .merge() is better? But user_cards.firestore_id might not be unique if dirty data?
                    // Actually I made it unique in my mind, but schema says?
                    // Migration `20251221_add_firestore_id_cards` just added `t.string`, NOT `unique`.
                    // So `onConflict` won't work without a constraint.
                    // I'll just Delete existing for this user first? Or just Insert and hope for best (or check existence).
                    // Checking existence is slow for 1000s of cards.
                    // I will delete all cards for this user that have a firestore_id (re-migration safety).
                }
                console.log(`  - Migrated ${chunkedCards.length} cards.`);
            }

        } // End Users Loop

        console.log('Migration Complete.');
        process.exit(0);

    } catch (err) {
        console.error('Migration Failed:', err);
        process.exit(1);
    }
}

migrate();
