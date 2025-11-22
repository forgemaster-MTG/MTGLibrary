require('dotenv').config();
const express = require('express');
const { knex } = require('./db');
const auth = require('./middleware/auth');
const fs = require('fs');
const path = require('path');

// swagger deps are optional at runtime. If the user hasn't run `npm install`, don't crash the server.
let yaml;
let swaggerUi;
try {
  yaml = require('js-yaml');
  swaggerUi = require('swagger-ui-express');
} catch (err) {
  // Do not rethrow; we'll skip mounting Swagger UI below and print a friendly message.
  console.warn('Optional dependency missing: swagger-ui-express or js-yaml not installed. Swagger UI at /docs will be disabled. Run `npm install` to enable it.');
}

const app = express();
app.use(express.json());

// public precons router is mounted below

// Authenticated user endpoints
app.get('/me', auth, async (req, res) => {
  // req.user comes from auth middleware
  res.json({ id: req.user.id, firestore_id: req.user.firestore_id, email: req.user.email, data: req.user.data });
});

// Saved views: list/create/update/delete for authenticated user
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

const cardsApi = require('./api/cards');
const cardIdentifiersApi = require('./api/cardidentifiers');
const decksApi = require('./api/decks');
const deckCardsApi = require('./api/deck_cards');
const usersApi = require('./api/users');
const preconsApi = require('./api/precons');

app.use('/cards', cardsApi);
app.use('/cardidentifiers', cardIdentifiersApi);
app.use('/decks', decksApi);
app.use('/deck_cards', deckCardsApi);
app.use('/users', usersApi);
app.use('/precons', preconsApi);

// Health endpoint: returns 200 and a list of mounted routes
app.get('/health', (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach((layer) => {
      // Direct routes
      if (layer.route && layer.route.path) {
        routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      }
      // Mounted routers
      if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        layer.handle.stack.forEach((handler) => {
          if (handler.route && handler.route.path) {
            routes.push({ path: handler.route.path, methods: Object.keys(handler.route.methods), mount: layer.regexp && layer.regexp.source });
          }
        });
      }
    });

    res.json({ ok: true, routes });
  } catch (err) {
    console.error('health error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Serve Swagger UI at /docs using docs/openapi.yaml (only if dependencies are present)
if (yaml && swaggerUi) {
  try {
    const openapiPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
    if (fs.existsSync(openapiPath)) {
      const doc = yaml.load(fs.readFileSync(openapiPath, 'utf8'));
      app.use('/docs', swaggerUi.serve, swaggerUi.setup(doc, { explorer: true }));
      console.log('Swagger UI mounted at /docs');
    } else {
      console.warn('OpenAPI file not found at', openapiPath);
    }
  } catch (err) {
    console.error('Failed to mount Swagger UI:', err);
  }
} else {
  console.log('Skipping Swagger UI mount because required packages are not installed. Run `npm install` to enable.');
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
