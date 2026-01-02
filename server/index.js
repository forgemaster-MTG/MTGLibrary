import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { knex } from './db.js';
import auth from './middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import API routers
import cardsApi from './api/cards.js';
import cardIdentifiersApi from './api/cardidentifiers.js';
import decksApi from './api/decks.js';
import usersApi from './api/users.js';
import preconsApi from './api/precons.js';
import collectionApi from './api/collection.js';
import adminApi from './api/admin.js';
import setsApi from './api/sets.js';
import syncApi from './api/sync.js';

const require = createRequire(import.meta.url);

// swagger deps are optional at runtime.
let yaml;
let swaggerUi;
try {
  yaml = require('js-yaml');
  swaggerUi = require('swagger-ui-express');
} catch (err) {
  console.warn('Optional dependency missing: swagger-ui-express or js-yaml. Swagger UI disabled.');
}

const app = express();
// Trust Proxy (Required for rate limiting behind Cloudflare/Docker)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://*.google.com", "https://*.googleapis.com", "https://*.gstatic.com", "https://*.firebaseapp.com", "https://*.firebaseio.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com", "https://*.firebaseio.com", "https://*.firebaseapp.com", "https://*.google.com", "https://*.gstatic.com"],
      connectSrc: ["'self'", "https://api.scryfall.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://*.firebaseio.com", "ws:", "wss:", "https://*.googleapis.com", "https://*.google.com", "https://*.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://cards.scryfall.io", "https://svgs.scryfall.io", "https://placehold.co", "blob:", "https://*"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://*.firebaseapp.com", "https://*.google.com"],
    },
  },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs (adjusted for API usage)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS Config (Restrict to trusted domains in production)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.PUBLIC_URL // e.g. https://mytunnel.com
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS from: ${origin}`);
      callback(null, false); // Block unknown origins? Or just allow all for now but warn.
      // For user ease, let's stick to simple CORS for now unless they specify a domain.
      // callback(new Error('Not allowed by CORS')); 
    }
  }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Authenticated user endpoints
app.get('/me', auth, async (req, res) => {
  // Fetch fresh user data including settings
  try {
    const user = await knex('users').where({ id: req.user.id }).first();
    res.json({
      id: user.id,
      firestore_id: user.firestore_id,
      email: user.email,
      data: user.data,
      settings: user.settings || {}
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db error' });
  }
});

// Saved views
app.get('/saved_views', auth, async (req, res) => {
  try {
    const rows = await knex('saved_views').where({ user_id: req.user.id }).select('*');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/saved_views', auth, async (req, res) => {
  const { name, data, firestore_id } = req.body;
  try {
    const insert = { user_id: req.user.id, name, data, firestore_id };
    const result = await knex('saved_views').insert(insert).returning('*');
    const row = Array.isArray(result) ? result[0] : result;
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

app.put('/saved_views/:id', auth, async (req, res) => {
  const id = req.params.id;
  const { name, data } = req.body;
  try {
    const existing = await knex('saved_views').where({ id }).first();
    if (!existing) return res.status(404).json({ error: 'not found' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'not allowed' });
    const result = await knex('saved_views').where({ id }).update({ name, data }).returning('*');
    const updated = Array.isArray(result) ? result[0] : result;
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

app.delete('/saved_views/:id', auth, async (req, res) => {
  const id = req.params.id;
  try {
    const existing = await knex('saved_views').where({ id }).first();
    if (!existing) return res.status(404).json({ error: 'not found' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'not allowed' });
    await knex('saved_views').where({ id }).del();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Mount APIs
app.use('/cards', cardsApi);
app.use('/cardidentifiers', cardIdentifiersApi);
app.use('/decks', decksApi);
app.use('/users', usersApi);
app.use('/precons', preconsApi);
app.use('/collection', collectionApi); // New collection/cards management API
app.use('/admin', adminApi);
app.use('/sets', setsApi);
app.use('/sync', syncApi);

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Serve Static Files (Production)
// Serve static assets from the "dist" directory (Vite build output)
app.use(express.static(path.join(__dirname, '../dist')));

// Serve "public" folder as well if needed (optional, Vite usually bundles everything)
app.use(express.static(path.join(__dirname, '../public')));

// Bug Tracker list - Read from Public/tasklist.txt
app.get('/bugs', (req, res) => {
  try {
    const bugPath = path.join(process.cwd(), 'public', 'tasklist.txt');
    if (fs.existsSync(bugPath)) {
      const content = fs.readFileSync(bugPath, 'utf-8');
      res.json({ content });
    } else {
      res.json({ content: 'Task List not found.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read task list' });
  }
});

// Swagger UI
if (yaml && swaggerUi) {
  try {
    const openapiPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
    if (fs.existsSync(openapiPath)) {
      const doc = yaml.load(fs.readFileSync(openapiPath, 'utf8'));
      app.use('/docs', swaggerUi.serve, swaggerUi.setup(doc, { explorer: true }));
      console.log('Swagger UI mounted at /docs');
    }
  } catch (err) {
    console.error('Failed to mount Swagger UI:', err);
  }
}

// --- Binders API ---

// Get User's Binders
app.get('/api/binders', auth, async (req, res) => {
  try {
    const rows = await knex('binders').where({ user_id: req.user.id }).orderBy('created_at', 'desc');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch binders' });
  }
});

// Create Binder
app.post('/api/binders', auth, async (req, res) => {
  const { name, type, icon_type, icon_value, color_preference } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const result = await knex('binders').insert({
      user_id: req.user.id,
      name,
      type: type || 'collection',
      icon_type: icon_type || 'emoji',
      icon_value: icon_value || '📁',
      color_preference: color_preference || 'blue'
    }).returning('id');

    // Postgres/Knex usually returns array of objects/ids. SQLite might return just integer.
    let id;
    if (Array.isArray(result) && result.length > 0) {
      const first = result[0];
      id = typeof first === 'object' ? (first.id || Object.values(first)[0]) : first;
    } else {
      id = result;
    }

    res.json({ id: typeof id === 'object' ? id.id : id, ...req.body });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create binder' });
  }
});

// Update Cards Batch (Binder/Tags)
app.put('/api/collection/batch-update', auth, async (req, res) => {
  const { cardIds, binderId, tags, price_bought } = req.body;

  if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
    return res.status(400).json({ error: 'No cards specified' });
  }

  const updates = {};
  if (binderId !== undefined) updates.binder_id = binderId;
  if (tags !== undefined) updates.tags = JSON.stringify(tags);
  if (price_bought !== undefined) updates.price_bought = price_bought;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updates specified' });

  try {
    // Use whereIn for batch update
    // user_id check is important
    await knex('user_cards')
      .whereIn('id', cardIds)
      .andWhere({ user_id: req.user.id })
      .update(updates);

    res.json({ success: true });
  } catch (err) {
    console.error("Batch update failed", err);
    res.status(500).json({ error: 'Update failed' });
  }
});

const port = process.env.PORT || 3000;

// Catch-All Handler for SPA (Must be last)
// For any request that doesn't match an API route or static file, send index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(port, () => console.log(`Server listening on ${port}`));
