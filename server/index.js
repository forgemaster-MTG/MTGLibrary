import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express from 'express';
import { knex } from './db.js';
import auth from './middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// Import API routers
import cardsApi from './api/cards.js';
import cardIdentifiersApi from './api/cardidentifiers.js';
import decksApi from './api/decks.js';
import usersApi from './api/users.js';
import preconsApi from './api/precons.js';
import collectionApi from './api/collection.js';

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
app.use(cors()); // Enable All CORS Requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Authenticated user endpoints
app.get('/me', auth, async (req, res) => {
  // Fetch fresh user data including settings
  try {
    const user = await knex('users').where({ id: req.user.id }).first();
    res.json({ id: user.id, firestore_id: user.firestore_id, email: user.email, data: user.data, settings: user.settings || {} });
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
    const [row] = await knex('saved_views').insert(insert).returning('*');
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
    const [updated] = await knex('saved_views').where({ id }).update({ name, data }).returning('*');
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

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Bug Tracker list - Read from Public/tasklist.txt
app.get('/bugs', (req, res) => {
  try {
    const bugPath = path.join(process.cwd(), 'Public', 'tasklist.txt');
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
app.listen(port, () => console.log(`Server listening on ${port}`));
