/**
 * gemini.js
 * 
 * Handles interaction with the Google Gemini API.
 * 
 * SECURITY NOTE:
 * This module implements Client-Side Encryption to protect the user's API Key.
 * The key is encrypted using a key derived from the user's Firebase UID before storage.
 * It is decrypted only in browser memory when making requests.
 * 
 * WARNING: This is obfuscation, not true server-side security. 
 * The UID is public information. This prevents the raw key from sitting in the DB,
 * but a determined attacker with the UID could derive the key if they access the DB.
 */

import { db, appId } from '../main/index.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
// Helper functions
const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(base64) {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

async function deriveKeyFromPassphrase(passphrase, saltBuffer) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptApiKeyForUser(uid, apiKeyPlain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassphrase(uid, salt.buffer);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(apiKeyPlain));
  return { cipher: toBase64(cipher), iv: toBase64(iv), salt: toBase64(salt) };
}

export async function decryptApiKeyForUser(uid, encryptedObj) {
  if (!uid || !encryptedObj) return null;
  try {
    const { cipher, iv, salt } = encryptedObj;
    const key = await deriveKeyFromPassphrase(uid, fromBase64(salt));
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(cipher));
    const dec = new TextDecoder();
    return dec.decode(plainBuf);
  } catch (e) {
    console.error('[gemini] decrypt failed', e);
    return null;
  }
}

export async function saveGeminiKeyForUser(uid, apiKeyPlain) {
  if (!uid) throw new Error('uid required');
  const enc = await encryptApiKeyForUser(uid, apiKeyPlain);
  const userDocRef = doc(db, `artifacts/${appId}/users/${uid}`);
  const snap = await getDoc(userDocRef);
  const current = snap.exists() ? snap.data().settings || {} : {};
  current.gemini = { encrypted: enc, savedAt: new Date().toISOString() };
  await setDoc(userDocRef, { settings: current }, { merge: true });
  return true;
}

export async function clearGeminiKeyForUser(uid) {
  if (!uid) throw new Error('uid required');
  const userDocRef = doc(db, `artifacts/${appId}/users/${uid}`);
  const snap = await getDoc(userDocRef);
  const current = snap.exists() ? snap.data().settings || {} : {};
  current.gemini = null;
  await setDoc(userDocRef, { settings: current }, { merge: true });
  return true;
}

export async function getDecryptedGeminiKey(uid) {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, `artifacts/${appId}/users/${uid}`);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return null;
    const settings = snap.data().settings || {};
    const gem = settings.gemini || null;
    if (!gem || !gem.encrypted) return null;
    return await decryptApiKeyForUser(uid, gem.encrypted);
  } catch (e) {
    console.error('[gemini] getDecryptedGeminiKey error', e);
    return null;
  }
}

export async function getGeminiUrlForCurrentUser() {
  const uid = (typeof window !== 'undefined' && window.userId) ? window.userId : null;
  if (!uid) return null;
  const key = await getDecryptedGeminiKey(uid);
  if (!key) return null;
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
}
//models/gemini-3-pro-preview
//models/gemini-2.5-flash

// Expose a convenience wrapper on window
if (typeof window !== 'undefined') {
  window.getGeminiUrlForCurrentUser = getGeminiUrlForCurrentUser;
}

export default {
  encryptApiKeyForUser,
  decryptApiKeyForUser,
  saveGeminiKeyForUser,
  clearGeminiKeyForUser,
  getDecryptedGeminiKey,
  getGeminiUrlForCurrentUser
};
