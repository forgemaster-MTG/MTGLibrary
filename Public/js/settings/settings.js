import { db, appId, getGeminiUrlForCurrentUser } from '../main/index.js';
import * as Gemini from '../firebase/gemini.js';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, writeBatch, deleteField } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { showToast } from '../lib/ui.js';
import { calculateBasicLandsInUse } from '../lib/manaCalculator.js';

export let modalVisibilitySettings = {
  count: true,
  finish: true,
  condition: true,
  purchasePrice: true,
  notes: true,
  deckAssignments: true,
  // Scryfall / metadata fields (hidden by default)
  textless: false,
  set_type: false,
  lang: false,
  digital: false,
  cardmarket_id: false,
  object: false,
  highres_image: false,
  scryfall_set_uri: false,
  promo: false,
  nonfoil: false,
  games: false,
  purchase_uris: false,
  related_uris: false,
  set_search_uri: false,
  uri: false,
  security_stamp: false,
  oversized: false,
  booster: false,
  frame: false,
  prints_search_uri: false,
  edhrec_rank: false,
  variation: false,
  image_status: false,
  finishes: false,
  card_faces: false,
  reprint: false,
  promo_types: false,
  tcgplayer_id: false,
  story_spotlight: false,
  full_art: false,
  layout: false,
  image_uris: false,
};

// UI preferences persisted per-user: gridSize, viewMode, hideInDecks
export let uiPreferences = {
  gridSize: 'md',
  viewMode: 'grid',
  hideInDecks: false,
};

// Basic lands inventory tracked per-user
export let basicLands = {
  W: 0,  // Plains
  U: 0,  // Island
  B: 0,  // Swamp
  R: 0,  // Mountain
  G: 0,  // Forest
  showLandShortagesInNav: true  // Show nav banner when lands are needed
};

export let savedViews = [];
export let activeViewId = null;

export async function loadSettingsForUser(userId) {
  if (!userId) return;
  try {
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const settings = userDoc.data().settings;
      if (settings && settings.modalVisibility) modalVisibilitySettings = settings.modalVisibility;
      savedViews = settings.savedViews || [];
      activeViewId = settings.activeViewId || null;
      uiPreferences = settings.uiPreferences || uiPreferences;
      basicLands = settings.basicLands || basicLands;
      console.log('[Settings] Loaded basicLands from Firestore:', basicLands);
      // Expose to window for debugging and cross-module access
      if (typeof window !== 'undefined') {
        window.basicLands = basicLands;
      }
    }
  } catch (e) {
    console.error('Error loading settings for user', e);
  }
  return { modalVisibilitySettings, savedViews, activeViewId, basicLands };
}

export async function persistSettingsForUser(userId) {
  if (!userId) return;
  try {
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
    await setDoc(userDocRef, { settings: { ...((await getDoc(userDocRef)).data()?.settings || {}), savedViews, activeViewId, modalVisibility: modalVisibilitySettings, uiPreferences, basicLands } }, { merge: true });
    return true;
  } catch (e) {
    console.error('Error saving settings for user', e);
    return false;
  }
}

console.log('[Settings] Module loaded.');

// --- Saved Views and helper functions migrated here ---
export async function loadSavedViewsFromFirestore(userId) {
  console.debug('[Settings] loadSavedViewsFromFirestore called for userId=', userId);
  // Load saved views and active preferences from Firestore for the given userId.
  // If no userId is provided, do not load or attempt a local fallback — saved views are Firestore-only.
  if (!userId) {
    console.debug('[Settings] loadSavedViewsFromFirestore skipped: no userId (saved views are Firestore-only)');
    savedViews = [];
    activeViewId = null;
    try { if (typeof window !== 'undefined') { window.savedViews = savedViews; window.activeViewId = activeViewId; } } catch (e) { }
    return savedViews;
  }
  // Firestore-backed load
  try {
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const settings = userDoc.data().settings || {};
      // prefer per-view collection if present (backwards compat)
      savedViews = settings.savedViews || [];
      activeViewId = settings.activeViewId || null;
      uiPreferences = settings.uiPreferences || uiPreferences;
    } else {
      savedViews = [];
      activeViewId = null;
    }
    // If aggregated savedViews is empty, try loading from the per-view subcollection (backwards compat)
    try {
      if ((!savedViews || savedViews.length === 0)) {
        const base = `artifacts/${appId}/users/${userId}/views`;
        const colRef = collection(db, base);
        const snap = await getDocs(colRef);
        const docs = [];
        snap.forEach(d => docs.push(Object.assign({ id: d.id }, d.data())));
        if (docs.length) {
          savedViews = docs;
          console.debug('[Settings] loaded saved views from views subcollection, count=', docs.length);
        }
      }
    } catch (e) { console.debug('[Settings] fallback load from views subcollection failed', e); }
    console.debug('[Settings] loadSavedViewsFromFirestore completed for user', userId, 'viewsCount=', (savedViews || []).length, 'activeViewId=', activeViewId);
    try { if (typeof window !== 'undefined') { window.savedViews = savedViews; window.activeViewId = activeViewId; window.uiPreferences = uiPreferences; } } catch (e) { }
    if (typeof window.renderSavedViewsSelect === 'function') window.renderSavedViewsSelect(savedViews);
    if (activeViewId && typeof setActiveViewById === 'function') setActiveViewById(activeViewId);
    return savedViews;
  } catch (err) {
    console.error('[Settings] loadSavedViewsFromFirestore error', err);
    showToast('Failed to load saved views.', 'error');
    return [];
  }
}

export async function persistSavedViewsToFirestore(userId) {
  // Persist savedViews + activeViewId + uiPreferences to Firestore for the given userId.
  // Do not persist locally when no userId - saved views are Firestore-only.
  if (!userId) {
    console.debug('[Settings] persistSavedViewsToFirestore skipped: no userId (views are Firestore-only)');
    showToast('Sign in to persist saved views.', 'warning');
    return false;
  }
  try {
    // write aggregated settings to the user doc
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
    const current = (await getDoc(userDocRef)).data()?.settings || {};
    console.debug('[Settings] persistSavedViewsToFirestore: writing aggregated settings to user doc', userId, 'viewsCount=', (savedViews || []).length);
    await setDoc(userDocRef, { settings: Object.assign({}, current, { savedViews: savedViews || [], activeViewId, uiPreferences, modalVisibility: modalVisibilitySettings }) }, { merge: true });
    // Also persist per-view documents to user's views collection for easier queries
    const base = `artifacts/${appId}/users/${userId}/views`;
    for (const v of (savedViews || [])) {
      if (!v.id) continue;
      const vRef = doc(db, base, v.id);
      console.debug('[Settings] persistSavedViewsToFirestore: writing view doc', v.id);
      await setDoc(vRef, v, { merge: true });
    }
    showToast('Saved views persisted.', 'success');
    return true;
  } catch (err) {
    console.error('[Settings] persistSavedViewsToFirestore error', err);
    showToast('Failed to persist saved views.', 'error');
    return false;
  }
}

export function renderSavedViewsSelect(views = savedViews) {
  const el = document.getElementById('saved-views-select');
  if (!el) return;
  // Prefer any up-to-date window-scoped state (other modules may set window.savedViews)
  try { if (typeof window !== 'undefined' && Array.isArray(window.savedViews) && window.savedViews.length) { views = window.savedViews; savedViews = window.savedViews; } } catch (e) { }
  // replace content and avoid stacking multiple listeners by using onchange
  el.innerHTML = `<option value="">(none)</option>` + (views || []).map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  // prefer window.activeViewId if set
  try { el.value = (typeof window !== 'undefined' && window.activeViewId) || activeViewId || ''; } catch (e) { }
  el.onchange = (e) => {
    const vid = e.target.value;
    if (vid) setActiveViewById(vid);
    else {
      activeViewId = null;
      try { if (typeof window !== 'undefined') window.activeViewId = null; } catch (er) { }
      if (typeof window.renderPaginatedCollection === 'function') window.renderPaginatedCollection();
    }
  };
  // Keep global window state in sync after rendering
  try { if (typeof window !== 'undefined') { window.savedViews = savedViews; window.activeViewId = activeViewId; } } catch (e) { }
}

export function renderModalVisibilitySettings() {
  const container = document.getElementById('modal-visibility-settings');
  // Backwards-compat: prefer explicit default/additional containers if present
  const defaultContainer = document.getElementById('modal-visibility-default') || container;
  const additionalContainer = document.getElementById('modal-visibility-additional') || null;
  if (!defaultContainer) return;
  defaultContainer.innerHTML = '';
  if (additionalContainer) additionalContainer.innerHTML = '';

  // Define which fields are core (default) vs additional (advanced/metadata)
  const coreFields = ['count', 'finish', 'condition', 'purchasePrice', 'notes', 'deckAssignments'];
  const allFields = Object.keys(modalVisibilitySettings || {});
  const additionalFields = allFields.filter(f => !coreFields.includes(f)).sort();

  const labelize = (s) => String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const renderCheckbox = (field, containerEl) => {
    const id = `modal-vis-${field}`;
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2';
    div.innerHTML = `
      <label class="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" id="${id}" class="h-4 w-4" ${modalVisibilitySettings[field] ? 'checked' : ''} />
        <span class="">${labelize(field)}</span>
      </label>
    `;
    containerEl.appendChild(div);
    const cb = document.getElementById(id);
    if (!cb) return;
    cb.addEventListener('change', async (e) => {
      modalVisibilitySettings[field] = !!e.target.checked;
      // Trigger UI updates if renderers exist
      try { if (typeof window.renderPaginatedCollection === 'function') window.renderPaginatedCollection(); } catch (err) { }
      try { if (typeof window.renderCardDetailsModal === 'function') window.renderCardDetailsModal(); } catch (err) { }
      // Persist settings for current user when possible
      try { if (window && window.userId) await persistSettingsForUser(window.userId); } catch (err) { console.debug('[Settings] persist modal visibility failed', err); }
    });
  };

  // Render core fields
  coreFields.forEach(f => {
    if (allFields.includes(f)) renderCheckbox(f, defaultContainer);
  });
  // Render any remaining fields as Additional (if container present), otherwise append to default
  if (additionalContainer) {
    additionalFields.forEach(f => renderCheckbox(f, additionalContainer));
  } else {
    additionalFields.forEach(f => renderCheckbox(f, defaultContainer));
  }
}

export function buildFilterPredicate(rule) {
  if (!rule) return () => true;
  const op = (rule.op || rule.operator || '').toLowerCase();
  switch (op) {
    case 'contains': return (c) => (c[rule.field] || '').toString().toLowerCase().includes((rule.value || '').toString().toLowerCase());
    case 'equals': return (c) => (c[rule.field] || '').toString().toLowerCase() === (rule.value || '').toString().toLowerCase();
    case 'gt': return (c) => parseFloat(c[rule.field] || 0) > parseFloat(rule.value || 0);
    case 'lt': return (c) => parseFloat(c[rule.field] || 0) < parseFloat(rule.value || 0);
    default: return () => true;
  }
}

export function applySavedViewToCards(cardsArr) {
  if (!activeViewId) return cardsArr;
  const view = savedViews.find(v => v.id === activeViewId);
  if (!view) return cardsArr;
  let filtered = cardsArr;
  if (Array.isArray(view.filters) && view.filters.length) {
    const predicates = view.filters.map(buildFilterPredicate);
    filtered = filtered.filter(card => predicates.every(pred => pred(card)));
  }
  if (Array.isArray(view.sorts) && view.sorts.length) {
    const sorts = view.sorts;
    filtered = [...filtered].sort((a, b) => {
      for (const s of sorts) {
        const col = s.column; const dir = s.direction === 'asc' ? 1 : -1;
        let va = a[col] ?? ''; let vb = b[col] ?? '';
        if (col === 'price') { va = parseFloat(a.prices?.usd || 0); vb = parseFloat(b.prices?.usd || 0); }
        if (col === 'count') { va = a.count || 1; vb = b.count || 1; }
        if (typeof va === 'string') va = va.toLowerCase(); if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return -1 * dir; if (va > vb) return 1 * dir;
      }
      return 0;
    });
  }
  return filtered;
}

export async function saveViewToFirestore(userId, view) {
  if (!view) return null;
  // normalize known keys (compat: operator vs op)
  try {
    view.filters = (view.filters || []).map(f => ({ field: f.column || f.field, operator: f.operator || f.op, value: f.value }));
    view.sorts = (view.sorts || []).map(s => ({ column: s.column, direction: s.direction || s.dir || 'asc' }));
    view.groupBy = Array.isArray(view.groupBy) ? view.groupBy.filter(Boolean) : [];
  } catch (e) { /* best-effort normalize */ }
  // Require userId (Firestore) for persistence
  if (!userId) {
    console.debug('[Settings] saveViewToFirestore skipped: no userId (views are Firestore-only)');
    showToast('Sign in to save views.', 'warning');
    return null;
  }
  // Firestore-backed save
  try {
    const base = `artifacts/${appId}/users/${userId}/views`;
    console.debug('[Settings] saveViewToFirestore: saving view for user', userId, view && view.id);
    if (!view.id) {
      // create new doc
      const colRef = collection(db, base);
      const docRef = await addDoc(colRef, view);
      const saved = Object.assign({ id: docRef.id }, view);
      console.debug('[Settings] saveViewToFirestore: created view doc', docRef.id);
      savedViews.push(saved);
      // update aggregated settings on user doc
      await persistSavedViewsToFirestore(userId);
      try { if (typeof window !== 'undefined') window.savedViews = savedViews; } catch (e) { }
      if (typeof window.renderSavedViewsSelect === 'function') window.renderSavedViewsSelect(savedViews);
      showToast('View saved.', 'success');
      return saved;
    } else {
      const vRef = doc(db, base, view.id);
      await setDoc(vRef, view, { merge: true });
      console.debug('[Settings] saveViewToFirestore: updated view doc', view.id);
      const idx = savedViews.findIndex(v => v.id === view.id);
      const updated = Object.assign({ id: view.id }, view);
      if (idx >= 0) savedViews[idx] = updated; else savedViews.push(updated);
      await persistSavedViewsToFirestore(userId);
      try { if (typeof window !== 'undefined') window.savedViews = savedViews; } catch (e) { }
      if (typeof window.renderSavedViewsSelect === 'function') window.renderSavedViewsSelect(savedViews);
      showToast('View updated.', 'success');
      return updated;
    }
  } catch (err) {
    console.error('[Settings] saveViewToFirestore error', err);
    showToast('Failed to save view.', 'error');
    return null;
  }
}

// Helper for debugging: force reload saved views for current user
export function forceLoadSavedViews(userId) {
  try { return loadSavedViewsFromFirestore(userId || window.userId || null); } catch (e) { console.debug('[Settings] forceLoadSavedViews failed', e); }
}

export async function deleteViewFromFirestore(userId, viewId) {
  if (!viewId) return false;
  if (!userId) {
    console.debug('[Settings] deleteViewFromFirestore skipped: no userId (views are Firestore-only)');
    showToast('Sign in to delete saved views.', 'warning');
    return false;
  }
  try {
    const viewRef = doc(db, `artifacts/${appId}/users/${userId}/views`, viewId);
    await deleteDoc(viewRef);
    savedViews = savedViews.filter(v => v.id !== viewId);
    if (activeViewId === viewId) activeViewId = null;
    await persistSavedViewsToFirestore(userId);
    try { if (typeof window !== 'undefined') window.savedViews = savedViews; } catch (e) { }
    if (typeof window.renderSavedViewsSelect === 'function') window.renderSavedViewsSelect(savedViews);
    showToast('Saved view deleted.', 'success');
    return true;
  } catch (err) {
    console.error('[Settings] deleteViewFromFirestore error', err);
    showToast('Failed to delete view.', 'error');
    return false;
  }
}

export async function setActiveViewById(viewId) {
  activeViewId = viewId || null;
  try { if (typeof window !== 'undefined') window.activeViewId = activeViewId; } catch (e) { }
  const view = savedViews.find(v => v.id === viewId) || null;
  // copy view preferences into uiPreferences
  if (view) {
    uiPreferences.gridSize = view.gridSize || uiPreferences.gridSize;
    uiPreferences.viewMode = view.viewMode || uiPreferences.viewMode;
    uiPreferences.hideInDecks = typeof view.hideInDecks !== 'undefined' ? !!view.hideInDecks : uiPreferences.hideInDecks;
    try { if (typeof window !== 'undefined') window.uiPreferences = uiPreferences; } catch (e) { }
  }
  // persist active view + prefs
  try {
    if (typeof window !== 'undefined' && window.userId) {
      await persistSettingsForUser(window.userId);
    } else {
      try { localStorage.setItem('mtglibrary.activeViewId', activeViewId || ''); localStorage.setItem('mtglibrary.uiPreferences', JSON.stringify(uiPreferences || {})); } catch (e) { }
    }
  } catch (e) { console.debug('[Settings] persist active view failed', e); }
  // apply the view through collection/app hook
  try {
    if (typeof window.applySavedView === 'function') { window.applySavedView(view); return; }
  } catch (e) { console.debug('[Settings] applySavedView hook failed', e); }
  if (typeof window.renderPaginatedCollection === 'function') window.renderPaginatedCollection();
}

export function initSettingsModule() {
  if (typeof window !== 'undefined') {
    window.loadSavedViewsFromFirestore = loadSavedViewsFromFirestore;
    window.persistSavedViewsToFirestore = persistSavedViewsToFirestore;
    window.renderSavedViewsSelect = renderSavedViewsSelect;
    window.renderModalVisibilitySettings = renderModalVisibilitySettings;
    window.buildFilterPredicate = buildFilterPredicate;
    window.applySavedViewToCards = applySavedViewToCards;
    window.uiPreferences = uiPreferences;
    window.saveViewToFirestore = saveViewToFirestore;
    window.deleteViewFromFirestore = deleteViewFromFirestore;
    window.setActiveViewById = setActiveViewById;
    window.renderGeminiSettings = renderGeminiSettings;
    window.renderUIPreferences = renderUIPreferences;
    window.renderPreconsAdmin = renderPreconsAdmin;
    window.loadSettingsForUser = loadSettingsForUser;
    // expose current saved views and active id for legacy inline code
    try { window.savedViews = savedViews; window.activeViewId = activeViewId; } catch (e) { }
    // Removed localStorage fallback: saved views are Firestore-only. UI will be updated after loadSavedViewsFromFirestore is called with a valid userId.
  }
  // Try to hook into Settings view rendering without editing index-live.html.
  // When the Settings nav is clicked or the settings view becomes visible, render all settings sections.
  try {
    document.addEventListener('click', (ev) => {
      try {
        const t = ev.target;
        if (!t) return;
        if (t.id === 'nav-settings' || (t.closest && t.closest('#nav-settings')) ||
          t.id === 'mobile-nav-settings' || (t.closest && t.closest('#mobile-nav-settings'))) {
          // Delay slightly to allow the view switch to complete in the legacy UI
          setTimeout(() => {
            try {
              // Initialize tabs first
              if (typeof window.initSettingsTabs === 'function') window.initSettingsTabs();
              // Then render all sections
              renderGeminiSettings();
              renderModalVisibilitySettings();
              renderUIPreferences();
              renderPreconsAdmin();
              renderSettingsDeckList();
              renderBasicLandsSection();
            } catch (_) { }
          }, 80);
        }
      } catch (_) { }
    });
    // If the settings view is already visible on load, render everything once.
    setTimeout(() => {
      try {
        const sv = document.getElementById('settings-view');
        if (sv && !sv.classList.contains('hidden')) {
          if (typeof window.initSettingsTabs === 'function') window.initSettingsTabs();
          renderGeminiSettings();
          renderModalVisibilitySettings();
          renderUIPreferences();
          renderPreconsAdmin();
          renderSettingsDeckList();
          renderBasicLandsSection();
        }
      } catch (_) { }
    }, 200);
  } catch (e) { console.debug('[Settings] settings view hook failed', e); }

  // Install a left-nav banner that prompts the user to configure their Gemini API key when missing.
  try {
    function createNavBannerIfNeeded() {
      try {
        const nav = document.querySelector('nav');
        if (!nav) return null;
        if (document.getElementById('nav-gemini-banner')) return document.getElementById('nav-gemini-banner');
        const banner = document.createElement('button');
        banner.id = 'nav-gemini-banner';
        banner.className = 'nav-link w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-yellow-300 hover:bg-yellow-700';
        banner.style.display = 'none';
        banner.innerHTML = `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z"/></svg><span class="text-sm">Add Gemini API Key</span>`;
        // insert near the top so it's clearly visible
        const firstSection = nav.querySelector('.space-y-2');
        if (firstSection && firstSection.parentElement) firstSection.parentElement.insertBefore(banner, firstSection.nextSibling);
        else nav.insertBefore(banner, nav.firstChild);
        banner.addEventListener('click', (e) => {
          try { if (typeof window.showView === 'function') window.showView('settings'); } catch (er) { }
          try { renderGeminiSettings(); } catch (er) { }
          // focus settings visually
          try { const el = document.getElementById('settings-gemini-section'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (er) { }
        });
        return banner;
      } catch (e) { console.debug('[Settings] createNavBannerIfNeeded failed', e); return null; }
    }

    async function updateGeminiUiState() {
      try {
        const banner = createNavBannerIfNeeded();
        // Determine whether the user has a saved key
        const uid = (typeof window !== 'undefined' && window.userId) ? window.userId : null;
        let hasKey = false;
        if (uid) {
          try { const k = await Gemini.getDecryptedGeminiKey(uid); if (k) hasKey = true; } catch (e) { console.debug('[Settings] getDecryptedGeminiKey failed', e); }
        }
        if (banner) banner.style.display = (!hasKey ? '' : 'none');
        // Also update the settings block status if it's present
        try { const statusEl = document.getElementById('gemini-status'); if (statusEl) { statusEl.textContent = hasKey ? 'A Gemini API key is saved for your account.' : 'No Gemini API key saved.'; } } catch (e) { }
      } catch (e) { console.debug('[Settings] updateGeminiUiState failed', e); }
    }

    // run an initial update and also update when auth/user changes
    setTimeout(updateGeminiUiState, 200);
    window.addEventListener('user:changed', updateGeminiUiState);
    window.addEventListener('gemini:changed', updateGeminiUiState);
    // also poll briefly during startup to catch late auth binds
    let tries = 0;
    const iv = setInterval(() => { tries++; updateGeminiUiState(); if (tries > 10) clearInterval(iv); }, 500);
  } catch (e) { console.debug('[Settings] nav banner install failed', e); }

  // Install land shortages banner
  try {
    function createLandShortagesBannerIfNeeded() {
      try {
        const nav = document.querySelector('nav');
        if (!nav) return null;
        if (document.getElementById('nav-land-shortages-banner')) return document.getElementById('nav-land-shortages-banner');
        const banner = document.createElement('button');
        banner.id = 'nav-land-shortages-banner';
        banner.className = 'nav-link w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-orange-300 hover:bg-orange-700';
        banner.style.display = 'none';
        banner.innerHTML = `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><span class="text-sm">Need More Basic Lands</span>`;
        // insert after Gemini banner if it exists, otherwise near top
        const geminiBanner = document.getElementById('nav-gemini-banner');
        if (geminiBanner && geminiBanner.nextSibling) {
          geminiBanner.parentElement.insertBefore(banner, geminiBanner.nextSibling);
        } else {
          const firstSection = nav.querySelector('.space-y-2');
          if (firstSection && firstSection.parentElement) firstSection.parentElement.insertBefore(banner, firstSection.nextSibling);
          else nav.insertBefore(banner, nav.firstChild);
        }
        banner.addEventListener('click', (e) => {
          try { if (typeof window.showView === 'function') window.showView('settings'); } catch (er) { }
          // Switch to Data tab
          try {
            const dataTab = document.querySelector('[data-tab="data"]');
            if (dataTab) dataTab.click();
          } catch (er) { }
          // Scroll to basic lands section
          try {
            setTimeout(() => {
              const el = document.getElementById('basic-lands-container');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          } catch (er) { }
        });
        return banner;
      } catch (e) { console.debug('[Settings] createLandShortagesBannerIfNeeded failed', e); return null; }
    }

    window.updateLandShortagesBanner = async function () {
      try {
        const banner = createLandShortagesBannerIfNeeded();
        if (!banner) return;

        // Check if user wants to see the banner
        const showBanner = basicLands.showLandShortagesInNav !== false;
        if (!showBanner) {
          banner.style.display = 'none';
          return;
        }

        // Calculate if there are any shortages
        const decks = window.localDecks || {};
        const usage = calculateBasicLandsInUse(decks);
        let hasShortage = false;

        ['W', 'U', 'B', 'R', 'G'].forEach(color => {
          const owned = basicLands[color] || 0;
          const needed = usage[color] || 0;
          if (needed > owned) {
            hasShortage = true;
          }
        });

        banner.style.display = hasShortage ? '' : 'none';
      } catch (e) { console.debug('[Settings] updateLandShortagesBanner failed', e); }
    };

    // Run initial update
    setTimeout(() => window.updateLandShortagesBanner(), 300);
    // Update when user changes or decks change
    window.addEventListener('user:changed', () => window.updateLandShortagesBanner());
    // Poll briefly during startup
    let landTries = 0;
    const landIv = setInterval(() => {
      landTries++;
      if (typeof window.updateLandShortagesBanner === 'function') window.updateLandShortagesBanner();
      if (landTries > 10) clearInterval(landIv);
    }, 500);
  } catch (e) { console.debug('[Settings] land shortages banner install failed', e); }

  console.log('[Settings] Module initialized');
}

// Render UI Preferences in the General tab
export function renderUIPreferences() {
  const container = document.getElementById('ui-preferences-container');
  if (!container) return;

  // Get current preferences
  const prefs = window.uiPreferences || uiPreferences;

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Default View Mode</label>
        <div class="flex gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="ui-view-mode" value="grid" ${prefs.viewMode === 'grid' ? 'checked' : ''} class="w-4 h-4 text-indigo-600">
            <span class="text-sm text-gray-300">Grid</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="ui-view-mode" value="table" ${prefs.viewMode === 'table' ? 'checked' : ''} class="w-4 h-4 text-indigo-600">
            <span class="text-sm text-gray-300">Table</span>
          </label>
        </div>
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Default Grid Size</label>
        <div class="flex gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="ui-grid-size" value="sm" ${prefs.gridSize === 'sm' ? 'checked' : ''} class="w-4 h-4 text-indigo-600">
            <span class="text-sm text-gray-300">Small</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="ui-grid-size" value="md" ${prefs.gridSize === 'md' ? 'checked' : ''} class="w-4 h-4 text-indigo-600">
            <span class="text-sm text-gray-300">Medium</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="ui-grid-size" value="lg" ${prefs.gridSize === 'lg' ? 'checked' : ''} class="w-4 h-4 text-indigo-600">
            <span class="text-sm text-gray-300">Large</span>
          </label>
        </div>
      </div>
      
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="ui-hide-in-decks" ${prefs.hideInDecks ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
          <span class="text-sm text-gray-300">Hide cards that are in decks when browsing collection</span>
        </label>
      </div>
    </div>
  `;

  // Attach listeners
  container.querySelectorAll('input[name="ui-view-mode"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      uiPreferences.viewMode = e.target.value;
      window.uiPreferences = uiPreferences;
      await persistSettingsForUser(window.userId);
      showToast('View mode preference saved', 'success');
    });
  });

  container.querySelectorAll('input[name="ui-grid-size"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      uiPreferences.gridSize = e.target.value;
      window.uiPreferences = uiPreferences;
      await persistSettingsForUser(window.userId);
      showToast('Grid size preference saved', 'success');
    });
  });

  document.getElementById('ui-hide-in-decks')?.addEventListener('change', async (e) => {
    uiPreferences.hideInDecks = e.target.checked;
    window.uiPreferences = uiPreferences;
    await persistSettingsForUser(window.userId);
    showToast('Hide in-deck preference saved', 'success');
    if (typeof window.renderPaginatedCollection === 'function') window.renderPaginatedCollection();
  });
}

// Render a small UI block in Settings to manage the user's Gemini API key.
export function renderGeminiSettings(containerId = 'settings-gemini-block') {
  // Target the AI tab container
  let container = document.getElementById('settings-gemini-section-container');
  if (!container) {
    // Fallback to old location if tab structure not found
    container = document.getElementById('settings-view');
  }
  if (!container) return;

  // If an existing block exists, remove it so re-render is idempotent
  const existing = document.getElementById(containerId);
  if (existing) existing.remove();
  const block = document.createElement('div');
  block.id = containerId;
  block.className = 'bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700';
  block.innerHTML = `
    <h2 class="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">AI / Gemini API Key</h2>
    <p class="text-sm text-gray-400 mb-2">This app requires a per-user Gemini API key. Keys are encrypted in your account settings before saving.</p>
    <div class="space-y-2">
      <input id="gemini-api-key-input" type="text" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm" placeholder="Enter your Gemini API key here">
      <div class="flex gap-2">
        <button id="save-gemini-key-btn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">Save Key</button>
        <button id="clear-gemini-key-btn" class="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">Clear</button>
        <button id="show-gemini-help-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm">How to get a key</button>
      </div>
      <div id="gemini-help-area" class="mt-6 hidden text-sm text-gray-300 border-t border-gray-700 pt-6">
            <p>To get a Gemini API key, sign up at Google AI Studio. You can get a key on the free tier, which is great for learning and light use.</p>
            <ul>
            <li>
              Sign In: You will first be prompted to sign in with your Google account (like your Gmail).
            </li>
            <li>
              Agree to Terms: You may need to read and agree to the Google AI Studio Terms of Service.            </li>
            <li>
              Create Project (if new): If you've never used it before, you might be prompted to create a new "project." You can just give it a simple name (e.g., "My MTG Cards").
            </li>
            <li>
              Find the Button: On the API key page, look for a button that says "Create API key in new project" or "Create API key."
            </li>
            <li>
              Copy Your Key: A pop-up will appear showing your new API key (a long string of letters and numbers). Use the "copy" icon or highlight the text to copy it.
            </li>
            <li>
              Paste and Save: Paste this key into the input field on the MTG website and save it. Treat this key like a password—don't share it publicly!
            </li>
            </ul>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="inline-block bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg my-3 transition duration-300">
                Go to Google AI Studio
            </a>

            <p class="mt-2 mb-2">Here is a video walkthrough:</p>
            
            <!-- Responsive YouTube Embed -->
            <div class="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
                <iframe 
                    class="w-full h-full"
                    src="https://www.youtube.com/embed/6BRyynZkvf0?si=sK9xR_oBibLfMubt" 
                    title="YouTube video player" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    referrerpolicy="strict-origin-when-cross-origin" 
                    allowfullscreen>
                </iframe>
            </div>
        </div>
      <div id="gemini-status" class="text-sm text-gray-400"></div>
    </div>
  `;
  // Place the Gemini block in the AI tab container
  container.innerHTML = '';
  container.appendChild(block);

  const input = document.getElementById('gemini-api-key-input');
  const saveBtn = document.getElementById('save-gemini-key-btn');
  const clearBtn = document.getElementById('clear-gemini-key-btn');
  const helpBtn = document.getElementById('show-gemini-help-btn');
  const helpArea = document.getElementById('gemini-help-area');
  const status = document.getElementById('gemini-status');

  async function refreshStatus() {
    try {
      status.textContent = 'Checking for saved key...';
      const uid = window.userId || null;
      if (!uid) { status.textContent = 'Sign in to manage your Gemini API key.'; return; }
      const key = await Gemini.getDecryptedGeminiKey(uid);
      if (key) { status.textContent = 'A Gemini API key is saved for your account.'; input.value = ''; }
      else { status.textContent = 'No Gemini API key saved.'; }
    } catch (e) { status.textContent = 'Could not read key status.'; console.error(e); }
  }

  saveBtn.addEventListener('click', async () => {
    const uid = window.userId || null;
    if (!uid) { showToast('Sign in to save your API key.', 'warning'); return; }
    const val = input.value?.trim();
    if (!val) { showToast('Enter a valid API key before saving.', 'error'); return; }
    saveBtn.disabled = true;
    try {
      await Gemini.saveGeminiKeyForUser(uid, val);
      showToast('Gemini API key saved (encrypted).', 'success');
      input.value = '';
      await refreshStatus();
      try { window.dispatchEvent(new Event('gemini:changed')); } catch (e) { }
    } catch (err) { console.error(err); showToast('Failed to save key.', 'error'); }
    saveBtn.disabled = false;
  });

  clearBtn.addEventListener('click', async () => {
    const uid = window.userId || null;
    if (!uid) { showToast('Sign in to clear your API key.', 'warning'); return; }
    if (!confirm('Clear your saved Gemini API key?')) return;
    try { await Gemini.clearGeminiKeyForUser(uid); showToast('Gemini key cleared.', 'success'); await refreshStatus(); } catch (e) { console.error(e); showToast('Failed to clear key.', 'error'); }
    try { window.dispatchEvent(new Event('gemini:changed')); } catch (e) { }
  });

  helpBtn.addEventListener('click', () => { helpArea.classList.toggle('hidden'); });

  // Initial status load
  setTimeout(refreshStatus, 120);

  // Render the precons admin block (only visible to specific admin email)
  try { renderPreconsAdmin(); } catch (e) { /* ignore if function not available yet */ }
}

/**
 * Render an admin-only Precons uploader block in Settings.
 * Visible only when the signed-in user's email matches the configured admin email.
 */
export function renderPreconsAdmin(containerId = 'settings-precons-admin') {
  try {
    // Target the Advanced tab container
    let settingsView = document.getElementById('settings-precons-admin-container');
    if (!settingsView) {
      // Fallback to old location
      settingsView = document.getElementById('settings-view');
    }
    if (!settingsView) return;

    // remove existing block if present
    const existing = document.getElementById(containerId);
    if (existing) existing.remove();

    // Determine current user email via firebase auth on window
    const auth = window.__firebase_auth || null;
    const userEmail = auth && auth.currentUser ? (auth.currentUser.email || '') : (window.userEmail || '');
    const adminEmail = 'Gidgidonihah.147@gmail.com';
    if (!userEmail || userEmail.toLowerCase() !== adminEmail.toLowerCase()) {
      // not admin: nothing to render
      return;
    }

    const block = document.createElement('section');
    block.id = containerId;
    block.className = 'bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 mb-6';
    block.innerHTML = `
      <h2 class="text-2xl font-semibold mb-3">Precons Admin</h2>
      <p class="text-sm text-gray-400 mb-3">Upload all JSON files from <code>/precons</code> into Firestore so they can be served from the database.</p>
      <div class="flex items-center gap-2">
        <button id="precons-upload-btn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded">Upload Precons to Firestore</button>
        <button id="precons-regenerate-index-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded">Regenerate Index (repo)</button>
        <span id="precons-upload-status" class="text-sm text-gray-300 ml-3"></span>
      </div>
      <div id="precons-upload-results" class="mt-4 text-sm text-gray-300"></div>
    `;

    // Add helper details for Firestore rules and making precons publicly readable
    const help = document.createElement('div');
    help.className = 'mt-3 text-sm text-gray-300';
    help.innerHTML = `
      <details class="bg-gray-900 p-3 rounded mt-3">
        <summary class="font-medium">Firestore setup & public-read rules</summary>
        <div class="mt-2 text-sm text-gray-400">
          <p>To serve precons from Firestore for everyone, ensure the <code>precons</code> collection is readable by unauthenticated users. Example rule (restrict writes to admins):</p>
          <pre class="mt-2 p-3 bg-gray-800 text-xs rounded text-green-300" style="overflow:auto">service cloud.firestore {
  match /databases/{database}/documents {
    match /precons/{docId} {
      allow read: if true; // public read
      allow write: if request.auth != null && request.auth.token.email == 'Gidgidonihah.147@gmail.com';
    }
  }
}
          </pre>
          <p class="mt-2">Adjust the write rule to match your admin auth method. After applying rules, use the <strong>Upload Precons to Firestore</strong> button above to publish the JSON files from <code>/precons</code>.</p>
        </div>
      </details>
    `;
    block.appendChild(help);

    // Append to the Advanced tab container
    settingsView.appendChild(block);

    const uploadBtn = document.getElementById('precons-upload-btn');
    const regenBtn = document.getElementById('precons-regenerate-index-btn');
    const statusEl = document.getElementById('precons-upload-status');
    const resultsEl = document.getElementById('precons-upload-results');

    // Clear precons cache button (admin only)
    const clearCacheBtn = document.createElement('button');
    clearCacheBtn.id = 'precons-clear-cache-btn';
    clearCacheBtn.className = 'bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded';
    clearCacheBtn.textContent = 'Clear Precons Cache';
    // insert after upload/regenerate controls
    if (regenBtn && regenBtn.parentElement) regenBtn.parentElement.appendChild(clearCacheBtn);

    if (uploadBtn) uploadBtn.addEventListener('click', async () => {
      if (!confirm('Upload all precons from /precons to Firestore? This will overwrite existing docs with the same IDs.')) return;
      uploadBtn.disabled = true; statusEl.textContent = 'Starting...'; resultsEl.textContent = '';
      try {
        const mod = await import('../admin/preconsUploader.js');
        const res = await mod.uploadPreconsToFirestore((done, total, name) => {
          statusEl.textContent = `Uploading ${done}/${total}: ${name}`;
        });
        if (res && res.success) {
          statusEl.textContent = `Completed: ${res.results.filter(r => r.ok).length}/${res.results.length} uploaded`;
          resultsEl.innerHTML = `<pre style="white-space:pre-wrap">${JSON.stringify(res.results, null, 2)}</pre>`;
        } else {
          statusEl.textContent = 'Upload failed';
          resultsEl.textContent = JSON.stringify(res || {}, null, 2);
        }
      } catch (err) {
        console.error('Precons upload failed', err);
        statusEl.textContent = 'Upload failed (see console)';
      }
      uploadBtn.disabled = false;
    });

    if (clearCacheBtn) clearCacheBtn.addEventListener('click', async () => {
      if (!confirm('Clear the local precons cache for all users in this browser?')) return;
      try {
        const key = `preconsIndex_v1_${window.__app_id || 'default'}`;
        localStorage.removeItem(key);
        const tsEl = document.getElementById('precons-cache-ts');
        if (tsEl) tsEl.textContent = '';
        statusEl.textContent = 'Cache cleared.';
        showToast('Precons cache cleared in this browser.', 'success');
      } catch (e) {
        console.error('Failed to clear precons cache', e);
        statusEl.textContent = 'Failed to clear cache.';
        showToast('Failed to clear precons cache.', 'error');
      }
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    });

    // Regenerate index: do a safe check for a generated index and provide clear instructions.
    if (regenBtn) regenBtn.addEventListener('click', async () => {
      if (!confirm('Check for or regenerate the precons index. This will not call any server-side scripts from the browser.')) return;
      try {
        // First, check whether the generated index already exists on the webserver
        statusEl.textContent = 'Checking for /precons/index.generated.json...';
        const idxResp = await fetch('/precons/index.generated.json', { method: 'GET' });
        if (idxResp && idxResp.ok) {
          const idx = await idxResp.json();
          statusEl.textContent = `Found index.generated.json (${(idx && idx.length) ? idx.length : 'unknown'} entries).`;
          resultsEl.innerHTML = `<pre style="white-space:pre-wrap">${JSON.stringify(idx, null, 2)}</pre>`;
          return;
        }
        // If there's no generated index, provide an explicit, copy-pasteable instruction for the admin.
        statusEl.textContent = 'No generated index found.';
        resultsEl.innerHTML = `
          <div>
            <div class="mb-2 text-sm text-gray-300">No <code>/precons/index.generated.json</code> was found on the server. Please run the generator locally from the repository root to create it:</div>
            <pre class="text-sm bg-gray-900 p-3 rounded">node scripts\\generate-precons-index.js</pre>
            <div class="mt-2 text-sm text-gray-300">After running, commit or copy <code>Public/precons/index.generated.json</code> to the server and reload this page.</div>
          </div>
        `;
      } catch (e) {
        console.error('Regenerate index check failed', e);
        statusEl.textContent = 'Could not check for generated index. Run the generator locally:';
        resultsEl.innerHTML = `<pre class="text-sm">node scripts\\generate-precons-index.js</pre>`;
      }
    });

  } catch (err) {
    console.error('renderPreconsAdmin failed', err);
  }
}

// Render saved views management UI inside the Settings page
export function renderSettingsSavedViews(containerId = 'settings-saved-views-list') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  // Prefer any up-to-date window-scoped state (Collection may have written to window.savedViews)
  try { if (typeof window !== 'undefined' && Array.isArray(window.savedViews) && window.savedViews.length) { savedViews = window.savedViews; activeViewId = window.activeViewId || activeViewId; } } catch (e) { }

  // If we have no saved views yet but a userId might arrive shortly, wait briefly (poll) for up to 2s
  const ensureLoadedAndRender = async () => {
    if ((!savedViews || savedViews.length === 0) && typeof window !== 'undefined' && !window.userId) {
      // poll for userId for up to 2s
      const start = Date.now();
      while (!window.userId && (Date.now() - start) < 2000) {
        await new Promise(r => setTimeout(r, 150));
      }
    }
    // if userId available, attempt to load saved views from Firestore
    if ((!savedViews || savedViews.length === 0) && typeof loadSavedViewsFromFirestore === 'function' && window.userId) {
      try {
        await loadSavedViewsFromFirestore(window.userId);
      } catch (e) { console.debug('[Settings] renderSettingsSavedViews loadSavedViewsFromFirestore failed', e); }
    }

    // continue rendering below after any attempted load
    doRender();
  };

  const doRender = () => {
    // Add header controls: New View
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-3 gap-3';
    header.innerHTML = `<div class="text-lg font-semibold">Saved Views</div><div class="flex items-center gap-2"><select id="settings-edit-select" class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"><option value="">Edit selected...</option>` + (savedViews || []).map(v => `<option value="${v.id}">${v.name}</option>`).join('') + `</select><button id="new-settings-view-btn" class="bg-green-600 text-white px-3 py-1 rounded text-sm">New View</button></div>`;
    container.appendChild(header);
    // wire header select to open builder for chosen view
    const headerSelect = header.querySelector('#settings-edit-select');
    if (headerSelect) headerSelect.addEventListener('change', (e) => {
      const id = e.target.value;
      if (!id) return;
      const ev = new CustomEvent('settings:editView', { detail: { viewId: id } });
      window.dispatchEvent(ev);
      // reset selection back to placeholder
      headerSelect.value = '';
    });
    const list = document.createElement('div');
    list.className = 'space-y-2';
    (savedViews || []).forEach(v => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-2 bg-gray-800 rounded';
      // left: default radio + name + meta
      const left = document.createElement('div');
      left.className = 'flex items-center gap-3';
      const radioWrap = document.createElement('label');
      radioWrap.className = 'flex items-center gap-2';
      radioWrap.innerHTML = `<input type="radio" name="default-view" class="default-view-radio" data-id="${v.id}" ${v.isDefault ? 'checked' : ''} />`;
      const nameWrap = document.createElement('div');
      nameWrap.className = 'flex items-center gap-2';
      nameWrap.innerHTML = `<div class="view-name text-sm font-medium">${v.name || '(unnamed)'}</div>` + `<div class="text-xs text-gray-400">${(v.viewMode || 'grid').toUpperCase()} ${v.gridSize ? v.gridSize.toUpperCase() : ''}</div>`;
      left.appendChild(radioWrap);
      left.appendChild(nameWrap);

      const right = document.createElement('div');
      right.className = 'flex items-center gap-2';
      right.innerHTML = `<button data-id="${v.id}" class="apply-view-btn bg-indigo-600 text-white text-sm px-2 py-1 rounded">Apply</button>
                       <button data-id="${v.id}" class="edit-view-btn bg-gray-600 text-white text-sm px-2 py-1 rounded">Edit</button>
                       <button data-id="${v.id}" class="rename-view-btn bg-yellow-500 text-white text-sm px-2 py-1 rounded">Rename</button>
                       <button data-id="${v.id}" class="delete-view-btn bg-red-600 text-white text-sm px-2 py-1 rounded">Delete</button>`;

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });
    container.appendChild(list);
    // Keep window in sync after rendering
    try { if (typeof window !== 'undefined') { window.savedViews = savedViews; window.activeViewId = activeViewId; } } catch (e) { }

    // --- Wire UI handlers AFTER DOM is created ---
    // new view button
    const newBtn = document.getElementById('new-settings-view-btn');
    if (newBtn) newBtn.addEventListener('click', () => {
      // Clear builder inputs and open
      window.viewFilterRules = [];
      window.viewSortRules = [];
      try { document.getElementById('view-name-input').value = ''; } catch (e) { }
      try { document.getElementById('view-group-by-1').value = ''; } catch (e) { }
      try { document.getElementById('view-group-by-2').value = ''; } catch (e) { }
      try { document.getElementById('view-hide-in-deck').checked = false; } catch (e) { }
      try { document.getElementById('view-view-mode').value = 'grid'; } catch (e) { }
      try { document.getElementById('view-grid-size').value = 'md'; } catch (e) { }
      window.__editingSavedViewId = null;
      const panel = document.getElementById('view-builder-panel'); if (panel) panel.classList.remove('hidden');
      if (typeof renderViewBuilderLists === 'function') renderViewBuilderLists();
    });

    // apply
    container.querySelectorAll('.apply-view-btn').forEach(btn => btn.addEventListener('click', (e) => {
      const id = btn.dataset.id;
      if (typeof setActiveViewById === 'function') setActiveViewById(id);
    }));
    // delete
    container.querySelectorAll('.delete-view-btn').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      if (confirm('Delete this saved view?')) {
        await deleteViewFromFirestore(window.userId || null, id);
        renderSettingsSavedViews(containerId);
      }
    }));
    // edit (open builder)
    container.querySelectorAll('.edit-view-btn').forEach(btn => btn.addEventListener('click', (e) => {
      const id = btn.dataset.id;
      const ev = new CustomEvent('settings:editView', { detail: { viewId: id } });
      window.dispatchEvent(ev);
    }));
    // rename (inline)
    container.querySelectorAll('.rename-view-btn').forEach(btn => btn.addEventListener('click', (e) => {
      const id = btn.dataset.id;
      const row = btn.closest('div[ class ]');
      if (!row) return;
      const nameEl = row.querySelector('.view-name');
      if (!nameEl) return;
      const current = nameEl.textContent || '';
      // replace with input + save/cancel
      const input = document.createElement('input');
      input.type = 'text'; input.value = current; input.className = 'bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm';
      const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save'; saveBtn.className = 'bg-green-600 text-white px-2 py-1 rounded text-sm';
      const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel'; cancelBtn.className = 'bg-gray-600 text-white px-2 py-1 rounded text-sm';
      nameEl.style.display = 'none';
      nameEl.parentElement.appendChild(input);
      nameEl.parentElement.appendChild(saveBtn);
      nameEl.parentElement.appendChild(cancelBtn);
      input.focus();
      saveBtn.addEventListener('click', async () => {
        const newName = input.value || '(unnamed)';
        const view = (savedViews || []).find(v => v.id === id);
        if (!view) return;
        view.name = newName;
        try {
          await saveViewToFirestore(window.userId || null, view);
          await loadSavedViewsFromFirestore(window.userId || null);
          renderSettingsSavedViews(containerId);
        } catch (err) { console.error('[Settings] rename failed', err); }
      });
      cancelBtn.addEventListener('click', () => {
        input.remove(); saveBtn.remove(); cancelBtn.remove(); nameEl.style.display = '';
      });
    }));
    // default radio toggle
    container.querySelectorAll('.default-view-radio').forEach(r => r.addEventListener('change', async (e) => {
      const id = r.dataset.id;
      if (!id) return;
      (savedViews || []).forEach(v => { v.isDefault = (v.id === id); });
      try {
        // persist aggregate
        await persistSavedViewsToFirestore(window.userId || null);
        // set active view
        await setActiveViewById(id);
        renderSettingsSavedViews(containerId);
      } catch (err) { console.error('[Settings] set default failed', err); }
    }));
  };

  // kick off the ensure+render flow
  ensureLoadedAndRender().catch(err => { console.debug('[Settings] renderSettingsSavedViews ensureLoadedAndRender failed', err); doRender(); });
  // new view button
  const newBtn = document.getElementById('new-settings-view-btn');
  if (newBtn) newBtn.addEventListener('click', () => {
    // Clear builder inputs and open
    window.viewFilterRules = [];
    window.viewSortRules = [];
    try { document.getElementById('view-name-input').value = ''; } catch (e) { }
    try { document.getElementById('view-group-by-1').value = ''; } catch (e) { }
    try { document.getElementById('view-group-by-2').value = ''; } catch (e) { }
    try { document.getElementById('view-hide-in-deck').checked = false; } catch (e) { }
    try { document.getElementById('view-view-mode').value = 'grid'; } catch (e) { }
    try { document.getElementById('view-grid-size').value = 'md'; } catch (e) { }
    window.__editingSavedViewId = null;
    const panel = document.getElementById('view-builder-panel'); if (panel) panel.classList.remove('hidden');
    if (typeof renderViewBuilderLists === 'function') renderViewBuilderLists();
  });
  // wire buttons
  container.querySelectorAll('.apply-view-btn').forEach(btn => btn.addEventListener('click', (e) => {
    const id = btn.dataset.id;
    if (typeof setActiveViewById === 'function') setActiveViewById(id);
  }));
  // delete
  container.querySelectorAll('.delete-view-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = btn.dataset.id;
    if (confirm('Delete this saved view?')) {
      await deleteViewFromFirestore(window.userId || null, id);
      renderSettingsSavedViews(containerId);
    }
  }));
  // edit (open builder)
  container.querySelectorAll('.edit-view-btn').forEach(btn => btn.addEventListener('click', (e) => {
    const id = btn.dataset.id;
    const ev = new CustomEvent('settings:editView', { detail: { viewId: id } });
    window.dispatchEvent(ev);
  }));
  // rename (inline)
  container.querySelectorAll('.rename-view-btn').forEach(btn => btn.addEventListener('click', (e) => {
    const id = btn.dataset.id;
    const row = btn.closest('div[ class ]');
    if (!row) return;
    const nameEl = row.querySelector('.view-name');
    if (!nameEl) return;
    const current = nameEl.textContent || '';
    // replace with input + save/cancel
    const input = document.createElement('input');
    input.type = 'text'; input.value = current; input.className = 'bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm';
    const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save'; saveBtn.className = 'bg-green-600 text-white px-2 py-1 rounded text-sm';
    const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel'; cancelBtn.className = 'bg-gray-600 text-white px-2 py-1 rounded text-sm';
    nameEl.style.display = 'none';
    nameEl.parentElement.appendChild(input);
    nameEl.parentElement.appendChild(saveBtn);
    nameEl.parentElement.appendChild(cancelBtn);
    input.focus();
    saveBtn.addEventListener('click', async () => {
      const newName = input.value || '(unnamed)';
      const view = (savedViews || []).find(v => v.id === id);
      if (!view) return;
      view.name = newName;
      try {
        await saveViewToFirestore(window.userId || null, view);
        await loadSavedViewsFromFirestore(window.userId || null);
        renderSettingsSavedViews(containerId);
      } catch (err) { console.error('[Settings] rename failed', err); }
    });
    cancelBtn.addEventListener('click', () => {
      input.remove(); saveBtn.remove(); cancelBtn.remove(); nameEl.style.display = '';
    });
  }));
  // default radio toggle
  container.querySelectorAll('.default-view-radio').forEach(r => r.addEventListener('change', async (e) => {
    const id = r.dataset.id;
    if (!id) return;
    (savedViews || []).forEach(v => { v.isDefault = (v.id === id); });
    try {
      // persist aggregate
      await persistSavedViewsToFirestore(window.userId || null);
      // set active view
      await setActiveViewById(id);
      renderSettingsSavedViews(containerId);
    } catch (err) { console.error('[Settings] set default failed', err); }
  }));
}

// Playstyle rendering is handled by the header floating panel (boot.js) so we no longer render it from Settings.

// Handler: when settings wants to edit a view, populate the builder and open it
window.addEventListener('settings:editView', async (e) => {
  try {
    const viewId = e?.detail?.viewId;
    if (!viewId) return;
    // ensure savedViews loaded
    if ((!savedViews || !savedViews.length) && typeof loadSavedViewsFromFirestore === 'function' && window.userId) await loadSavedViewsFromFirestore(window.userId);
    const view = (savedViews || []).find(v => v.id === viewId);
    if (!view) return;
    window.viewFilterRules = JSON.parse(JSON.stringify(view.filters || []));
    window.viewSortRules = JSON.parse(JSON.stringify(view.sorts || []));
    try { document.getElementById('view-name-input').value = view.name || ''; } catch (e) { }
    try { document.getElementById('view-group-by-1').value = (view.groupBy && view.groupBy[0]) || ''; } catch (e) { }
    try { document.getElementById('view-group-by-2').value = (view.groupBy && view.groupBy[1]) || ''; } catch (e) { }
    try { document.getElementById('view-hide-in-deck').checked = !!view.hideInDecks; } catch (e) { }
    try { document.getElementById('view-view-mode').value = view.viewMode || 'grid'; } catch (e) { }
    try { document.getElementById('view-grid-size').value = view.gridSize || 'md'; } catch (e) { }
    try { document.getElementById('view-default-checkbox').checked = !!view.isDefault; } catch (e) { }
    window.__editingSavedViewId = view.id;
    const panel = document.getElementById('view-builder-panel'); if (panel) panel.classList.remove('hidden');
    if (typeof renderViewBuilderLists === 'function') renderViewBuilderLists();
  } catch (err) { console.debug('[Settings] settings:editView handler failed', err); }
});

// Auto-initialize when module is loaded so legacy inline code can call functions
try { initSettingsModule(); } catch (e) { console.debug('[Settings] auto-init failed', e); }

// Wire builder Save/Cancel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-view-confirm-btn');
  const cancelBtn = document.getElementById('cancel-view-builder-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const name = document.getElementById('view-name-input')?.value || 'Untitled View';
      const groupBy1 = document.getElementById('view-group-by-1')?.value || '';
      const groupBy2 = document.getElementById('view-group-by-2')?.value || '';
      const groupBy = [groupBy1, groupBy2].filter(Boolean);
      const hideInDecks = !!document.getElementById('view-hide-in-deck')?.checked;
      const viewMode = document.getElementById('view-view-mode')?.value || 'grid';
      const gridSize = document.getElementById('view-grid-size')?.value || 'md';
      const isDefault = !!document.getElementById('view-default-checkbox')?.checked;
      const editingId = window.__editingSavedViewId || null;
      const view = {
        id: editingId || `view_${Date.now()}`,
        name,
        filters: window.viewFilterRules || [],
        sorts: window.viewSortRules || [],
        groupBy,
        hideInDecks,
        viewMode,
        gridSize,
        isDefault
      };
      try {
        const uid = window.userId || null;
        const saved = await saveViewToFirestore(uid, view);
        // reload views and UI
        await loadSavedViewsFromFirestore(uid);
        if (typeof renderSettingsSavedViews === 'function') renderSettingsSavedViews();
        if (typeof renderSavedViewsSelect === 'function') renderSavedViewsSelect(savedViews);
        if (saved && saved.isDefault) await setActiveViewById(saved.id);
      } catch (err) {
        console.error('[Settings] builder save failed', err);
      }
      window.__editingSavedViewId = null;
      const panel = document.getElementById('view-builder-panel'); if (panel) panel.classList.add('hidden');
    });
  }
  if (cancelBtn) cancelBtn.addEventListener('click', () => { const panel = document.getElementById('view-builder-panel'); if (panel) panel.classList.add('hidden'); window.__editingSavedViewId = null; });
  // Add filter rule button
  const addFilterBtn = document.getElementById('add-filter-rule-btn');
  if (addFilterBtn) {
    addFilterBtn.addEventListener('click', () => {
      const col = document.getElementById('filter-column-select')?.value || 'name';
      const op = document.getElementById('filter-op-select')?.value || 'contains';
      const valEl = document.getElementById('filter-value-input');
      const val = valEl ? (valEl.value || '') : '';
      window.viewFilterRules = window.viewFilterRules || [];
      window.viewFilterRules.push({ column: col, operator: op, value: val });
      if (typeof renderViewBuilderLists === 'function') renderViewBuilderLists();
      if (valEl) valEl.value = '';
    });
  }
  // Add sort rule button
  const addSortBtn = document.getElementById('add-sort-rule-btn');
  if (addSortBtn) {
    addSortBtn.addEventListener('click', () => {
      const col = document.getElementById('sort-column-select')?.value || 'name';
      const dir = document.getElementById('sort-dir-select')?.value || 'asc';
      window.viewSortRules = window.viewSortRules || [];
      window.viewSortRules.push({ column: col, direction: dir });
      if (typeof renderViewBuilderLists === 'function') renderViewBuilderLists();
    });
  }
});

export function renderSettingsDeckList() {
  const container = document.getElementById('settings-deck-list');
  if (!container) return;

  const decks = window.localDecks || {};
  const deckIds = Object.keys(decks);

  if (deckIds.length === 0) {
    container.innerHTML = '<p class="text-gray-500 italic">No decks found.</p>';
    return;
  }

  let html = '';
  deckIds.forEach(id => {
    const deck = decks[id];
    if (!deck) return;
    html += `
      <div class="flex items-center justify-between bg-gray-700 p-3 rounded-lg border border-gray-600">
        <div>
          <h4 class="font-bold text-white">${deck.name || 'Unnamed Deck'}</h4>
          <p class="text-xs text-gray-400">${deck.format || 'Commander'} • ${Object.keys(deck.cards || {}).length} cards</p>
        </div>
        <button 
          class="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-2 rounded transition-colors"
          onclick="window.openDeckDeleteOptions('${id}')"
          title="Delete Deck"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function renderBasicLandsSection() {
  const container = document.getElementById('basic-lands-container');
  if (!container) return;

  const manaColors = {
    W: { name: 'Plains', symbol: 'https://svgs.scryfall.io/card-symbols/W.svg', color: 'bg-yellow-100' },
    U: { name: 'Island', symbol: 'https://svgs.scryfall.io/card-symbols/U.svg', color: 'bg-blue-400' },
    B: { name: 'Swamp', symbol: 'https://svgs.scryfall.io/card-symbols/B.svg', color: 'bg-gray-900' },
    R: { name: 'Mountain', symbol: 'https://svgs.scryfall.io/card-symbols/R.svg', color: 'bg-red-500' },
    G: { name: 'Forest', symbol: 'https://svgs.scryfall.io/card-symbols/G.svg', color: 'bg-green-500' }
  };

  // Get decks and calculate usage statistics
  const decks = window.localDecks || {};
  const usage = calculateBasicLandsInUse(decks);

  let html = '<div class="space-y-4">';

  // Input fields
  html += '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">';

  // Use window.basicLands if available (for debugging/state sync), fallback to module basicLands
  const currentBasicLands = (typeof window !== 'undefined' && window.basicLands) ? window.basicLands : basicLands;
  console.log('[BasicLands] Rendering with data:', currentBasicLands);

  Object.keys(manaColors).forEach(colorCode => {
    const color = manaColors[colorCode];
    const count = currentBasicLands[colorCode] || 0;
    html += `
      <div class="flex flex-col items-center p-3 bg-gray-700 rounded-lg border border-gray-600">
        <img src="${color.symbol}" class="w-8 h-8 mb-2" alt="${color.name}">
        <span class="text-sm text-gray-300 mb-2">${color.name}</span>
        <input 
          type="number" 
          id="basic-land-${colorCode}"
          class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-center text-white"
          value="${count}"
          min="0"
          placeholder="0"
        >
      </div>
    `;
  });
  html += '</div>';

  // Save button
  html += `
    <button 
      id="save-basic-lands-btn"
      class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors w-full md:w-auto"
    >
      Save Basic Lands
    </button>
  `;

  // Checkbox to toggle nav banner
  const showInNav = currentBasicLands.showLandShortagesInNav !== false; // default true
  html += `
    <div class="mt-3">
      <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input 
          type="checkbox" 
          id="show-land-shortages-in-nav"
          class="h-4 w-4 rounded"
          ${showInNav ? 'checked' : ''}
        >
        <span>Show reminder in navigation when I need more basic lands</span>
      </label>
    </div>
  `;

  html += '<div id="basic-lands-usage-stats" class="mt-6">';

  if (Object.keys(decks).length > 0) {
    html += '<h4 class="text-md font-semibold text-white mb-3">Usage Across Decks</h4>';
    html += '<div class="grid grid-cols-2 md:grid-cols-5 gap-3">';

    Object.keys(manaColors).forEach(colorCode => {
      const color = manaColors[colorCode];
      const owned = currentBasicLands[colorCode] || 0;
      const needed = usage[colorCode] || 0;
      const shortage = Math.max(0, needed - owned);

      const statusClass = shortage > 0 ? 'border-red-500 bg-red-900/20' : 'border-green-500/30 bg-gray-700';
      const textClass = shortage > 0 ? 'text-red-300' : 'text-gray-300';

      html += `
        <div class="flex flex-col items-center p-3 ${statusClass} rounded-lg border">
          <img src="${color.symbol}" class="w-6 h-6 mb-1" alt="${color.name}">
          <div class="text-xs ${textClass} text-center">
            <div class="font-bold">${owned} owned</div>
            <div>${needed} needed</div>
            ${shortage > 0 ? `<div class="text-red-400 font-semibold mt-1">⚠️ Need ${shortage}</div>` : '<div class="text-green-400 mt-1">✓</div>'}
          </div>
        </div>
      `;
    });

    html += '</div>';

    // Show per-deck breakdown
    if (usage.byDeck && Object.keys(usage.byDeck).length > 0) {
      html += '<details class="mt-4">';
      html += '<summary class="cursor-pointer text-sm text-gray-400 hover:text-gray-300">Show breakdown by deck</summary>';
      html += '<div class="mt-2 space-y-2 text-xs text-gray-400">';

      Object.keys(usage.byDeck).forEach(deckId => {
        const deckInfo = usage.byDeck[deckId];
        const deckNeeds = deckInfo.needs;
        const nonZeroColors = Object.keys(deckNeeds).filter(c => deckNeeds[c] > 0);

        if (nonZeroColors.length > 0) {
          html += `<div class="pl-3 border-l-2 border-gray-700">`;
          html += `<div class="font-semibold text-gray-300">${deckInfo.name}</div>`;
          html += `<div class="flex gap-2 mt-1">`;
          nonZeroColors.forEach(color => {
            html += `<span><img src="${manaColors[color].symbol}" class="w-4 h-4 inline" alt="${color}"> ${deckNeeds[color]}</span>`;
          });
          html += `</div></div>`;
        }
      });

      html += '</div></details>';
    }
  } else {
    html += '<p class="text-sm text-gray-400 italic">Create some decks to see usage statistics.</p>';
  }

  html += '</div>';

  html += '</div>';
  container.innerHTML = html;

  // Wire up save button
  const saveBtn = document.getElementById('save-basic-lands-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const userId = window.userId;
      if (!userId) {
        showToast('Please log in to save basic lands', 'error');
        return;
      }

      // Collect values from inputs
      Object.keys(manaColors).forEach(colorCode => {
        const input = document.getElementById(`basic-land-${colorCode}`);
        if (input) {
          basicLands[colorCode] = parseInt(input.value) || 0;
        }
      });

      // Collect checkbox state
      const navCheckbox = document.getElementById('show-land-shortages-in-nav');
      if (navCheckbox) {
        basicLands.showLandShortagesInNav = navCheckbox.checked;
      }

      console.log('[BasicLands] Saving:', basicLands);

      // Update window reference
      if (typeof window !== 'undefined') {
        window.basicLands = basicLands;
      }

      // Save to Firestore
      const success = await persistSettingsForUser(userId);
      if (success) {
        showToast('Basic lands saved successfully', 'success');
        // Re-render to update usage statistics
        renderBasicLandsSection();
        // Update nav banner visibility
        if (typeof window.updateLandShortagesBanner === 'function') {
          window.updateLandShortagesBanner();
        }
      } else {
        showToast('Failed to save basic lands', 'error');
      }
    });
  }

  // Wire up checkbox for immediate feedback (without saving)
  setTimeout(() => {
    const navCheckbox = document.getElementById('show-land-shortages-in-nav');
    if (navCheckbox) {
      navCheckbox.addEventListener('change', (e) => {
        basicLands.showLandShortagesInNav = e.target.checked;
        if (typeof window !== 'undefined') {
          window.basicLands = basicLands;
        }
        // Update banner immediately
        if (typeof window.updateLandShortagesBanner === 'function') {
          window.updateLandShortagesBanner();
        }
      });
    }
  }, 100);
}

/**
 * Scans the user's collection for duplicate cards (same Scryfall ID + Finish)
 * and merges them into a single entry. Updates all decks to point to the merged entry.
 */
export async function cleanupCollectionDuplicates() {
  const userId = window.userId;
  if (!userId) {
    showToast('You must be signed in to cleanup collection.', 'error');
    return;
  }

  if (!confirm('This will merge all duplicate cards in your collection into single entries. This cannot be undone. Are you sure?')) return;

  showToast('Starting collection cleanup... This may take a moment.', 'info');

  try {
    const col = window.localCollection || {};
    const decks = window.localDecks || {};

    // Group by ID + Finish
    const groups = {};
    Object.values(col).forEach(card => {
      // Use oracle_id if available for grouping? No, strictly Scryfall ID + Finish
      // because different printings (different Scryfall IDs) are effectively different cards in collection.
      const key = `${card.id}_${card.finish || 'nonfoil'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    });

    const batch = writeBatch(db);
    let operationCount = 0;
    let mergedCount = 0;
    let groupsProcessed = 0;

    // Process groups
    for (const key in groups) {
      const cards = groups[key];
      if (cards.length > 1) {
        // Pick master (first one)
        const master = cards[0];
        const victims = cards.slice(1);

        let totalCount = master.count || 1;

        victims.forEach(victim => {
          totalCount += (victim.count || 1);

          // Delete victim doc
          const victimRef = doc(db, `artifacts/${appId}/users/${userId}/collection`, victim.firestoreId);
          batch.delete(victimRef);
          operationCount++;

          // Update decks referencing victim
          Object.values(decks).forEach(deck => {
            let deckUpdated = false;
            const deckUpdates = {};

            // Check cards map
            if (deck.cards && deck.cards[victim.firestoreId]) {
              const victimInDeck = deck.cards[victim.firestoreId];

              // Remove victim ref
              deckUpdates[`cards.${victim.firestoreId}`] = deleteField();

              // Add/Update master ref
              const existingMasterInDeck = deck.cards[master.firestoreId];
              if (existingMasterInDeck) {
                // Master already in deck, add victim's count to it
                // Note: We can't read-modify-write easily in batch without knowing current value.
                // But we have localDecks! So we know the current value.
                const newDeckCount = (existingMasterInDeck.count || 1) + (victimInDeck.count || 1);
                deckUpdates[`cards.${master.firestoreId}`] = { count: newDeckCount };
              } else {
                // Master not in deck, add it
                deckUpdates[`cards.${master.firestoreId}`] = { count: victimInDeck.count || 1 };
              }
              deckUpdated = true;
            }

            // Commander check
            if (deck.commander && deck.commander.firestoreId === victim.firestoreId) {
              deckUpdates[`commander.firestoreId`] = master.firestoreId;
              deckUpdated = true;
            }

            if (deckUpdated) {
              const deckRef = doc(db, `artifacts/${appId}/users/${userId}/decks`, deck.id);
              batch.update(deckRef, deckUpdates);
              operationCount++;
            }
          });
        });

        // Update master doc count
        const masterRef = doc(db, `artifacts/${appId}/users/${userId}/collection`, master.firestoreId);
        batch.update(masterRef, { count: totalCount });
        operationCount++;
        mergedCount += victims.length;
        groupsProcessed++;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
      showToast(`Cleanup complete. Merged ${mergedCount} duplicate entries across ${groupsProcessed} groups.`, 'success');
      console.log(`[Cleanup] Merged ${mergedCount} duplicates. Operations: ${operationCount}`);

      // Force reload to ensure local state is perfectly synced
      setTimeout(() => window.location.reload(), 2000);
    } else {
      showToast('No duplicates found in collection.', 'success');
    }

  } catch (e) {
    console.error('Cleanup failed', e);
    showToast('Cleanup failed: ' + e.message, 'error');
  }
}

if (typeof window !== 'undefined') {
  window.cleanupCollectionDuplicates = cleanupCollectionDuplicates;
}
