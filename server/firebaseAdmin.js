import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase admin if not already
try {
    if (!admin.apps || admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (e) {
    console.error('[firebaseAdmin] init error', e.message || e);
}

export default admin;
