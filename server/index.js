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
import { createServer } from 'http';
import { Server } from 'socket.io';

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
import auditApi from './api/audit.js';

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
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // allow from any device for pairing
    methods: ["GET", "POST"]
  }
});

// Trust Proxy (Required for rate limiting behind Cloudflare/Docker)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://*.google.com", "https://*.googleapis.com", "https://*.gstatic.com", "https://*.firebaseapp.com", "https://*.firebaseio.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com", "https://*.firebaseio.com", "https://*.firebaseapp.com", "https://*.google.com", "https://*.gstatic.com", "https://js.stripe.com", "https://cdn.jsdelivr.net", "blob:", "https://static.cloudflareinsights.com"],
      connectSrc: ["'self'", "https://api.scryfall.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://*.firebaseio.com", "ws:", "wss:", "https://*.googleapis.com", "https://*.google.com", "https://*.gstatic.com", "https://api.stripe.com", "https://cdn.jsdelivr.net", "data:", "blob:"],
      imgSrc: ["'self'", "data:", "https://cards.scryfall.io", "https://svgs.scryfall.io", "https://placehold.co", "blob:", "https://*"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "cdn.jsdelivr.net", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "cdn.jsdelivr.net", "https://cdn.jsdelivr.net"],
      frameSrc: ["'self'", "https://*.firebaseapp.com", "https://*.google.com", "https://js.stripe.com"],
      workerSrc: ["'self'", "blob:"],
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

// CORS Config (Permissive for local/personal usage)
app.use(cors({
  origin: true, // Reflects the request origin, functionality allowing any origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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
app.use('/api/audit', auditApi);

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

// Socket.io logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-pairing', (sessionId) => {
    socket.join(`pair-${sessionId}`);
    console.log(`Socket ${socket.id} joined pairing room: pair-${sessionId}`);
  });

  socket.on('card-scanned', ({ sessionId, card }) => {
    // Broadcast to the desktop in the same pairing room
    socket.to(`pair-${sessionId}`).emit('remote-card', card);
    console.log(`Card pushed to pairing room pair-${sessionId}:`, card.name);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const port = process.env.PORT || 3000;

// Catch-All Handler for SPA (Must be last)
// For any request that doesn't match an API route or static file, send index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

httpServer.listen(port, () => console.log(`Server listening on ${port}`));
