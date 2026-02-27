# ForgeGames: The Omni-App Ecosystem Roadmap

This document outlines the strategic steps to evolve our single-TCG application (MTG-Forge) into **ForgeGames**—a sprawling, multi-game TCG platform and LGS B2B hub, as outlined in the ForgeGames Business Plan.

## Phase 1: The Omni-App Foundation (MTG & Pokémon Prototype)
*Status: In Progress*

The goal of this phase is to prove the multi-context architecture works flawlessly without risking the existing, stable Magic: The Gathering database.

- [x] **1. The Omni-Toggle Context**
  - [x] Create `OmniContext` global React state to manage `activeGame`.
  - [x] Update Navbar with the ForgeGames branding and visual MTG/Pokémon toggle.
  - [x] Inject `X-Game-Context` header into all frontend `api.js` requests.
  - [x] Add Express middleware to extract `req.gameContext`.

- [ ] **2. Pokémon Database & Data Ingestion**
  - [ ] Spin up a secondary development database (`pokemon_postgres_db_dev`).
  - [ ] Define a newly generalized `cards` table schema (utilizing JSONB `game_data` for specific card attributes).
  - [ ] Write a Node.js ingestion script targeting the Pokémon TCG API / JSON dump (PokemonTCG.io).
  - [ ] Seed the new database with Pokémon data.

- [ ] **3. Dynamic Database Routing**
  - [ ] Refactor `server/db.js` to manage connection pools for both MTG and Pokémon databases concurrently.
  - [ ] Update card-related API endpoints to select the correct database pool based on the `req.gameContext` header.
  - [ ] Verify frontend endpoints successfully fetch Pokémon data when toggled.

- [ ] **4. Game-Specific Theming Engine**
  - [ ] Define global CSS/Tailwind tokens for MTG (Dark/Abyssal) and Pokémon (Vibrant/Red/Yellow).
  - [ ] Update core React components (Navbar, buttons, backgrounds) to dynamically adopt the theme of the `activeGame`.

- [ ] **5. AI Persona Refactoring**
  - [ ] Update `personas.js` and Gemini prompts to check `req.gameContext`.
  - [ ] Draft Pokémon rulesets and deckbuilding limits for the prompt injections.

---

## Phase 2: Expanding the Multiverse
*Status: Planned*

Once the toggle and the database routing are proven stable with MTG and Pokémon, we rapidly ingest the remaining major TCGs.

- [ ] **1. Disney Lorcana Integration**
  - [ ] Create Lorcana database namespace.
  - [ ] Write ingestion script utilizing the LorcanaJSON GitHub data dump.
  - [ ] Implement Lorcana UI theme (Purple/Gold/Magical).

- [ ] **2. Star Wars: Unlimited Integration**
  - [ ] Create SWU database namespace.
  - [ ] Write ingestion script utilizing SWU-DB / SWUAPI JSON endpoints.
  - [ ] Implement SWU UI theme (Sci-fi/Neon/Stars).

- [ ] **3. Yu-Gi-Oh! Integration**
  - [ ] Create YGO database namespace.
  - [ ] Write ingestion script utilizing the YGOJSON open-source data dump.
  - [ ] Implement YGO UI theme (Manga/Egyptian/Dark).

- [ ] **4. The Multiverse Dashboard**
  - [ ] Build specialized "Omni-Widgets" for the user dashboard that query ALL databases simultaneously.
  - [ ] Display aggregate "Total Portfolio Value" across all collected games.
  - [ ] Display a unified "Recent Activity" feed spanning all games.

---

## Phase 3: Monetization & The Multiverse Pass
*Status: Planned*

Upgrading Stripe to support the multi-game model.

- [ ] **1. Stripe Subscription Tiers**
  - [ ] Define the $5/mo "Single Game" product in Stripe.
  - [ ] Define the $7.50/mo "Multiverse Pass" product in Stripe.
  - [ ] Define ad-hoc "Forge Credits" for AI interactions.
- [ ] **2. Access Control Logic**
  - [ ] Update the UI Toggle to display a paywall/upgrade prompt if a user clicks a game they are not subscribed to.
  - [ ] Ensure the Omni-Widgets properly restrict data based on subscription locks.

---

## Phase 4: The Forge Merchant (LGS B2B Ecosystem)
*Status: Planned*

Transforming the application from a player-tool to a business-management tool for Local Game Stores.

- [ ] **1. The LGS Portal Prototype**
  - [ ] Create an `is_merchant` flag for users.
  - [ ] Build a dedicated LGS dashboard to view community analytics and inventory.

- [ ] **2. Multi-Game Tournament Organizer**
  - [ ] Extend the existing tournament/bracket component.
  - [ ] Add the ability for stores to schedule specific game nights (e.g. MTG Fridays, Lorcana Saturdays).
  - [ ] Push notifications to local users based on their active `GameContexts`.

- [ ] **3. White-Label Storefronts (The Big Lift)**
  - [ ] Develop the Merchant Template Engine (allowing stores to point a custom domain at ForgeGames).
  - [ ] Build 3 beautifully styled frontend templates for stores to choose from.
  - [ ] Build integrated e-commerce carts allowing users to purchase singles or full AI-generated decks directly from the LGS.
