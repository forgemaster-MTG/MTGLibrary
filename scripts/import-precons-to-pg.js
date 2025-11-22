#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { knex } = require('../server/db');

const dir = path.join(__dirname, '..', 'MTG_Backup', 'Converted');

async function main() {
  if (!fs.existsSync(dir)) {
    console.error('[import-precons] Directory not found:', dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('[import-precons] No JSON files found in', dir);
    process.exit(0);
  }

  for (const file of files) {
    const p = path.join(dir, file);
    console.log('[import-precons] Processing', p);
    const raw = fs.readFileSync(p, 'utf8');
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { console.error('JSON parse failed', e); continue; }
    let items = [];
    if (Array.isArray(obj)) items = obj;
    else if (obj && typeof obj === 'object') {
      if (Array.isArray(obj.precons)) items = obj.precons;
      else if (Array.isArray(obj.items)) items = obj.items;
      else if (obj.collection) items = Object.values(obj.collection);
      else items = Object.values(obj);
    }
    console.log('[import-precons] Found', items.length, 'items in', file);
    for (const item of items) {
      const firestoreId = item.firestoreId || item.fireStoreId || item.id || null;
      const name = item.name || item.title || null;
      const row = { firestore_id: firestoreId, name, data: item };
      try {
        if (!firestoreId) {
          await knex('precons').insert(row);
        } else {
          await knex('precons').insert(row).onConflict('firestore_id').merge();
        }
      } catch (e) {
        console.error('[import-precons] Insert failed for', firestoreId, e.message || e);
      }
    }
  }
  console.log('[import-precons] Done');
  process.exit(0);
}

main();
