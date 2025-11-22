/**
 * scripts/clear-precons-firestore.js
 *
 * Delete all documents in the top-level 'precons' collection.
 * WARNING: This is irreversible. Use with care.
 *
 * Usage (Windows cmd):
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccountKey.json
 *   node scripts\clear-precons-firestore.js
 *
 * Or pass service account path as first arg:
 *   node scripts\clear-precons-firestore.js C:\path\to\serviceAccountKey.json
 *
 * The script deletes documents in batches to avoid memory/timeout issues.
 */

const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');

async function main() {
  try {
    const svcPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const saJsonEnv = process.env.FIREBASE_SA_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || null;
    let tempSvcPath = null;
    // If service account JSON is provided via env var (useful for CI secrets), write to a temp file
    if (!svcPath && saJsonEnv) {
      const os = require('os');
      const path = require('path');
      tempSvcPath = path.join(os.tmpdir(), `svc-${Date.now()}.json`);
      try {
        require('fs').writeFileSync(tempSvcPath, saJsonEnv, { encoding: 'utf8', flag: 'w' });
        console.log('[clear-precons] Wrote temporary service account JSON to', tempSvcPath);
      } catch (e) {
        console.error('[clear-precons] Failed to write temporary service account file from FIREBASE_SA_JSON env var', e);
        process.exit(1);
      }
    }
    const effectiveSvcPath = svcPath || tempSvcPath;
    if (!svcPath) {
      console.error('Error: service account path not provided. Set GOOGLE_APPLICATION_CREDENTIALS or pass path as first arg.');
      process.exit(1);
    }

    // Validate path exists before requiring it so we can show a clearer message
    if (!effectiveSvcPath || !fs.existsSync(effectiveSvcPath)) {
      console.error(`[clear-precons] Error: service account file not found at: ${effectiveSvcPath || '<none provided>'}`);
      console.error('Make sure you downloaded the service account JSON from Firebase and provided the correct path.');
      console.error('Example (Windows cmd):');
      console.error('  set GOOGLE_APPLICATION_CREDENTIALS=C:\\Users\\you\\Downloads\\serviceAccountKey.json');
      console.error('  node scripts\\clear-precons-firestore.js');
      process.exit(1);
    }

    // Initialize admin SDK
    initializeApp({ credential: cert(require(effectiveSvcPath)) });
    const db = getFirestore();
    console.log('[clear-precons] Connected to Firestore.');

    const colRef = db.collection('precons');

    // Count documents first (best-effort; for very large collections this may be slow)
    const snapshot = await colRef.get();
    const total = snapshot.size;
    if (total === 0) {
      console.log('[clear-precons] No documents found in collection "precons". Nothing to do.');
      process.exit(0);
    }

    console.log(`[clear-precons] Found ${total} documents in "precons".`);
    // Ask for confirmation on stdin
    const confirm = await askYesNo(`Permanently delete ${total} documents from collection 'precons'? Type YES to continue: `);
    if (!confirm) {
      console.log('Aborted by user. No changes made.');
      process.exit(0);
    }

    // Delete in batches of 500
    const BATCH_SIZE = 500;
    let deleted = 0;

    while (true) {
      const batchSnap = await colRef.limit(BATCH_SIZE).get();
      if (batchSnap.empty) break;
      const batch = db.batch();
      batchSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deleted += batchSnap.size;
      console.log(`[clear-precons] Deleted ${deleted}/${total}...`);
      // small delay to be polite
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[clear-precons] Completed. Deleted ${deleted} documents.`);
    // Cleanup temporary file if created
    try {
      if (tempSvcPath && fs.existsSync(tempSvcPath)) fs.unlinkSync(tempSvcPath);
    } catch (e) { /* ignore cleanup errors */ }
    process.exit(0);
  } catch (err) {
    console.error('[clear-precons] Error', err);
    process.exit(2);
  }
}

function askYesNo(prompt) {
  return new Promise((resolve) => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans === 'YES');
    });
  });
}

main();

//node scripts\clear-precons-firestore.js