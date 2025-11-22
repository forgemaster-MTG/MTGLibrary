const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// --- IMPORTANT ---
// Download this file from your Firebase Project Settings
const serviceAccount = require('./mtglibrary-70b46-firebase-adminsdk-fbsvc-febf529fa8.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// --- Option 1: Check ALL documents in 'artifacts' ---
async function listSubcollectionsIn(collectionName) {
  console.log(`Checking for subcollections in: ${collectionName}`);

  const collectionRef = db.collection(collectionName);
  const documentSnapshots = await collectionRef.get();

  if (documentSnapshots.empty) {
    console.log(`No documents found in '${collectionName}'.`);
    return;
  }

  console.log('--- Found Documents & Their Subcollections ---');
  
  // Loop over each document and list its subcollections
  const allPromises = documentSnapshots.docs.map(async (doc) => {
    const subcollections = await doc.ref.listCollections();
    
    console.log(`\n📄 Document: ${doc.id}`);
    if (subcollections.length === 0) {
      console.log('   (No subcollections)');
    } else {
      subcollections.forEach(subcollection => {
        console.log(`   -> ${subcollection.id}`); // This is the subcollection name
      });
    }
  });
  
  await Promise.all(allPromises);
}


// --- Option 2: Check only ONE specific document (Faster) ---
async function listSubcollectionsForOneDoc(collectionName, documentId) {
  console.log(`Checking subcollections for: ${collectionName}/${documentId}`);
  
  const docRef = db.collection(collectionName).doc(documentId);
  const subcollections = await docRef.listCollections();

  if (subcollections.length === 0) {
    console.log('   (No subcollections)');
  } else {
    console.log('--- Found Subcollections ---');
    subcollections.forEach(subcollection => {
      console.log(`   -> ${subcollection.id}`);
    });
  }
}


// --- How to run ---

// 1. Run this to check all documents in 'artifacts'
//listSubcollectionsIn('artifacts');

// 2. OR, comment out the line above and uncomment this one
//    if you only want to check a single, known document.
listSubcollectionsForOneDoc('artifacts', 'cards');