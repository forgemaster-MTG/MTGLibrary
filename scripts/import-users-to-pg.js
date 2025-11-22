#!/usr/bin/env node
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const { knex } = require('../server/db');

// Initialize firebase-admin
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function main() {
  console.log('[import-users] fetching users from Firestore collection "users"');
  const col = admin.firestore().collection('users');
  const snapshot = await col.get();
  console.log('[import-users] found', snapshot.size, 'documents');

  let count = 0;
  for (const doc of snapshot.docs) {
    const uid = doc.id;
    const data = doc.data();
    const email = data.email || data.emailAddress || null;
    const row = { firestore_id: uid, email, data };
    try {
      // upsert by firestore_id
      await knex('users').insert(row).onConflict('firestore_id').merge();
      count++;
    } catch (e) {
      console.error('[import-users] failed for', uid, e.message || e);
    }
  }

  console.log('[import-users] imported', count, 'users');
  process.exit(0);
}

main().catch(err => { console.error('[import-users] error', err); process.exit(1); });
