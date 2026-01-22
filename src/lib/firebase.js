
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Extracted from legacy app.js
const firebaseConfig = {
    apiKey: "AIzaSyAdqbFNjrB6y-8BrMEYYCT5ywiCgZVtMaE",
    authDomain: "mtglibrary-70b46.firebaseapp.com",
    projectId: "mtglibrary-70b46",
    storageBucket: "mtglibrary-70b46.firebasestorage.app",
    messagingSenderId: "602862103839",
    appId: "1:602862103839:web:23c64b7486c058c903d42a",
    measurementId: "G-EWELJJQ631",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
        console.warn('Firestore persistence not supported in this browser');
    }
});
const storage = getStorage(app);

export { auth, db, storage, app };
