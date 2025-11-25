// Public/js/pages/sets.js
// Module to fetch Scryfall sets and render a browsable UI with filter / sort / display controls.

let setsData = [];
let currentView = 'grid'; // 'grid' or 'table'
let currentSize = 'md';
let showOwnedOnly = false; // New filter state
let setStatistics = {}; // Cache for set ownership stats: { setCode: { owned: 0, total: 0, percent: 0 } }

import './set_details.js'; // Ensure Set Details view is loaded
import { localCollection } from '../lib/data.js'; // Import collection for stats

async function fetchSets() {
  try {
    const res = await fetch('https://api.scryfall.com/sets');
    const json = await res.json();
    setsData = Array.isArray(json.data) ? json.data : (json || []);
    calculateSetStatistics(); // Calculate stats after fetching
  } catch (err) {
    console.error('Failed to fetch sets', err);
    setsData = [];
  }
}

function calculateSetStatistics() {
  setStatistics = {};

  // 1. Initialize stats for all sets
  setsData.forEach(s => {
    setStatistics[s.code] = { owned: 0, total: s.card_count || 0, percent: 0 };
  });

  // 2. Iterate collection to count owned cards per set
  Object.values(localCollection).forEach(card => {
    if (card.set && setStatistics[card.set]) {
      if (!setStatistics[card.set]._seen) setStatistics[card.set]._seen = new Set();
      if (!setStatistics[card.set]._seen.has(card.collector_number)) {
        setStatistics[card.set]._seen.add(card.collector_number);
        setStatistics[card.set].owned++;
      }
    }
  });

  // 3. Calculate percentages
  Object.keys(setStatistics).forEach(code => {
    const stats = setStatistics[code];
    if (stats.total > 0) {
      stats.percent = Math.min(100, Math.round((stats.owned / stats.total) * 100));
    }
    delete stats._seen;
  });
}

function chooseIcon(setObj) {
  return setObj.icon_svg_uri || setObj.icon_svg || setObj.icon_uri || '';
}

function formatDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString(); } catch (e) { return d; }
}

function applyGridSize(el, size) {
  if (!el) return;
  let min = '150px';
  if (size === 'sm') min = '110px';
  if (size === 'lg') min = '220px';
  el.style.gridTemplateColumns = `repeat(auto-fill, minmax(${min}, 1fr))`;
}

function renderGrid(container, items) {
  try { container.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4'; } catch (e) { }
  container.innerHTML = '';

  if (!items.length) {
    const noMsg = document.getElementById('no-sets-msg');
    if (noMsg) noMsg.classList.remove('hidden');
    return;
  }
  const noMsg = document.getElementById('no-sets-msg');
  if (noMsg) noMsg.classList.add('hidden');

  const frag = document.createDocumentFragment();
  for (const s of items) {
    const stats = setStatistics[s.code] || { owned: 0, total: s.card_count || 0, percent: 0 };

    const card = document.createElement('div');
    card.className = 'bg-gray-800 rounded-lg p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-700 relative overflow-hidden group border border-gray-700 shadow-sm transition-all duration-200 hover:shadow-indigo-500/20 hover:scale-[1.02]';
    card.setAttribute('data-set-code', s.code);

    // Background Progress Bar
    const pct = stats.percent;
    if (pct > 0) {
      card.style.background = `linear-gradient(to top, rgba(79, 70, 229, 0.25) ${pct}%, rgba(31, 41, 55, 1) ${pct}%)`;
      if (pct >= 100) card.classList.add('border-green-500/50');
    }

    const imgWrap = document.createElement('div');
    imgWrap.className = 'w-full flex items-center justify-center z-10';
    const img = document.createElement('img');
    img.alt = s.name;
    img.src = chooseIcon(s) || '';
    img.className = 'max-h-16 object-contain filter drop-shadow-lg';
    img.onerror = () => { img.style.display = 'none'; };
    imgWrap.appendChild(img);

    const name = document.createElement('div');
    name.className = 'text-sm font-bold text-center text-gray-100 z-10 leading-tight mt-1';
    name.textContent = s.name;

    const meta = document.createElement('div');
    meta.className = 'text-xs text-gray-400 text-center z-10 flex flex-col gap-0.5 mt-1';

    const collectedText = `<span class="${stats.owned > 0 ? 'text-indigo-300' : 'text-gray-500'}">${stats.owned}/${stats.total}</span>`;

    meta.innerHTML = `
      <div class="font-mono text-[10px] opacity-75">${s.code.toUpperCase()} • ${formatDate(s.released_at)}</div>
      <div class="font-semibold bg-black/30 px-2 py-0.5 rounded-full mt-1">${collectedText}</div>
    `;

    card.appendChild(imgWrap);
    card.appendChild(name);
    card.appendChild(meta);

    card.addEventListener('click', () => {
      console.log(`[Sets] Clicked set: ${s.code}`);
      if (typeof window.showSetView === 'function') {
        window.showSetView(s.code);
      } else {
        console.warn('[Sets] showSetView not found on window, attempting dynamic import...');
        import('./set_details.js').then(mod => {
          if (mod && typeof mod.showSetView === 'function') {
            mod.showSetView(s.code);
          } else {
            console.error('[Sets] Failed to load showSetView from module');
          }
        }).catch(err => console.error('[Sets] Dynamic import failed', err));
      }
    });
    frag.appendChild(card);
  }
  container.appendChild(frag);
}

function renderTable(container, items) {
  try { container.className = 'p-4'; } catch (e) { }
  container.innerHTML = '';
  if (!items.length) {
    const noMsg = document.getElementById('no-sets-msg');
    if (noMsg) noMsg.classList.remove('hidden');
    return;
  }
  const noMsg = document.getElementById('no-sets-msg');
  if (noMsg) noMsg.classList.add('hidden');

  const table = document.createElement('table');
  table.className = 'w-full text-left border-collapse';
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr class="text-sm text-gray-400 border-b border-gray-700"><th class="p-3">Set</th><th class="p-3">Code</th><th class="p-3">Released</th><th class="p-3">Collected</th><th class="p-3">Progress</th></tr>`;
  const tbody = document.createElement('tbody');

  for (const s of items) {
    const stats = setStatistics[s.code] || { owned: 0, total: s.card_count || 0, percent: 0 };

    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-800 hover:bg-gray-700/50 cursor-pointer transition-colors';
    tr.innerHTML = `
      <td class="p-3 text-gray-200 font-medium flex items-center gap-3">
        <img src="${chooseIcon(s)}" class="w-6 h-6 object-contain opacity-75" onerror="this.style.display='none'">
        ${s.name}
      </td>
      <td class="p-3 text-gray-400 font-mono text-xs">${s.code.toUpperCase()}</td>
      <td class="p-3 text-gray-400 text-sm">${formatDate(s.released_at)}</td>
      <td class="p-3 text-gray-300 text-sm font-mono">${stats.owned}/${stats.total}</td>
      <td class="p-3 align-middle">
        <div class="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-500" style="width: ${stats.percent}%"></div>
        </div>
      </td>
    `;
    tr.addEventListener('click', () => {
      console.log(`[Sets] Clicked set (table): ${s.code}`);
      if (typeof window.showSetView === 'function') {
        window.showSetView(s.code);
      } else {
        import('./set_details.js').then(mod => {
          if (mod && typeof mod.showSetView === 'function') mod.showSetView(s.code);
        });
      }
    });
    tbody.appendChild(tr);
  }
  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderSets() {
  const container = document.getElementById('sets-content');
  if (!container) return;

  calculateSetStatistics();

  const q1 = (document.getElementById('sets-search-input') || { value: '' }).value.trim().toLowerCase();
  const q2 = (document.getElementById('sets-filter-text') || { value: '' }).value.trim().toLowerCase();
  const filterText = `${q1} ${q2}`.trim();
  const filterType = (document.getElementById('sets-filter-type') || { value: '' }).value;

  let items = setsData.slice();

  // Text Filter
  if (filterText) {
    items = items.filter(s => (s.name || '').toLowerCase().includes(filterText) || (s.code || '').toLowerCase().includes(filterText));
  }

  // Type Filter
  if (filterType) {
    items = items.filter(s => (s.set_type || '').toLowerCase() === filterType);
  }

  // Owned Filter
  if (showOwnedOnly) {
    items = items.filter(s => {
      const stats = setStatistics[s.code];
      return stats && stats.owned > 0;
    });
  }

  const sortBy = (document.getElementById('sets-sort-select') || { value: 'name' }).value;
  items.sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'released') return new Date(b.released_at || 0) - new Date(a.released_at || 0);
    if (sortBy === 'card_count') return (b.card_count || 0) - (a.card_count || 0);
    if (sortBy === 'progress') {
      const statsA = setStatistics[a.code] || { percent: 0 };
      const statsB = setStatistics[b.code] || { percent: 0 };
      return statsB.percent - statsA.percent;
    }
    return 0;
  });

  // Group by set_type logic
  const shouldGroupByType = !filterType && sortBy !== 'progress';

  if (shouldGroupByType) {
    const groups = items.reduce((acc, s) => {
      const key = s.set_type || 'Other';
      (acc[key] = acc[key] || []).push(s);
      return acc;
    }, {});

    container.innerHTML = '';
    try { container.className = 'space-y-4 p-4'; } catch (e) { }

    const sortedKeys = Object.keys(groups).sort();
    if (sortedKeys.length === 0) {
      const noMsg = document.getElementById('no-sets-msg');
      if (noMsg) noMsg.classList.remove('hidden');
    } else {
      const noMsg = document.getElementById('no-sets-msg');
      if (noMsg) noMsg.classList.add('hidden');
    }

    sortedKeys.forEach((type) => {
      const list = groups[type];
      const details = document.createElement('details');
      details.className = 'bg-gray-900/40 rounded-lg overflow-hidden border border-gray-800';
      // Open by default if filtering, otherwise collapsed
      if (filterText || showOwnedOnly) details.open = true;

      const summary = document.createElement('summary');
      summary.className = 'px-4 py-3 font-semibold text-gray-200 flex items-center gap-3 cursor-pointer hover:bg-gray-800/50 transition-colors select-none';
      summary.innerHTML = `<span class="capitalize">${type.replace(/_/g, ' ')}</span> <span class="text-gray-500 text-xs font-normal ml-auto">${list.length} sets</span>`;
      details.appendChild(summary);

      const gridWrap = document.createElement('div');
      if (currentView === 'table') {
        renderTable(gridWrap, list);
      } else {
        renderGrid(gridWrap, list);
        applyGridSize(gridWrap, currentSize);
      }
      details.appendChild(gridWrap);
      container.appendChild(details);
    });
    return;
  }

  // Flat list render
  if (currentView === 'table') renderTable(container, items);
  else renderGrid(container, items);
  applyGridSize(container, currentSize);
}

function wireControls() {
  const searchInput = document.getElementById('sets-search-input');
  const filterInput = document.getElementById('sets-filter-text');
  const filterType = document.getElementById('sets-filter-type');
  const refreshBtn = document.getElementById('refresh-sets-btn');
  const sortSelect = document.getElementById('sets-sort-select');
  const resetBtn = document.getElementById('sets-reset-filters-btn');
  const gridBtns = Array.from(document.getElementsByClassName('sets-grid-size-btn'));
  const gridToggle = document.getElementById('sets-view-toggle-grid');
  const tableToggle = document.getElementById('sets-view-toggle-table');
  const ownedFilter = document.getElementById('sets-filter-owned-only');

  if (searchInput) searchInput.addEventListener('input', debounce(renderSets, 150));
  if (filterInput) filterInput.addEventListener('input', debounce(renderSets, 150));
  if (filterType) filterType.addEventListener('change', renderSets);
  if (sortSelect) sortSelect.addEventListener('change', renderSets);
  if (refreshBtn) refreshBtn.addEventListener('click', async () => { refreshBtn.disabled = true; await fetchSets(); renderSets(); refreshBtn.disabled = false; });

  if (ownedFilter) {
    ownedFilter.checked = showOwnedOnly;
    ownedFilter.addEventListener('change', (e) => {
      showOwnedOnly = e.target.checked;
      try { localStorage.setItem('sets_filter_owned_only', showOwnedOnly); } catch (e) { }
      renderSets();
    });
  }

  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (filterInput) filterInput.value = '';
    if (filterType) filterType.value = '';
    if (sortSelect) sortSelect.value = 'name';
    if (ownedFilter) { ownedFilter.checked = false; showOwnedOnly = false; try { localStorage.removeItem('sets_filter_owned_only'); } catch (e) { } }
    currentView = 'grid';
    currentSize = 'md';
    renderSets();
  });

  gridBtns.forEach(b => b.addEventListener('click', (ev) => {
    gridBtns.forEach(x => x.classList.remove('bg-indigo-600', 'text-white'));
    ev.currentTarget.classList.add('bg-indigo-600', 'text-white');
    currentSize = ev.currentTarget.getAttribute('data-size') || 'md';
    try { if (typeof window !== 'undefined') window.collectionGridSize = currentSize; } catch (e) { }
    renderSets();
  }));

  if (gridToggle) gridToggle.addEventListener('click', () => { currentView = 'grid'; try { if (typeof window !== 'undefined') window.collectionViewMode = 'grid'; } catch (e) { } renderSets(); });
  if (tableToggle) tableToggle.addEventListener('click', () => { currentView = 'table'; try { if (typeof window !== 'undefined') window.collectionViewMode = 'table'; } catch (e) { } renderSets(); });
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export default async function initSetsModule() {
  const container = document.getElementById('sets-content');
  if (!container) return;

  // Load preferences
  try {
    if (typeof window !== 'undefined') {
      if (window.collectionGridSize) currentSize = window.collectionGridSize;
      if (window.collectionViewMode) currentView = window.collectionViewMode;
    }
    const savedOwned = localStorage.getItem('sets_filter_owned_only');
    if (savedOwned !== null) showOwnedOnly = (savedOwned === 'true');
  } catch (e) { }

  wireControls();

  // Sync UI state
  try {
    const btn = document.querySelector(`.sets-grid-size-btn[data-size="${currentSize}"]`);
    if (btn) { document.querySelectorAll('.sets-grid-size-btn').forEach(b => b.classList.remove('bg-indigo-600', 'text-white')); btn.classList.add('bg-indigo-600', 'text-white'); }
    if (currentView === 'grid') { const g = document.getElementById('sets-view-toggle-grid'); const t = document.getElementById('sets-view-toggle-table'); if (g) g.classList.add('bg-indigo-600', 'text-white'); if (t) t.classList.remove('bg-indigo-600', 'text-white'); }
    else { const g = document.getElementById('sets-view-toggle-grid'); const t = document.getElementById('sets-view-toggle-table'); if (t) t.classList.add('bg-indigo-600', 'text-white'); if (g) g.classList.remove('bg-indigo-600', 'text-white'); }
  } catch (e) { }

  const loader = document.createElement('div');
  loader.className = 'text-center text-gray-400';
  loader.textContent = 'Loading sets…';
  container.innerHTML = '';
  container.appendChild(loader);

  await fetchSets();
  renderSets();
}

window.initSetsModule = initSetsModule;
export { initSetsModule };
