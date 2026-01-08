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
import paymentsApi from './api/payments.js';
import preconsApi from './api/precons.js';
import collectionApi from './api/collection.js';
import adminApi from './api/admin.js';
import setsApi from './api/sets.js';
import syncApi from './api/sync.js';
import communityApi from './api/community.js';
import bindersApi from './api/binders.js';
import epicsApi from './api/epics.js';
import ticketsApi from './api/tickets.js';
import releasesApi from './api/releases.js';

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
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "cdn.jsdelivr.net"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "cdn.jsdelivr.net"],
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
  'http://localhost:5174', // Vite alternate port
  'http://localhost:5175', // Vite alternate port
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
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
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
app.use('/api/cards', cardsApi);
app.use('/api/cardidentifiers', cardIdentifiersApi);
app.use('/api/decks', decksApi);
app.use('/api/users', usersApi);
app.use('/api/payments', auth, paymentsApi);
app.use('/api/precons', preconsApi);
app.use('/api/collection', collectionApi); // New collection/cards management API
app.use('/api/admin', adminApi);
app.use('/api/sets', setsApi);
app.use('/api/sync', syncApi);
app.use('/api/community', communityApi);
app.use('/api/binders', bindersApi);
app.use('/api/epics', epicsApi);
app.use('/api/tickets', ticketsApi);
app.use('/api/releases', releasesApi);

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Community Routes
// Community Routes (Mounted above)
// app.use('/api/community', require('./api/community'));

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

const port = process.env.PORT || 3000;

// Catch-All Handler for SPA (Must be last)
// For any request that doesn't match an API route or static file, send index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(port, () => console.log(`Server listening on ${port}`));
