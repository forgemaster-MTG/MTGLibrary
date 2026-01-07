import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { knex } from '../server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.join(__dirname, '..', 'AllDeckFiles');

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

  console.log(`[import-precons] Found ${files.length} files. importing...`);

  for (const file of files) {
    const p = path.join(dir, file);
    const raw = fs.readFileSync(p, 'utf8');
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      console.error('JSON parse failed', file, e);
      continue;
    }

    // Identify the deck object
    let deckData = null;
    if (obj.data && !Array.isArray(obj.data)) {
      deckData = obj.data;
    } else {
      // Fallback or skip if structure unknown
      console.warn('Skipping file due to unknown structure:', file);
      continue;
    }

    const name = deckData.name || path.basename(file, '.json').replace(/_/g, ' ');
    const setCode = deckData.code || deckData.releaseDate ? 'UNK' : 'UNK'; // Try to find set code

    // Attempt to determine type from file name or contents
    // heuristic: if commander array has items -> "Commander"
    // if code is JMP -> "Jumpstart"
    // if type property exists -> use it
    let type = deckData.type;
    if (!type) {
      if (deckData.commander && deckData.commander.length > 0) type = 'Commander';
      else if (deckData.code === 'JMP' || deckData.code === 'J22') type = 'Jumpstart';
      else type = 'Constructed';
    }

    // Determine colors from commander or mainboard
    let colors = [];
    if (deckData.commander && deckData.commander.length > 0) {
      // Union of commander identities
      const s = new Set();
      deckData.commander.forEach(c => (c.colorIdentity || []).forEach(clr => s.add(clr)));
      colors = Array.from(s);
    } else {
      // Maybe union of mainboard? or just empty
      // For Jumpstart, usually mono color or specific theme. 
      // Let's inspect first card or meta
      // For now leave empty if no commander
    }

    // Image URI (Commander or random mainboard)
    let imageUri = null;
    const allCards = [
      ...(deckData.commander || []),
      ...(deckData.mainBoard || []),
      ...(deckData.sideBoard || [])
    ];

    if (deckData.commander && deckData.commander.length > 0) {
      const c = deckData.commander[0];
      imageUri = c.image_uris?.art_crop || c.data?.image_uris?.art_crop
        || c.image_uris?.normal || c.data?.image_uris?.normal;
    }
    if (!imageUri && allCards.length > 0) {
      const c = allCards[0];
      imageUri = c.image_uris?.art_crop || c.data?.image_uris?.art_crop
        || c.image_uris?.normal || c.data?.image_uris?.normal;
    }

    // Insert Precon
    const preconRow = {
      name: name,
      set_code: deckData.code,
      type: type,
      colors: JSON.stringify(colors),
      commander_name: deckData.commander?.[0]?.name || null,
      card_count: allCards.reduce((acc, c) => acc + (c.count || c.quantity || 1), 0),
      image_uri: imageUri,
      release_date: deckData.releaseDate,
      metadata: JSON.stringify({ filename: file })
    };

    try {
      const [insertedPrecon] = await knex('precons').insert(preconRow).returning('id');
      const preconId = insertedPrecon.id || insertedPrecon; // Handle different PG return formats

      // Insert Cards
      const cardRows = [];
      const processZone = (zoneCards, zoneName) => {
        if (!zoneCards) return;
        for (const c of zoneCards) {
          const scryfallId = c.identifiers?.scryfallId || c.data?.identifiers?.scryfallId || c.uuid;
          cardRows.push({
            precon_id: preconId,
            card_name: c.name,
            scryfall_id: scryfallId,
            set_code: c.setCode || c.set_code,
            collector_number: c.number || c.collector_number,
            finish: c.finishes?.[0] || 'nonfoil',
            quantity: c.count || c.quantity || 1,
            zone: zoneName
          });
        }
      };

      processZone(deckData.commander, 'commander');
      processZone(deckData.mainBoard, 'mainBoard');
      processZone(deckData.sideBoard, 'sideBoard');

      // Batch insert
      if (cardRows.length > 0) {
        // Chunking for safety
        const chunkSize = 100;
        for (let i = 0; i < cardRows.length; i += chunkSize) {
          await knex('precon_cards').insert(cardRows.slice(i, i + chunkSize));
        }
      }

    } catch (e) {
      console.error(`[import-precons] Failed to insert ${name}:`, e.message);
    }
  }

  console.log('[import-precons] Done');
  process.exit(0);
}

main();
