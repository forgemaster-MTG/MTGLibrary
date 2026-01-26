import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// const serviceAccount = require('../serviceAccountKey.json'); // Moved inside init for safety

// Initialize Firebase admin if not already
try {
    if (!admin.apps || admin.apps.length === 0) {
        let serviceAccount;

        // 1. Try Environment Variable (Production)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                console.log('[firebaseAdmin] Using FIREBASE_SERVICE_ACCOUNT env var');
            } catch (jsonErr) {
                console.error('[firebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT env var', jsonErr);
            }
        }

        // 2. Try Local File (Development)
        if (!serviceAccount) {
            try {
                serviceAccount = require('../serviceAccountKey.json');
                console.log('[firebaseAdmin] Using serviceAccountKey.json');
            } catch (err) {
                console.warn('[firebaseAdmin] serviceAccountKey.json not found');
            }
        }

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('[firebaseAdmin] Initialized successfully');
        } else {
            console.warn('[firebaseAdmin] No credentials found. Admin SDK not initialized.');
        }
    }
} catch (e) {
    console.error('[firebaseAdmin] init error', e.message || e);
}

export default admin;
