UI delegation and test guide

This folder contains the public-facing HTML and the modular JS assets.

Delegation pattern

- Centralized UI helpers live in `js/lib/ui.js` and export functions such as:
  - `showToast`, `showToastWithProgress`, `updateToastProgress`, `updateToast`, `removeToastById`
  - `openModal`, `closeModal`
  - `computeTableHeaderTop`

- These helpers are attached to `window` by `js/lib/ui.js` (for backwards compatibility). HTML and older inline scripts should call the shims on `window` (for example `window.showToast(...)`) rather than defining their own delegator functions.

Canonical handlers

- First-run admin/signup flow: `window.handleFirstRunSetup(email, password)` — this is the canonical entry point for automated tests to create an admin user, send verification, and force sign-out until verification completes.
- Secondary/test helpers that were previously used (now deprecated): `window.__runFirstRunSetup` (removed from `index-dev.html`). Tests should not rely on this legacy proxy.

Testing guidance (smoke harness)

- The smoke harness is `Public/tests/smokeTest.js`.
- It now prefers `window.handleFirstRunSetup(email, password)` for direct invocation. If you need a shim in your local tests, create it in your test harness rather than in HTML.
- The harness captures console logs, page errors, and network traces; it records identitytoolkit calls (accounts:signUp, accounts:lookup, accounts:sendOobCode) and asserts they returned status 200 and that `accounts:lookup` shows `emailVerified: false` for the newly created user.

Maintenance notes

- If you add a new UI helper, export it from `js/lib/ui.js` and (optionally) attach it to `window` there. This keeps HTML files small and avoids duplication.
- If a test requires a short-lived shim, add it in the test harness (not in the HTML files) and remove it once tests are updated to use canonical handlers.

Contact

- For questions about the migration or to propose further changes to the delegation pattern, see the main README or open an issue in the repository.

## Preconstructed Decks (Precons) and Firestore

This project supports serving preconstructed decks (precons) from either static JSON files under `Public/precons` or from a Firestore collection named `precons`.

How it works
- At runtime the UI prefers a Firestore-backed index (collection `precons`) when Firebase is configured on the page. If Firestore is not available or empty, the UI falls back to `/precons/index.generated.json` then `/precons/index.json`.
- The client caches the fetched index in `localStorage` to render instantly on subsequent page loads; a background refresh keeps the cache up to date.

Uploading precons to Firestore
- Use the Settings > Precons Admin block (visible to the configured admin email) and click **Upload Precons to Firestore**. This will read your static `/precons` JSON files and create/merge documents in the `precons` collection.
- Each document will include fields: `name`, `file` (original path), `cover`, and `content` (the deck JSON). Document ID is derived from the filename (basename without .json).

Firestore security rules (public read)
- To make precons readable by all users without authentication, ensure your Firestore rules allow public reads on the `precons` collection. A minimal example (adjust writes to restrict to your admin account):

```text
service cloud.firestore {
  match /databases/{database}/documents {
    match /precons/{docId} {
      allow read: if true; // public read
      allow write: if request.auth != null && request.auth.token.email == 'admin@example.com';
    }
  }
}
```

Notes
- Keep write permissions locked to an admin account or CI process to avoid unauthorized modifications. The uploader in the Settings UI requires an authenticated admin user to perform writes.
- If you prefer static hosting only, do not enable Firestore in your Firebase config and the UI will continue to use the static index files.

MTGJSON
- If you want to source decks from MTGJSON or another external endpoint, we can add a configurable fetch path. Provide the endpoint(s) or mapping you want (for example, an array of deck JSONs or a manifest URL) and I can wire an optional feature flag to prefer MTGJSON on page load.

Clearing the Firestore `precons` collection via GitHub Push
- You can trigger an automated clear of the `precons` collection by creating or updating a file named `.clear-precons` at the repo root and pushing to the `main` branch. This repo includes a GitHub Actions workflow that will run when `.clear-precons` is changed and will delete all documents in the `precons` collection.

Setup steps for the automated workflow:
1. Add a repository secret named `FIREBASE_SERVICE_ACCOUNT` containing the full service account JSON (the file contents) for a service account with permissions to delete documents in the project. In GitHub: Settings -> Secrets -> Actions -> New repository secret.
2. Create an empty file at the repo root named `.clear-precons` and commit + push it to `main` to trigger the workflow. Example:

```cmd
echo "clear" > .clear-precons
git add .clear-precons
git commit -m "trigger clear precons"
git push origin main
```

Warning
- This will permanently delete documents from your Firestore `precons` collection. Make sure you have a backup (export) if you need to retain data.
