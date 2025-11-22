Postgres on NAS (Docker) — Setup & Run

This project uses knex + objection and respects the DATABASE_URL (or PGHOST/PGUSER/PGPASSWORD/PGDATABASE) env vars. If you have Postgres running on your NAS via Docker, point the app at it and run migrations + import.

Windows (cmd.exe) quick steps

1. Set the DATABASE_URL environment variable for this terminal session (replace values):

```cmd
set DATABASE_URL=postgres://<user>:<password>@<nas-ip>:<port>/<database>
```

Example where NAS IP is 192.168.1.50 with DB `mtglibrary_dev`:

```cmd
set DATABASE_URL=postgres://postgres:change_me@192.168.1.50:5432/mtglibrary_dev
```

2. Run migrations (creates tables):

```cmd
npm run migrate
```

3. Import precons from local backups into the `precons` table (idempotent upserts using `firestore_id`):

```cmd
npm run import-precons
```

4. Start the server to smoke-test endpoints:

```cmd
npm run start:server
```

Then open in browser or curl:

- GET http://localhost:3000/precons
- GET http://localhost:3000/precons/<firestoreId>

Notes and troubleshooting

- If `npm run migrate` errors with ECONNREFUSED, double-check that the NAS Docker container is reachable from your machine and port 5432 is exposed and not blocked by firewall.
- To persist environment variables across sessions, create a `.env` file in repo root (it will be loaded by dotenv) with the line `DATABASE_URL=postgres://...`.
- If your NAS uses a hostname instead of IP, make sure your machine can resolve it.
- If the Postgres container is configured to require SSL, you may need to add `?ssl=true` to the DATABASE_URL and adjust knex settings.

If you want, paste the DATABASE_URL here (or set it in this terminal) and I will run the migration + import + server start and report back the results.