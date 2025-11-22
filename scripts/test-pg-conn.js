#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const { knex } = require('../server/db');

(async () => {
  try {
    console.log('[test-pg-conn] Running test query against Postgres...');
    // Simple query to validate connection
    const res = await knex.raw('select 1+1 as result');
    // Different drivers return results differently; prefer rows if present
    const rows = res && (res.rows || res[0]);
    console.log('[test-pg-conn] Query result:', rows || res);
    console.log('[test-pg-conn] Postgres connection OK');
    // destroy knex pool
    await knex.destroy();
    process.exit(0);
  } catch (err) {
    console.error('[test-pg-conn] Postgres connection FAILED:');
    console.error(err && err.message ? err.message : err);
    try { await knex.destroy(); } catch (e) {}
    process.exit(1);
  }
})();
