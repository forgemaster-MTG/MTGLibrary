import { showToast } from '../lib/ui.js';

// Simple precons index viewer. Expects a JSON index at /precons/index.json with entries:
// [{ "name": "Commander 2019 - Sample", "file": "/precons/Commander2019.json", "cover": "/precons/covers/cmd19.jpg" }, ...]

let currentGridSize = 'md';
const sizeClassMap = {
  sm: 'grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11',
  md: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9',
  lg: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
};

export async function initPreconsModule() {
  try {
    if (typeof window.showView === 'function') window.showView('precons');
  } catch (e) {}

  const container = document.getElementById('precons-content');
  const filterInput = document.getElementById('precons-filter-text');
  const searchInput = document.getElementById('precons-search-input');
  const refreshBtn = document.getElementById('refresh-precons-btn');
  // cache timestamp display (will be injected next to the Refresh button)
  let cacheTsEl = document.getElementById('precons-cache-ts');
  if (!cacheTsEl && refreshBtn && refreshBtn.parentElement) {
    cacheTsEl = document.createElement('div');
    cacheTsEl.id = 'precons-cache-ts';
    cacheTsEl.className = 'text-xs text-gray-400 ml-3';
    refreshBtn.parentElement.appendChild(cacheTsEl);
  }
  const noMsg = document.getElementById('no-precons-msg');

  if (!container) return;

  // wire controls
  document.querySelectorAll('.precons-grid-size-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.precons-grid-size-btn').forEach(x => x.classList.remove('bg-indigo-600','text-white'));
      b.classList.add('bg-indigo-600','text-white');
      currentGridSize = b.dataset.size || 'md';
      applyGridSize(container, currentGridSize);
    });
  });

  document.querySelectorAll('#precons-view .view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'precons-view-toggle-grid') {
        // no-op: grid is default
      } else {
        // table view not implemented yet; just show toast
        showToast('Table view for Precons not implemented yet.', 'info');
      }
    });
  });

  if (refreshBtn) refreshBtn.addEventListener('click', () => { render(); });

  const doFilter = () => {
    const q = (filterInput?.value || '').trim().toLowerCase();
    const s = (searchInput?.value || '').trim().toLowerCase();
    Array.from(container.children || []).forEach(card => {
      const name = (card.dataset && card.dataset.name || '').toLowerCase();
      const fname = (card.dataset && card.dataset.file || '').toLowerCase();
      const show = (!q || name.includes(q) || fname.includes(q)) && (!s || name.includes(s) || fname.includes(s));
      card.style.display = show ? '' : 'none';
    });
    // update empty state
    const anyVisible = Array.from(container.children || []).some(c => c.style.display !== 'none');
    if (!anyVisible) noMsg && noMsg.classList.remove('hidden'); else noMsg && noMsg.classList.add('hidden');
  };

  filterInput && filterInput.addEventListener('input', () => doFilter());
  searchInput && searchInput.addEventListener('input', () => doFilter());

  // initial apply grid
  applyGridSize(container, currentGridSize);

  // Try to render immediately from cache, then fetch fresh in background
  const cached = loadCachedIndex();
  if (cached && Array.isArray(cached.idx) && cached.idx.length > 0) {
    // render cached immediately
    await renderFromIndex(cached.idx);
    // background refresh
    refreshAndUpdate();
  } else {
    await refreshAndUpdate();
  }

  // Feature flag / config: window.PRECONS_CONFIG
  const PRECONS_CONFIG = (typeof window !== 'undefined' && window.PRECONS_CONFIG) ? window.PRECONS_CONFIG : { mode: 'auto', mtgjsonUrl: null };

  async function render() {
    container.innerHTML = '';
    noMsg && noMsg.classList.add('hidden');
    try {
      // render() kept for backward-compat, but we prefer renderFromIndex(idx)
      // If called directly, attempt to fetch the static index as before
      let res = await fetch('/precons/index.generated.json');
      if (!res.ok) {
        try { res = await fetch('/precons/index.json'); } catch (e) { /* ignore */ }
      }
      if (!res || !res.ok) {
        noMsg && noMsg.classList.remove('hidden');
        console.warn('Precons index not found. To generate one, run: node scripts\\generate-precons-index.js');
        return;
      }
      const idx = await res.json();
      if (!Array.isArray(idx) || idx.length === 0) {
        noMsg && noMsg.classList.remove('hidden');
        console.warn('Precons index JSON did not contain an array. If you placed a single deck as index.json, run the generator to create index.generated.json.');
        return;
      }

      const html = idx.map(item => {
        const name = item.name || item.title || 'Unnamed Precon';
        const cover = item.cover || item.coverImage || item.image || '';
        const file = item.file || item.path || '';
        const img = cover ? `<img src="${cover}" class="rounded-lg w-full h-full object-cover" loading="lazy"/>` : `<div class="w-full h-full bg-gray-800 flex items-center justify-center text-sm text-gray-400">No cover</div>`;
        return `
          <div class="cursor-pointer rounded-lg overflow-hidden shadow-md bg-gray-800 p-2 precon-item" data-file="${file}" data-name="${name}" style="aspect-ratio:2/3;position:relative">
            <div class="h-[72%] w-full rounded-md overflow-hidden">${img}</div>
            <div class="mt-2">
              <div class="text-sm font-semibold truncate">${name}</div>
              <div class="text-xs text-gray-400 truncate">${file}</div>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = html;

      container.querySelectorAll('.precon-item').forEach(el => {
        el.addEventListener('click', async (e) => {
          const file = el.dataset.file;
          const name = el.dataset.name;
          if (!file) {
            showToast('This precon has no file path. Add a "file" property in /precons/index.json.', 'warning');
            return;
          }
          try {
            const mod = await import('./preconView.js');
            if (mod && typeof mod.initPreconView === 'function') {
              mod.initPreconView(file, name);
            }
          } catch (err) {
            console.error('Failed to load precon view module', err);
            showToast('Failed to open precon view.', 'error');
          }
        });
      });

      // run filter once
      doFilter();
    } catch (err) {
      console.error('Failed to load precons index', err);
      noMsg && noMsg.classList.remove('hidden');
    }
  }

  // -- new helpers: cache, renderFromIndex, refresh flow --
  const CACHE_KEY = `preconsIndex_v1_${window.__app_id || 'default'}`;

  function loadCachedIndex() {
    try {
      const txt = localStorage.getItem(CACHE_KEY);
      if (!txt) return null;
      return JSON.parse(txt);
    } catch (e) { return null; }
  }

  function saveCachedIndex(idx) {
    try {
      const payload = { idx, fetchedAt: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      // update cache timestamp UI
      try { updateCacheTimestamp(payload.fetchedAt); } catch (e) { }
    } catch (e) { console.warn('Failed to save precons cache', e); }
  }

  async function renderFromIndex(idx) {
    try {
      container.innerHTML = '';
      noMsg && noMsg.classList.add('hidden');
      const html = idx.map(item => {
        const name = item.name || item.title || 'Unnamed Precon';
        const cover = item.cover || item.coverImage || item.image || '';
        const file = item.file || item.path || '';
        const img = cover ? `<img src="${cover}" class="rounded-lg w-full h-full object-cover" loading="lazy"/>` : `<div class="w-full h-full bg-gray-800 flex items-center justify-center text-sm text-gray-400">No cover</div>`;
        return `
          <div class="cursor-pointer rounded-lg overflow-hidden shadow-md bg-gray-800 p-2 precon-item" data-file="${file}" data-name="${name}" style="aspect-ratio:2/3;position:relative">
            <div class="h-[72%] w-full rounded-md overflow-hidden">${img}</div>
            <div class="mt-2">
              <div class="text-sm font-semibold truncate">${name}</div>
              <div class="text-xs text-gray-400 truncate">${file}</div>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = html;

      container.querySelectorAll('.precon-item').forEach(el => {
        el.addEventListener('click', async (e) => {
          const file = el.dataset.file;
          const name = el.dataset.name;
          if (!file) {
            showToast('This precon has no file path. Add a "file" property in /precons/index.json.', 'warning');
            return;
          }
          try {
            const mod = await import('./preconView.js');
            if (mod && typeof mod.initPreconView === 'function') {
              mod.initPreconView(file, name);
            }
          } catch (err) {
            console.error('Failed to load precon view module', err);
            showToast('Failed to open precon view.', 'error');
          }
        });
      });

      // run filter once
      doFilter();
      // update cache timestamp from stored cache, if present
      try {
        const c = loadCachedIndex();
        if (c && c.fetchedAt) updateCacheTimestamp(c.fetchedAt);
      } catch (e) { }
    } catch (e) {
      console.error('renderFromIndex error', e);
    }
  }

  async function refreshAndUpdate() {
    // Determine fetch order according to PRECONS_CONFIG.mode
    const mode = PRECONS_CONFIG.mode || 'auto';
    let order = [];
    switch (mode) {
      case 'static': order = ['static']; break;
      case 'firestore': order = ['firestore', 'static']; break;
      case 'mtgjson': order = ['mtgjson', 'static']; break;
      case 'auto':
      default:
        order = ['firestore'];
        if (PRECONS_CONFIG.mtgjsonUrl) order.push('mtgjson');
        order.push('static');
    }

    let idx = null;

    async function fetchFromFirestore() {
      try {
        const firebaseModule = await import('../firebase/init.js');
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const db = firebaseModule.db;
        if (!db) return null;
        try {
          const snap = await getDocs(collection(db, 'precons'));
          if (snap && snap.docs && snap.docs.length > 0) {
            return snap.docs.map(d => {
              const data = d.data();
              return { name: data.name || data.title || d.id, file: data.file || ``, cover: data.cover || '', content: data.content || null };
            });
          }
        } catch (e) { console.warn('[Precons] Firestore fetch failed', e); }
      } catch (e) {
        // firebase not available
      }
      return null;
    }

    async function fetchFromMtGJson(url) {
      if (!url) return null;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const body = await res.json();
        let arr = null;
        if (Array.isArray(body)) arr = body;
        else if (body && Array.isArray(body.decks)) arr = body.decks;
        else if (body && Array.isArray(body.items)) arr = body.items;
        else if (body && body.data && Array.isArray(body.data.decks)) arr = body.data.decks;
        if (!arr || !arr.length) return null;
        // map to index shape
        return arr.map(it => {
          const name = it.name || it.title || it.deckName || '';
          const cover = it.cover || it.image || (it.commander && it.commander.image_uris && it.commander.image_uris.normal) || '';
          const file = it.file || it.path || '';
          const content = it.content || it.cards || it.data || null;
          return { name, cover, file, content };
        });
      } catch (e) { console.warn('[Precons] MTGJSON fetch failed', e); return null; }
    }

    async function fetchFromStatic() {
      try {
        let res = await fetch('/precons/index.generated.json');
        if (!res.ok) {
          try { res = await fetch('/precons/index.json'); } catch (e) { return null; }
        }
        if (res && res.ok) {
          const sidx = await res.json();
          if (Array.isArray(sidx) && sidx.length > 0) return sidx;
        }
      } catch (e) { console.warn('[Precons] static fetch failed', e); }
      return null;
    }

    // Execute fetches in configured order
    for (const step of order) {
      try {
        if (step === 'firestore') {
          idx = await fetchFromFirestore();
        } else if (step === 'mtgjson') {
          idx = await fetchFromMtGJson(PRECONS_CONFIG.mtgjsonUrl);
        } else if (step === 'static') {
          idx = await fetchFromStatic();
        }
        if (idx && Array.isArray(idx) && idx.length > 0) {
          console.log('[Precons] Loaded index from', step, 'count=', idx.length);
          break;
        }
      } catch (e) { console.warn('[Precons] step', step, 'failed', e); }
    }

    if (idx && Array.isArray(idx) && idx.length > 0) {
      // Save to cache and render if different than currently displayed
      try {
        saveCachedIndex(idx);
      } catch (e) { /* ignore */ }
      await renderFromIndex(idx);
      try { const c = loadCachedIndex(); if (c && c.fetchedAt) updateCacheTimestamp(c.fetchedAt); } catch (e) {}
    } else {
      // nothing found; show message via existing render path
      await render();
    }
  }

  function updateCacheTimestamp(ms) {
    try {
      if (!cacheTsEl) return;
      const d = new Date(ms || 0);
      if (!ms || isNaN(d.getTime())) { cacheTsEl.textContent = ''; return; }
      // show a human-friendly timestamp and title
      cacheTsEl.textContent = `(cached ${d.toLocaleString()})`;
      cacheTsEl.title = `Cached at ${d.toString()}`;
    } catch (e) { console.debug('updateCacheTimestamp failed', e); }
  }
}

function applyGridSize(container, size) {
  try {
    const cls = sizeClassMap[size] || sizeClassMap.md;
    // remove existing grid-cols-* classes crudely by resetting the class to base grid + cls
    // keep padding classes
    const base = 'grid gap-4 p-2';
    container.className = base + ' ' + cls;
  } catch (e) { console.debug('applyGridSize error', e); }
}
