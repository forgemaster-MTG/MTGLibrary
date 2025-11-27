import { showToast } from '../lib/ui.js';
import { localCollection, localDecks, cardDeckAssignments, updateCardAssignments } from '../lib/data.js';

// Local view state (seed from shared window state when available)
let collectionViewMode = (typeof window !== 'undefined' && window.collectionViewMode) ? window.collectionViewMode : 'grid';
let collectionGridSize = (typeof window !== 'undefined' && window.collectionGridSize) ? window.collectionGridSize : 'md';
let collectionSortState = (typeof window !== 'undefined' && window.collectionSortState) ? window.collectionSortState : { column: 'name', direction: 'asc' };
let collectionCurrentPage = 1;
const COLLECTION_PAGE_SIZE = 100;

function sortCards(cards) {
  const { column, direction } = collectionSortState;
  const sorted = [...cards].sort((a, b) => {
    let valA, valB;
    if (column === 'price') {
      valA = parseFloat(a.prices?.usd || 0);
      valB = parseFloat(b.prices?.usd || 0);
    } else if (column === 'count') {
      valA = a.count || 1;
      valB = b.count || 1;
    } else {
      valA = a[column] ?? '';
      valB = b[column] ?? '';
    }
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

// Helpers for double-faced (modal/transform) cards
function getCardFaceImageUrls(card, sizeKey = 'normal') {
  try {
    // Prefer card_faces when present (double-faced cards)
    if (Array.isArray(card.card_faces) && card.card_faces.length > 0) {
      const frontFace = card.card_faces[0];
      const backFace = card.card_faces[1] || null;
      // prefer a sensible ordering of available sizes
      const choose = (uris) => {
        if (!uris) return null;
        return uris[sizeKey] || uris.art_crop || uris.large || uris.normal || uris.small || uris.png || null;
      };
      const front = choose(frontFace.image_uris) || (card.image_uris ? choose(card.image_uris) : null);
      const back = backFace ? (choose(backFace.image_uris) || null) : null;
      return { front, back };
    }
    // Fallback to top-level image_uris
    if (card.image_uris) {
      const chooseTop = (uris) => uris[sizeKey] || uris.art_crop || uris.large || uris.normal || uris.small || uris.png || null;
      return { front: chooseTop(card.image_uris), back: null };
    }
  } catch (e) { /* ignore */ }
  return { front: null, back: null };
}

function renderCardImageHtml(card, sizeKey = 'normal', imgClass = '') {
  // Always show the first available image (front) and avoid flip UI.
  // This reverts the flip behavior: we prefer the first image returned by
  // getCardFaceImageUrls and fall back to the placeholder when missing.
  const imgs = getCardFaceImageUrls(card, sizeKey);
  const front = imgs.front || imgs.back || '';
  const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><rect width="100%" height="100%" fill="#0f1724"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9CA3AF" font-family="Arial, Helvetica, sans-serif" font-size="20">No image</text></svg>`);
  const src = front || PLACEHOLDER_SVG;
  return `<img src="${src}" alt="${(card.name || 'card')}" class="${imgClass} card-image" loading="lazy" />`;
}

function computeGroupCounts(items) {
  if (!items) return { unique: 0, copies: 0 };
  if (Array.isArray(items)) {
    const unique = items.length;
    const copies = items.reduce((acc, c) => acc + (c.count || 1), 0);
    return { unique, copies };
  }
  let totalUnique = 0;
  let totalCopies = 0;
  for (const key of Object.keys(items)) {
    const childCounts = computeGroupCounts(items[key]);
    totalUnique += childCounts.unique;
    totalCopies += childCounts.copies;
  }
  return { unique: totalUnique, copies: totalCopies };
}

function groupCardsRecursively(cards, groupByKeys) {
  if (!groupByKeys || !groupByKeys.length) return cards;
  const currentKey = groupByKeys[0];
  const remainingKeys = groupByKeys.slice(1);
  const groups = cards.reduce((acc, card) => {
    let key;
    if (currentKey === 'color_identity') {
      const colors = (card.color_identity || []).join('');
      key = colors === '' ? 'Colorless' : colors;
    } else if (currentKey === 'type_line') {
      key = (card.type_line || '').split(' — ')[0];
    } else if (currentKey === 'deck') {
      const assignment = (cardDeckAssignments[card.firestoreId] || [])[0];
      key = assignment ? assignment.deckName : 'Not in a Deck';
    } else {
      key = card[currentKey] ?? 'Other';
    }
    (acc[key] = acc[key] || []).push(card);
    return acc;
  }, {});
  if (remainingKeys.length > 0) {
    for (const groupName in groups) {
      groups[groupName] = groupCardsRecursively(groups[groupName], remainingKeys);
    }
  }
  return groups;
}

function renderCollectionCard(card) {
  // Aggregate variants (if grouped) or use single card
  const variants = card._group ? card._group.variants : [card];

  // 1. Aggregate Deck Assignments
  const deckNames = new Set();
  variants.forEach(v => {
    const assignments = cardDeckAssignments[v.firestoreId] || [];
    assignments.forEach(a => { if (a.deckName) deckNames.add(a.deckName); });
  });

  let deckDisplay = '';
  if (deckNames.size > 0) {
    deckDisplay = Array.from(deckNames).join(', ');
  }

  // 2. Calculate Prices (Unit Price of Rep & Total Value of Group)
  // Representative price (current card)
  const unitPrice = card.prices?.usd_foil && card.finish === 'foil' ? card.prices.usd_foil : card.prices?.usd;
  const unitPriceStr = unitPrice ? `$${unitPrice}` : '';

  // Total value of all variants
  let totalValue = 0;
  variants.forEach(v => {
    const p = v.prices?.usd_foil && v.finish === 'foil' ? v.prices.usd_foil : v.prices?.usd;
    totalValue += (parseFloat(p) || 0) * (v.count || 1);
  });
  const totalValueStr = totalValue > 0 ? `$${totalValue.toFixed(2)}` : '';

  return `
    <div class="relative group aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-lg bg-gray-900 transition-transform duration-200 hover:scale-105 hover:shadow-indigo-500/20 hover:z-10 collection-card-item">
      ${renderCardImageHtml(card, 'normal', 'w-full h-full object-cover')}
      
      <!-- Default View: Count & Name -->
      <div class="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md z-20">${card._group ? card._group.total : (card.count || 1)}</div>
      
      <div class="absolute bottom-8 left-2 right-2 p-2 bg-black/70 backdrop-blur-sm rounded-lg group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
         <p class="text-white text-xs font-bold text-center leading-tight">${card.name}</p>
      </div>

      <!-- Hover Overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
        
        <div class="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-200">
            <div class="font-bold text-white text-sm leading-tight mb-1">${card.name}</div>
            <div class="text-xs text-gray-300 mb-2 flex flex-col gap-1">
                <div class="flex justify-between items-center">
                    <span class="truncate max-w-[60%]">${(card.type_line || '').split('—')[0].trim()}</span>
                    <span class="text-green-400 font-mono">${unitPriceStr}</span>
                </div>
                ${totalValueStr && totalValueStr !== unitPriceStr ? `<div class="text-right text-[10px] text-gray-500">Total: ${totalValueStr}</div>` : ''}
                ${deckNames.size > 0 ? `
                  <div class="mt-1">
                    <div class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">Decks:</div>
                    <div class="flex flex-col gap-0.5">
                      ${Array.from(deckNames).map(name => `<div class="text-indigo-300 text-xs truncate" title="${name}">${name}</div>`).join('')}
                    </div>
                  </div>
                ` : ''}
            </div>

            ${card._group && card._group.variants.length > 0 ? `
              <div class="flex flex-wrap gap-1 mb-3">
                ${(() => {
        const finishes = { nonfoil: 0, foil: 0, etched: 0 };
        card._group.variants.forEach(v => {
          const f = v.finish || 'nonfoil';
          finishes[f] = (finishes[f] || 0) + (v.count || 1);
        });
        let html = '';
        if (finishes.nonfoil > 0) html += `<span class="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded border border-gray-600" title="Non-Foil">${finishes.nonfoil}</span>`;
        if (finishes.foil > 0) html += `<span class="text-[10px] px-1.5 py-0.5 bg-yellow-900/40 text-yellow-200 rounded border border-yellow-700/50" title="Foil">${finishes.foil} ★</span>`;
        if (finishes.etched > 0) html += `<span class="text-[10px] px-1.5 py-0.5 bg-green-900/40 text-green-200 rounded border border-green-700/50" title="Etched">${finishes.etched} ⬡</span>`;
        return html;
      })()}
              </div>
            ` : ''}

            <button class="view-card-details-btn w-full bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded text-xs font-medium transition-colors border border-gray-600" data-firestore-id="${card.firestoreId}">View Details</button>
        </div>
      </div>
    </div>
  `;
}

// Expose helper for other modules that still reference it
export { renderCollectionCard };

function renderPaginationControls(totalPages) {
  const paginationDiv = document.getElementById('collection-pagination');
  if (!paginationDiv) return;
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    const activeClass = i === collectionCurrentPage ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600';
    html += `<button class="pagination-btn ${activeClass} font-bold py-2 px-4 rounded" data-page="${i}">${i}</button>`;
  }
  paginationDiv.innerHTML = html;
  paginationDiv.querySelectorAll('.pagination-btn').forEach(button => {
    button.addEventListener('click', () => {
      collectionCurrentPage = parseInt(button.dataset.page, 10);
      renderPaginatedCollection();
    });
  });
}

export function renderPaginatedCollection() {
  const contentDiv = document.getElementById('collection-content');
  const paginationDiv = document.getElementById('collection-pagination');
  const noCardsMsg = document.getElementById('no-cards-msg');
  if (!contentDiv) return;
  // synchronize view state from the global window so toolbar controls (which
  // mutate window.*) take effect immediately when they call renderPaginatedCollection
  try {
    if (typeof window !== 'undefined') {
      if (typeof window.collectionViewMode !== 'undefined') collectionViewMode = window.collectionViewMode;
      if (typeof window.collectionGridSize !== 'undefined') collectionGridSize = window.collectionGridSize;
      // ensure a canonical sort state exists on window and prefer it if present
      if (typeof window.collectionSortState !== 'undefined') collectionSortState = window.collectionSortState;
      else window.collectionSortState = collectionSortState;
    }
  } catch (syncErr) {
    console.warn('[Collection] failed to sync window state before render', syncErr);
  }
  let rawCards = Object.values(localCollection || {});
  if (document.getElementById('hide-in-deck-checkbox')?.checked) {
    rawCards = rawCards.filter(card => !cardDeckAssignments[card.firestoreId]);
  }

  // Filter first
  const filterText = document.getElementById('filter-text')?.value?.toLowerCase() || '';
  if (filterText) {
    rawCards = rawCards.filter(card => (card.name || '').toLowerCase().includes(filterText) || (card.type_line || '').toLowerCase().includes(filterText));
  }

  // Group by Printing (Scryfall ID)
  const groupedMap = new Map();
  for (const card of rawCards) {
    let key = card.id || card.scryfall_id || card.scryfallId;
    if (!key) {
      if (card.set && card.collector_number) key = `${card.set}_${card.collector_number}`;
      else if (card.name && card.set) key = `${card.name}_${card.set}`;
      else key = card.firestoreId;
    }
    if (!groupedMap.has(key)) {
      const rep = { ...card, _isGroup: true, _group: { total: 0, variants: [] } };
      groupedMap.set(key, rep);
    }
    const group = groupedMap.get(key);
    group._group.total += (card.count || 1);
    group._group.variants.push(card);
  }
  let cards = Array.from(groupedMap.values());

  if (cards.length === 0) {
    if (noCardsMsg) noCardsMsg.classList.remove('hidden');
    contentDiv.innerHTML = '';
    if (paginationDiv) paginationDiv.innerHTML = '';
    return;
  }
  if (noCardsMsg) noCardsMsg.classList.add('hidden');

  const groupByKeys = [document.getElementById('collection-group-by-1')?.value, document.getElementById('collection-group-by-2')?.value].filter(Boolean);

  if (groupByKeys.length > 0) {
    // Delegate grouped rendering to the more capable grid/table renderers
    paginationDiv && (paginationDiv.innerHTML = '');
    if (collectionViewMode === 'grid') {
      // renderCollectionGrid will handle nested groups correctly
      renderCollectionGrid(cards, groupByKeys);
    } else {
      // table view supports grouped rows
      renderCollectionTable(cards, groupByKeys);
    }
  } else {
    // No grouping: respect the selected view mode (grid or table) and paginate
    cards = sortCards(cards);
    const totalPages = Math.ceil(cards.length / COLLECTION_PAGE_SIZE) || 1;
    const start = (collectionCurrentPage - 1) * COLLECTION_PAGE_SIZE;
    const end = start + COLLECTION_PAGE_SIZE;
    const paginatedCards = totalPages > 1 ? cards.slice(start, end) : cards;

    if (totalPages > 1) {
      renderPaginationControls(totalPages);
    } else {
      paginationDiv && (paginationDiv.innerHTML = '');
    }

    if (collectionViewMode === 'table') {
      // Render a table for the current page
      renderCollectionTable(paginatedCards, []);
    } else {
      // Render grid using collectionGridSize
      renderCollectionGrid(paginatedCards, []);
    }
  }

  // attach listeners that other modules might depend on
  document.querySelectorAll('#collection-content .view-card-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const firestoreId = e.currentTarget.dataset.firestoreId;
      const evt = new CustomEvent('view-card-details', { detail: { firestoreId } });
      window.dispatchEvent(evt);
    });
  });

  // Make sure any double-faced-card wrappers are initialized after the
  // main render so their visible-src and img.src attributes are sane.
  try { initializeDfsWrappers(); } catch (e) { /* ignore */ }

  // Update KPIs (total / unique / price / filtered summary)
  // Update KPIs (total / unique / price / filtered summary)
  try {
    const allCards = Object.values(localCollection || {});
    const totalCopiesAll = allCards.reduce((acc, c) => acc + (c.count || 1), 0);
    // Unique count based on printing (Set + Collector Number)
    const uniquePrintings = new Set();
    allCards.forEach(c => {
      let key = c.id || c.scryfall_id || c.scryfallId;
      if (!key) {
        if (c.set && c.collector_number) key = `${c.set}_${c.collector_number}`;
        else if (c.name && c.set) key = `${c.name}_${c.set}`;
        else key = c.firestoreId;
      }
      uniquePrintings.add(key);
    });
    const uniqueAll = uniquePrintings.size;
    const totalPriceAll = allCards.reduce((acc, c) => acc + ((parseFloat(c.prices?.usd) || 0) * (c.count || 1)), 0);
    const filteredCopies = cards.reduce((acc, c) => acc + (c.count || 1), 0);

    const totalEl = document.getElementById('kpi-total-cards');
    const uniqueEl = document.getElementById('kpi-unique-cards');
    const priceEl = document.getElementById('kpi-total-price');
    const filteredEl = document.getElementById('kpi-filtered-summary');

    if (totalEl) totalEl.textContent = String(totalCopiesAll);
    if (uniqueEl) uniqueEl.textContent = String(uniqueAll);
    if (priceEl) priceEl.textContent = `$${totalPriceAll.toFixed(2)}`;
    if (filteredEl) filteredEl.textContent = `${filteredCopies}/${totalCopiesAll}`;
  } catch (err) {
    console.warn('[Collection] KPI update failed', err);
  }

  // Ensure any existing DFC wrappers in the DOM have sane dataset values and
  // image src attributes. This helps when markup is injected before the
  // flip CSS/handler runs or when a previous render left dataset attrs empty.
  function initializeDfsWrappers() {
    try {
      const wrappers = document.querySelectorAll('.dfs-flip-wrapper, .card-image-wrapper');
      if (!wrappers || wrappers.length === 0) return;
      wrappers.forEach(wrap => {
        try {
          const front = wrap.dataset.front || wrap.getAttribute('data-front') || '';
          const back = wrap.dataset.back || wrap.getAttribute('data-back') || '';
          if (!wrap.dataset.current) wrap.dataset.current = front ? 'front' : (back ? 'back' : 'front');
          if (!wrap.dataset.visibleSrc) {
            // create a small inline placeholder if neither side is present
            const placeholder = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><rect width="100%" height="100%" fill="#0f1724"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9CA3AF" font-family="Arial, Helvetica, sans-serif" font-size="20">No image</text></svg>`);
            wrap.dataset.visibleSrc = front || back || (wrap.querySelector('img')?.src) || placeholder;
          }
          // Ensure inner imgs have src set (some render paths left empty src attributes)
          const imgs = wrap.querySelectorAll('img');
          imgs.forEach((img, idx) => {
            try {
              if (!img.getAttribute('src') || img.getAttribute('src').trim() === '') {
                if (idx === 0) img.setAttribute('src', front || wrap.dataset.visibleSrc);
                else img.setAttribute('src', back || wrap.dataset.visibleSrc);
              }
            } catch (e) { /* ignore per-image */ }
          });
        } catch (e) { /* ignore wrapper-level errors */ }
      });
    } catch (err) {
      console.debug('[Collection] initializeDfsWrappers error', err);
    }
  }
}

export function initCollectionModule() {
  // Expose render to window for compatibility
  window.renderPaginatedCollection = renderPaginatedCollection;
  window.renderCollection = renderPaginatedCollection;
  window.renderCollectionGrid = renderCollectionGrid;
  window.renderCollectionTable = renderCollectionTable;
  window.computeTableHeaderTop = computeTableHeaderTop;
  // Seed global window state for legacy boot wiring if not already present
  try {
    if (typeof window !== 'undefined') {
      if (typeof window.collectionViewMode === 'undefined') window.collectionViewMode = collectionViewMode;
      if (typeof window.collectionGridSize === 'undefined') window.collectionGridSize = collectionGridSize;
      if (typeof window.collectionSortState === 'undefined') window.collectionSortState = collectionSortState;
    }
  } catch (e) {
    console.warn('[Collection] could not seed window state', e);
  }

  // Expose an applySavedView helper so the settings module can tell the
  // collection to apply a saved view's configuration (grid size, view mode,
  // sorts, groupings). This keeps cross-module wiring minimal.
  try {
    if (typeof window !== 'undefined') {
      window.applySavedView = function (view) {
        try {
          if (!view) return;
          // view may contain: gridSize, viewMode, sorts, filters, groupBy
          if (view.gridSize) {
            window.collectionGridSize = view.gridSize;
            collectionGridSize = view.gridSize;
            // update visual active state for grid buttons if present
            document.querySelectorAll('.grid-size-btn').forEach(b => { b.classList.remove('bg-indigo-600', 'text-white'); if (b.dataset && b.dataset.size === collectionGridSize) b.classList.add('bg-indigo-600', 'text-white'); });
          }
          if (view.viewMode) {
            window.collectionViewMode = view.viewMode;
            collectionViewMode = view.viewMode;
            const gridBtn = document.getElementById('view-toggle-grid');
            const tableBtn = document.getElementById('view-toggle-table');
            if (view.viewMode === 'grid') { if (gridBtn) gridBtn.classList.add('bg-indigo-600', 'text-white'); if (tableBtn) tableBtn.classList.remove('bg-indigo-600', 'text-white'); }
            else { if (tableBtn) tableBtn.classList.add('bg-indigo-600', 'text-white'); if (gridBtn) gridBtn.classList.remove('bg-indigo-600', 'text-white'); }
          }
          // apply sorts if present
          if (Array.isArray(view.sorts) && view.sorts.length) {
            // store canonical sort state as the first sort rule
            const s = view.sorts[0];
            window.collectionSortState = { column: s.column || 'name', direction: s.direction || 'asc' };
            collectionSortState = window.collectionSortState;
          }
          // apply group-by selection UI if present
          try {
            if (Array.isArray(view.groupBy) && view.groupBy.length) {
              const g1 = view.groupBy[0] || '';
              const g2 = view.groupBy[1] || '';
              const el1 = document.getElementById('collection-group-by-1');
              const el2 = document.getElementById('collection-group-by-2');
              if (el1) el1.value = g1;
              if (el2) el2.value = g2;
            }
          } catch (e) { /* ignore */ }

          // update saved-views-select active value if present
          try { const sel = document.getElementById('saved-views-select'); if (sel && view.id) sel.value = view.id; } catch (e) { }

          // finally, re-render
          if (typeof window.renderPaginatedCollection === 'function') window.renderPaginatedCollection();
        } catch (err) { console.warn('[applySavedView] error', err); }
      };
    }
  } catch (e) { console.debug('[Collection] could not expose applySavedView', e); }
  // Provide a default KPI toggle handler so clicks never silently fail
  if (!window.toggleKpiMetric) {
    window.toggleKpiMetric = function (metric) {
      try {
        console.log('[Collection] default toggleKpiMetric called for', metric);
        const id = 'kpi-' + String(metric || '').replace(/_/g, '-');
        const el = document.getElementById(id);
        if (el) {
          el.classList.toggle('kpi-active');
          if (el.classList.contains('kpi-active')) el.style.outline = '3px solid rgba(99,102,241,0.6)'; else el.style.outline = '';
        }
      } catch (e) { console.error('[Collection] toggleKpiMetric error', e); }
      if (typeof window.renderPaginatedCollection === 'function') window.renderPaginatedCollection();
    };
  }
  // Attach collection-specific listeners when module initializes
  // (listeners are idempotent if called multiple times)
  if (!window.__collection_listeners_installed) {
    try {
      addCollectionCardListeners();
      addCollectionTableListeners();
      // install floating header sync if not already
      try { installFloatingHeaderSync(); } catch (e) { console.warn('[Collection] installFloatingHeaderSync failed', e); }
    } catch (e) {
      console.warn('[Collection] Could not install listeners during init:', e);
    }
    window.__collection_listeners_installed = true;
    // Wire Refresh Prices button if present (idempotent)
    try {
      const refreshBtn = document.getElementById('refresh-prices-btn');
      if (refreshBtn && !refreshBtn._handlerInstalled) {
        refreshBtn.addEventListener('click', (e) => {
          // default: persist updates to Firestore
          refreshCollectionPrices({ persist: true }).catch(err => console.error('refreshCollectionPrices error', err));
        });
        refreshBtn._handlerInstalled = true;
      }
    } catch (err) { console.warn('[Collection] failed to wire refresh-prices-btn', err); }
  }
  console.log('[Collection] Module initialized. window.renderPaginatedCollection present=', typeof window.renderPaginatedCollection === 'function');
  // Install delegated handler for double-faced-card flip buttons (idempotent)
  try {
    if (!window.__dfs_toggle_installed) {
      // ensure flip CSS is injected once for animations
      if (!window.__dfs_styles_injected) {
        try {
          const css = `
            .dfs-flip-wrapper { perspective: 1000px; }
            .dfs-card { transform-style: preserve-3d; transition: transform 320ms ease; }
            .dfs-flip-wrapper.dfs-flipped .dfs-card { transform: rotateY(180deg); }
            .dfs-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
            .dfs-back { transform: rotateY(180deg); }
            /* helpers for accessibility and layout */
            .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
          `;
          const s = document.createElement('style'); s.setAttribute('data-dfs-flip-styles', '1'); s.appendChild(document.createTextNode(css));
          (document.head || document.documentElement).appendChild(s);
          window.__dfs_styles_injected = true;
        } catch (e) { /* ignore */ }
      }

      document.addEventListener('click', function dfsToggleHandler(e) {
        try {
          const btn = e.target.closest && e.target.closest('.dfs-toggle');
          if (!btn) return;
          const wrap = btn.closest('.dfs-flip-wrapper, .card-image-wrapper');
          if (!wrap) return;
          const front = wrap.dataset.front;
          const back = wrap.dataset.back;
          if (!back) return; // nothing to flip to
          const card = wrap.querySelector('.dfs-card');
          const isFlipped = wrap.classList.toggle('dfs-flipped');
          wrap.dataset.current = isFlipped ? 'back' : 'front';
          // update a visible-src dataset used by hover previews and other consumers
          wrap.dataset.visibleSrc = isFlipped ? (back || front) : (front || back);
        } catch (err) { /* ignore */ }
      });
      window.__dfs_toggle_installed = true;
    }
  } catch (e) { /* ignore */ }
}

// Migrate searchForCard from inline HTML into module
export async function searchForCard(mode, deckId = null) {
  console.log(`[Collection.searchForCard] Initiating search in mode: ${mode}`);
  // use global state variables defined in app; these variables are kept in sync by window shims
  window.currentSearchContext = { mode, deckId };
  const input = document.getElementById(mode === 'commander' ? 'commander-search-input' : 'card-search-input');
  if (!input) return;
  const query = input.value.trim();
  if (query.length < 3) {
    showToast('Please enter at least 3 characters to search.', 'warning');
    return;
  }

  let scryfallQuery = query;
  if (mode === 'commander') scryfallQuery += ' t:legendary (t:creature or t:planeswalker)';

  const searchButton = document.getElementById(mode === 'commander' ? 'commander-search-btn' : 'search-card-btn');
  const searchIcon = document.getElementById('search-icon');
  const searchSpinner = document.getElementById('search-spinner');
  const searchText = document.getElementById('search-text');

  if (searchButton) searchButton.disabled = true;
  if (searchIcon) searchIcon.classList.add('hidden');
  if (searchSpinner) searchSpinner.classList.remove('hidden');
  if (searchText) searchText.textContent = 'Searching...';

  try {
    const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(scryfallQuery)}&unique=prints`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || 'Card not found.');
    }
    const data = await response.json();
    if (mode === 'commander') {
      const resultsContainer = document.getElementById('commander-search-results');
      if (!resultsContainer) return;
      resultsContainer.innerHTML = data.data.map(card => `
        <div class="cursor-pointer select-commander-from-search-btn rounded-md overflow-hidden" data-card-id='${card.id}' tabindex="0" role="button" aria-label="Select ${card.name}" style="aspect-ratio:2/3; position:relative">
          <img src="${card.image_uris?.art_crop}" class="commander-search-img">
          <button type="button" class="commander-select-btn absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-1 px-2 rounded" data-card-id='${card.id}'>Select</button>
        </div>
      `).join('');

      // Delegated handlers
      resultsContainer.onclick = (e) => {
        const selectBtn = e.target.closest('.commander-select-btn');
        if (selectBtn) {
          const cardId = selectBtn.dataset.cardId || selectBtn.dataset.firestoreId;
          const card = data.data.find(c => c.id === cardId);
          if (card) return window.selectCommander ? window.selectCommander(card) : null;
        }
        const btn = e.target.closest('.select-commander-from-search-btn');
        if (!btn) return;
        const cardId = btn.dataset.cardId;
        const card = data.data.find(c => c.id === cardId);
        if (card) window.selectCommander && window.selectCommander(card);
      };
      resultsContainer.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const btn = e.target.closest('.select-commander-from-search-btn');
          if (!btn) return;
          e.preventDefault();
          const cardId = btn.dataset.cardId;
          const card = data.data.find(c => c.id === cardId);
          if (card) window.selectCommander && window.selectCommander(card);
        }
      };
      resultsContainer.querySelectorAll('.commander-select-btn').forEach(b => b.addEventListener('click', (ev) => { ev.stopPropagation(); const cardId = b.dataset.cardId || b.dataset.firestoreId; const card = data.data.find(c => c.id === cardId); if (card) window.selectCommander && window.selectCommander(card); }));
    } else {
      // reuse module's render helpers for card versions
      if (typeof renderCardVersions === 'function') renderCardVersions(data.data);
      window.openModal && window.openModal('card-versions-modal');
    }
  } catch (err) {
    console.error('Scryfall API error:', err);
    showToast(err.message || String(err), 'error');
  } finally {
    if (searchButton) searchButton.disabled = false;
    if (searchIcon) searchIcon.classList.remove('hidden');
    if (searchSpinner) searchSpinner.classList.add('hidden');
    if (searchText) searchText.textContent = 'Search';
  }
}

// Migrate renderCardVersions helper
export function renderCardVersions(cards) {
  const grid = document.getElementById('card-versions-grid');
  const loading = document.getElementById('versions-loading');
  if (!grid) return;
  // Ensure a small filter UI exists above the grid (idempotent)
  const filterContainerId = 'card-versions-filter-container';
  let filterContainer = document.getElementById(filterContainerId);
  if (!filterContainer) {
    filterContainer = document.createElement('div');
    filterContainer.id = filterContainerId;
    filterContainer.className = 'mb-3';
    filterContainer.innerHTML = `
      <div class="flex items-center gap-2">
        <input id="card-versions-filter" placeholder="Filter versions (set name, set code, collector#, price, artist)" 
          class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm" />
        <button id="card-versions-filter-clear" title="Clear filter" class="text-gray-300 hover:text-white px-2" aria-label="Clear filter">&times;</button>
        <span id="card-versions-filter-count" class="text-sm text-gray-300 ml-2">&nbsp;</span>
      </div>
    `;
    grid.parentNode.insertBefore(filterContainer, grid);
  }

  const filterInput = document.getElementById('card-versions-filter');
  grid.innerHTML = '';
  grid.onclick = null;
  loading && loading.classList.remove('hidden');

  // render helper so we can re-run after filtering
  function renderList() {
    const q = (filterInput && filterInput.value || '').trim().toLowerCase();
    const filtered = q === '' ? cards : cards.filter(card => {
      try {
        // Match against set full name
        if ((card.set_name || '').toLowerCase().includes(q)) return true;
        // Match against set code
        if ((card.set || '').toLowerCase().includes(q)) return true;
        // Match against collector number
        if (String(card.collector_number || '').toLowerCase().includes(q)) return true;
        // Match against artist
        if ((card.artist || '').toLowerCase().includes(q)) return true;
        // Match against numeric price values (usd and usd_foil)
        const usd = card.prices?.usd ? String(card.prices.usd).toLowerCase() : '';
        const usdFoil = card.prices?.usd_foil ? String(card.prices.usd_foil).toLowerCase() : '';
        if (usd.includes(q) || usdFoil.includes(q)) return true;
      } catch (e) { /* ignore */ }
      return false;
    });

    grid.innerHTML = filtered.map(card => {
      const price = card.prices?.usd ? `$${card.prices.usd}` : (card.prices?.usd_foil ? `$${card.prices.usd_foil} (Foil)` : 'N/A');
      return `
          <div class="relative group rounded-lg overflow-hidden cursor-pointer card-version-item" data-card-id="${card.id}" style="aspect-ratio:2/3">
            ${renderCardImageHtml(card, 'large', 'card-version-img')}
            <div class="absolute inset-0 bg-black/40 opacity-100 group-hover:opacity-80 transition-opacity flex flex-col justify-end p-3 text-white">
              <strong class="font-bold">${card.set_name} (${card.set})</strong>
              <span class="text-xs">Collector's Number: ${card.collector_number}</span>
              <p class="text-sm">${price}</p>
            </div>
          </div>
        `;
    }).join('');

    // Ensure any dfs wrappers created by the render have their dataset/src initialized
    try { initializeDfsWrappers(); } catch (e) { /* ignore */ }

    // restore hover preview behavior
    const hoverPreview = document.getElementById('card-hover-preview');
    const hoverImage = hoverPreview && hoverPreview.querySelector('img');

    grid.querySelectorAll('.card-version-item').forEach(item => {
      item.addEventListener('mouseenter', (e) => {
        // Prefer a wrapper-provided visible-src (works for flippable cards). Fall back to the first img src.
        const wrapper = e.currentTarget.querySelector('.dfs-flip-wrapper, .card-image-wrapper');
        const imgSrc = wrapper?.dataset?.visibleSrc || e.currentTarget.querySelector('img')?.src;
        if (imgSrc && hoverImage && hoverPreview) {
          hoverImage.src = imgSrc;
          hoverPreview.classList.remove('hidden');
        }
      });
      item.addEventListener('mouseleave', () => {
        if (hoverPreview && hoverImage) { hoverPreview.classList.add('hidden'); hoverImage.src = ''; }
      });
    });

    // update match count display (shows "N matches" or "No matches")
    try {
      const countEl = document.getElementById('card-versions-filter-count');
      if (countEl) {
        if (filtered.length === 0) countEl.textContent = 'No matches';
        else if (filtered.length === 1) countEl.textContent = '1 match';
        else countEl.textContent = `${filtered.length} matches`;
      }
    } catch (e) { /* ignore */ }

    // click handler uses the filtered array to find selected card
    grid.onclick = function (event) {
      const cardItem = event.target.closest('.card-version-item');
      if (!cardItem) return;
      const cardId = cardItem.dataset.cardId;
      const selectedCard = filtered.find(c => c.id === cardId);
      if (selectedCard) {
        if (typeof window.handleCardSelection === 'function') return window.handleCardSelection(selectedCard);
        window.dispatchEvent && window.dispatchEvent(new CustomEvent('card-selected', { detail: { card: selectedCard } }));
      }
    };

    loading && loading.classList.add('hidden');
  }

  // wire filter input with a persistent debounced handler that calls the current renderList
  if (filterInput) {
    // store the current render function so the persistent handler always invokes the latest one
    filterInput._currentRenderList = renderList;
    // if a global handler isn't installed, add one and keep its own debounce state
    if (!filterInput._versionsFilterHandler) {
      filterInput._versionsFilterHandler = (function () {
        let timer = null;
        return function () {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            try {
              if (typeof filterInput._currentRenderList === 'function') filterInput._currentRenderList();
            } catch (e) { /* ignore */ }
          }, 180);
        };
      })();
      filterInput.addEventListener('input', filterInput._versionsFilterHandler);
    }
    // wire the clear button (idempotent)
    try {
      const clearBtn = document.getElementById('card-versions-filter-clear');
      if (clearBtn && !clearBtn._handlerInstalled) {
        clearBtn.addEventListener('click', () => {
          try {
            filterInput.value = '';
            // ensure the persistent handler triggers immediately
            if (typeof filterInput._currentRenderList === 'function') filterInput._currentRenderList();
            filterInput.focus();
          } catch (e) { /* ignore */ }
        });
        clearBtn._handlerInstalled = true;
      }
    } catch (e) { /* ignore */ }
  }

  // initial render
  renderList();
  // UX: when search results are shown, focus the versions filter so users can immediately refine
  try {
    const fv = document.getElementById('card-versions-filter');
    if (fv) {
      // ensure async focus so callers that just opened the modal get the cursor placed
      setTimeout(() => {
        try { fv.focus(); fv.select && fv.select(); } catch (e) { }
      }, 0);
    }
  } catch (e) { /* ignore */ }
}

// Migrate handleCardSelection and renderCardConfirmationModal
export function handleCardSelection(card) {
  console.log(`[Collection.handleCardSelection] Card selected: ${card.name} (${card.id})`);
  // set a window-scoped currentCardForAdd for existing code paths
  try { window.currentCardForAdd = card; } catch (e) { }
  // close versions modal if available, render confirmation modal and open it
  window.closeModal && window.closeModal('card-versions-modal');
  renderCardConfirmationModal(card);
  window.openModal && window.openModal('card-confirmation-modal');
}

export function renderCardConfirmationModal(card) {
  const contentDiv = document.getElementById('card-confirmation-content');
  if (!contentDiv) return;
  // Hide any global hover preview overlay while the confirmation modal is open
  try {
    const hoverPreview = document.getElementById('card-hover-preview');
    if (hoverPreview) {
      hoverPreview.classList.add('hidden');
      const hi = hoverPreview.querySelector && hoverPreview.querySelector('img');
      if (hi) hi.src = '';
    }
  } catch (e) { /* ignore */ }
  const cleanedCard = {
    id: card.id, name: card.name,
    image_uris: { small: card.image_uris?.small, normal: card.image_uris?.normal, art_crop: card.image_uris?.art_crop },
    mana_cost: card.mana_cost, cmc: card.cmc, type_line: card.type_line, oracle_text: card.oracle_text,
    power: card.power, toughness: card.toughness, colors: card.colors, color_identity: card.color_identity,
    keywords: card.keywords, set: card.set, set_name: card.set_name, rarity: card.rarity,
    prices: card.prices, legalities: card.legalities
  };

  // Render the card image inside a positioned container and avoid the
  // global `.card-image` absolute styles (which can position the img
  // relative to the body and cause it to appear detached at the page
  // top-left). Build a plain <img> with sizing classes instead.
  const imgsForModal = getCardFaceImageUrls(card, 'normal');
  const modalImgSrc = imgsForModal.front || imgsForModal.back || '';
  const modalImgHtml = `<img src="${modalImgSrc}" alt="${(card.name || 'card')}" class="rounded-lg shadow-lg w-full max-w-[360px] h-auto max-h-[640px] object-contain" loading="lazy" />`;

  contentDiv.innerHTML = `
    <div class="flex justify-center md:justify-start md:col-span-1 relative">
        ${modalImgHtml}
    </div>
    <div class="space-y-4 md:col-span-1">
      <h3 class="text-3xl font-bold">${card.name}</h3>
      <form id="add-card-form">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="card-quantity" class="block text-sm font-medium text-gray-300">Quantity</label>
            <input type="number" id="card-quantity" value="1" min="1" class="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
          </div>
          <div>
            <label for="card-finish" class="block text-sm font-medium text-gray-300">Finish</label>
            <select id="card-finish" class="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
              <!-- Default to Non-Foil unless card.finish explicitly set -->
              <option value="nonfoil" ${card.finish ? (card.finish === 'nonfoil' ? 'selected' : '') : 'selected'}>Non-Foil</option>
              <option value="foil" ${card.finish === 'foil' ? 'selected' : ''}>Foil</option>
              <option value="etched" ${card.finish === 'etched' ? 'selected' : ''}>Etched</option>
            </select>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-4">
          <button type="button" id="cancel-add-card-btn" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
          <button type="submit" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Add Card</button>
        </div>
      </form>
    </div>
  `;

  const cancelBtn = document.getElementById('cancel-add-card-btn');
  cancelBtn && cancelBtn.addEventListener('click', () => { window.closeModal && window.closeModal('card-confirmation-modal'); window.openModal && window.openModal('card-versions-modal'); });

  const addForm = document.getElementById('add-card-form');
  addForm && addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const quantity = parseInt(document.getElementById('card-quantity').value, 10) || 1;
    const finish = document.getElementById('card-finish').value;
    const current = window.currentCardForAdd || null;
    if (!current) {
      showToast && showToast('Error: No card selected.', 'error');
      return;
    }
    const cardToAdd = { ...current, count: quantity, finish, addedAt: new Date().toISOString() };
    try { await addCardToCollection(cardToAdd); } catch (err) { console.error('[Collection] addCardToCollection error', err); }
    // Close the confirmation modal
    window.closeModal && window.closeModal('card-confirmation-modal');
    // UX: After successfully adding a card, clear the collection quick-filter (top of page)
    try {
      const topFilter = document.getElementById('filter-text');
      if (topFilter) {
        topFilter.value = '';
        // trigger any change handlers if present
        try { topFilter.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { }
      }
    } catch (e) { /* ignore */ }
    // Focus the add-card search input and select all text so the user can immediately start typing a new search
    try {
      const searchInput = document.getElementById('card-search-input');
      if (searchInput) {
        searchInput.focus();
        try { searchInput.select(); } catch (e) { /* some inputs may not support select */ }
      }
    } catch (e) { /* ignore */ }
  });
}

// --- Additional rendering helpers migrated from inline HTML ---
function sortGroupContent(cards) {
  if (window.viewSortRules && window.viewSortRules.length > 0) {
    const sorted = [...cards].sort((a, b) => {
      for (const s of viewSortRules) {
        const col = s.column;
        const dir = s.direction === 'asc' ? 1 : -1;
        let valA = a[col] ?? '';
        let valB = b[col] ?? '';
        if (col === 'price') { valA = parseFloat(a.prices?.usd || 0); valB = parseFloat(b.prices?.usd || 0); }
        if (col === 'count') { valA = a.count || 1; valB = b.count || 1; }
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
      }
      return 0;
    });
    return sorted;
  }
  return sortCards(cards);
}

function renderCollectionGrid(cards, groupByKeys) {
  const contentDiv = document.getElementById('collection-content');
  if (!contentDiv) return;
  const sizeClasses = {
    sm: 'grid-cols-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11',
    md: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9',
    lg: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  };
  const gridClass = sizeClasses[collectionGridSize] || sizeClasses.md;

  let groupUidCounter = 0;
  function renderRecursiveGroups(groups, level) {
    return Object.keys(groups).sort().map((groupName) => {
      const content = groups[groupName];
      const uid = `group-${groupUidCounter++}`;
      // render caret + title with indentation; start all groups collapsed by default
      const counts = computeGroupCounts(content);
      const isLeaf = Array.isArray(content);
      const openAttr = '';
      const padding = `${1.5 + level}rem`;
      // include data-level so styling can target nested depth
      if (isLeaf) {
        return `
          <details id="${uid}" class="col-span-full collection-group level-${level}" data-level="${level}" ${openAttr}>
            <summary class="group-header" style="padding-left: ${padding}; display:flex; align-items:center; gap:0.5rem;">
              <span class="caret" aria-hidden="true">▸</span>
              <span class="group-title">${groupName}</span>
              <span class="counts">(${counts.unique} items, ${counts.copies} total)</span>
            </summary>
            <div class="grid ${gridClass} gap-4 p-4 group-content level-content-${level}">${sortGroupContent(content).map(renderCollectionCard).join('')}</div>
          </details>
        `;
      } else {
        return `
          <details id="${uid}" class="col-span-full collection-group level-${level}" data-level="${level}" ${openAttr}>
            <summary class="group-header" style="padding-left: ${padding}; display:flex; align-items:center; gap:0.5rem;">
              <span class="caret" aria-hidden="true">▸</span>
              <span class="group-title">${groupName}</span>
              <span class="counts">(${counts.unique} items, ${counts.copies} total)</span>
            </summary>
            <div class="col-span-full group-content level-content-${level}">${renderRecursiveGroups(content, level + 1)}</div>
          </details>
        `;
      }
    }).join('');
  }

  if (groupByKeys && groupByKeys.length > 0) {
    const groupedCards = groupCardsRecursively(cards, groupByKeys);
    groupUidCounter = 0;
    // enhanced nested-level styles: alternating tones, left connector, badges
    contentDiv.innerHTML = `
      <style>
        .collection-group { margin: 0.5rem 0; }
        .collection-group summary.group-header {
          display:flex; align-items:center; gap:0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          transition: background 0.12s ease, transform 0.06s ease;
        }
        .collection-group summary.group-header:hover { background: rgba(255,255,255,0.02); }
        /* level-based backgrounds for better hierarchy recognition */
        .collection-group.level-0 summary.group-header { background: linear-gradient(180deg, rgba(99,102,241,0.06), rgba(99,102,241,0.03)); border:1px solid rgba(99,102,241,0.12); }
        .collection-group.level-1 summary.group-header { background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border:1px solid rgba(255,255,255,0.02); }
        .collection-group.level-2 summary.group-header { background: linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.01)); border:1px solid rgba(255,255,255,0.01); }
        .collection-group .caret { transition: transform 0.18s ease; display:inline-flex; align-items:center; justify-content:center; width:1.1rem; height:1.1rem; border-radius:4px; background: rgba(255,255,255,0.03); color:#fff; }
        .collection-group:not([open]) .caret { transform: rotate(-90deg); }
        .collection-group[open] .caret { transform: rotate(0deg); }
        .group-title { font-weight:600; color:#EDF2FF; }
        .collection-group summary .counts { color:#9CA3AF; margin-left:auto; font-size:0.9rem; padding:0.15rem 0.45rem; background: rgba(0,0,0,0.12); border-radius:999px; }
        /* left connector line for nested groups */
        .group-content { margin-top:0.5rem; }
        .group-content.level-content-1 { border-left: 2px solid rgba(99,102,241,0.08); padding-left: 0.75rem; }
        .group-content.level-content-2 { border-left: 2px solid rgba(99,102,241,0.05); padding-left: 0.75rem; }
        .group-content.level-content-3 { border-left: 2px dashed rgba(99,102,241,0.04); padding-left: 0.75rem; }
      </style>
      <div class="grid ${gridClass} gap-4 p-4">${renderRecursiveGroups(groupedCards, 0)}</div>`;
    // add keyboard handlers for toggling details and initialize carets
    contentDiv.querySelectorAll('details summary').forEach(summary => {
      summary.tabIndex = 0;
      summary.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const details = summary.parentElement;
          details.open = !details.open;
        }
      });
    });
    // Ensure carets reflect the current open state and update on toggle
    contentDiv.querySelectorAll('details').forEach(details => {
      try {
        const caret = details.querySelector('.caret');
        if (caret) caret.textContent = details.open ? '▾' : '▸';
        details.addEventListener('toggle', () => {
          const c = details.querySelector('.caret');
          if (c) c.textContent = details.open ? '▾' : '▸';
        });
      } catch (e) { /* ignore */ }
    });
  } else {
    contentDiv.innerHTML = `<div class="grid ${gridClass} gap-4 p-4">${cards.map(renderCollectionCard).join('')}</div>`;
  }
  addCollectionCardListeners();
}

function computeTableHeaderTop(container) {
  try {
    const appHeader = document.querySelector('header');
    const containerRect = container.getBoundingClientRect();
    let topOffset = 0;
    if (appHeader) {
      const rect = appHeader.getBoundingClientRect();
      topOffset = Math.max(0, Math.ceil(rect.bottom - containerRect.top));
    }
    const banner = document.querySelector('.page-banner');
    if (banner) {
      const bRect = banner.getBoundingClientRect();
      topOffset = Math.max(topOffset, Math.ceil(bRect.bottom - containerRect.top));
    }
    topOffset = Math.max(0, topOffset);
    container.querySelectorAll('table thead').forEach(thead => { thead.style.top = `${topOffset}px`; });
    return topOffset;
  } catch (err) {
    console.error('[computeTableHeaderTop] error', err);
    return 0;
  }
}

function renderCollectionTable(cards, groupByKeys) {
  const contentDiv = document.getElementById('collection-content');
  if (!contentDiv) return;

  const renderTableRows = (cardGroup) => cardGroup.map((card) => {
    const price = card.prices?.usd_foil && card.finish === 'foil' ? card.prices.usd_foil : card.prices?.usd || 'N/A';
    const isCommander = (card.type_line || '').includes('Legendary');
    const assignment = (cardDeckAssignments[card.firestoreId] || [])[0];

    // Calculate finish breakdown for table
    let countDisplay = card.count || 1;
    let finishDisplay = card.finish || 'Normal';

    if (card._group) {
      countDisplay = card._group.total;
      const finishes = { nonfoil: 0, foil: 0, etched: 0 };
      card._group.variants.forEach(v => {
        const f = v.finish || 'nonfoil';
        finishes[f] = (finishes[f] || 0) + (v.count || 1);
      });
      const parts = [];
      if (finishes.nonfoil > 0) parts.push(`${finishes.nonfoil} Normal`);
      if (finishes.foil > 0) parts.push(`${finishes.foil} Foil`);
      if (finishes.etched > 0) parts.push(`${finishes.etched} Etched`);
      finishDisplay = parts.join(', ');
    }

    return `<tr class="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="w-10 flex-shrink-0">
              <div class="card-image-container rounded-md overflow-hidden">
                ${renderCardImageHtml(card, 'small', 'card-image')}
              </div>
          </div>
          <div>
            <div class="font-bold">${card.name}</div>
            <div class="text-sm text-gray-400">${card.set_name}</div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-center font-bold text-white">${countDisplay}</td>
      <td class="px-6 py-4 text-xs text-gray-300">${finishDisplay}</td>
      <td class="px-6 py-4">${card.type_line}</td>
      <td class="px-6 py-4">${assignment ? assignment.deckName : 'None'}</td>
      <td class="px-6 py-4">${card.rarity}</td>
      <td class="px-6 py-4 text-center">${card.cmc || 0}</td>
      <td class="px-6 py-4 text-right">$${price}</td>
      <td class="px-6 py-4 text-right">
        <button class="p-2 hover:bg-gray-600 rounded-full view-card-details-btn" data-firestore-id="${card.firestoreId}" title="View Details">
            <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>
        ${isCommander ? `<button class="p-2 hover:bg-gray-600 rounded-full create-deck-from-commander-btn" data-firestore-id="${card.firestoreId}" title="Create Commander Deck"><svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg></button>` : ''}
      </td>
    </tr>`;
  }).join('');

  const tableHeader = `
    <thead class="text-xs text-gray-400 uppercase sticky bg-gray-800" style="top: 72px; z-index: 6;">
      <tr>
        <th scope="col" class="px-6 py-3 sortable" data-sort="name">Name / Info</th>
        <th scope="col" class="px-6 py-3 sortable" data-sort="count">#</th>
        <th scope="col" class="px-6 py-3">Finish</th>
        <th scope="col" class="px-6 py-3 sortable" data-sort="type_line">Type</th>
        <th scope="col" class="px-6 py-3 sortable" data-sort="deck">Deck</th>
        <th scope="col" class="px-6 py-3 sortable" data-sort="rarity">Rarity</th>
        <th scope="col" class="px-6 py-3 sortable" data-sort="cmc">Mana</th>
        <th scope="col" class="px-6 py-3 sortable" data-sort="price">Price</th>
        <th scope="col" class="px-6 py-3"></th>
      </tr>
    </thead>`;

  if (groupByKeys && groupByKeys.length > 0) {
    const groupedCards = groupCardsRecursively(cards, groupByKeys);

    // Build one table per (sub)group so each group has its own sticky header
    function renderGroupTables(groups, level) {
      return Object.keys(groups).sort().map((groupName) => {
        const content = groups[groupName];
        const counts = computeGroupCounts(content);
        const titlePadding = `${1 + level}rem`;
        if (Array.isArray(content)) {
          // table for this leaf group - start collapsed
          return `
            <div class="group-table-wrapper mb-4" data-open="false">
              <div class="group-table-title px-4 py-2 rounded-t flex items-center justify-between" style="padding-left:${titlePadding}; background:linear-gradient(180deg, rgba(0,0,0,0.04), transparent);">
                <div class="flex items-center gap-3">
                  <button type="button" class="group-toggle-btn text-sm text-gray-300" aria-expanded="false" aria-label="Toggle group ${groupName}">▸</button>
                  <strong class="text-lg">${groupName}</strong>
                  <span class="ml-2 text-sm text-gray-400">(${counts.unique} items, ${counts.copies} total)</span>
                </div>
                <div class="group-title-actions"></div>
              </div>
              <div class="group-table-body overflow-x-auto bg-gray-800 rounded-b-lg" style="display:none;">
                <table class="w-full text-sm text-left text-gray-300">
                  ${tableHeader}
                  <tbody>
                    ${renderTableRows(content)}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        } else {
          // nested groups: render title then nested group tables - start collapsed
          return `
            <div class="group-nest-wrapper mb-4" data-open="false">
              <div class="group-table-title px-4 py-2 rounded-t flex items-center justify-between" style="padding-left:${titlePadding}; background:linear-gradient(180deg, rgba(0,0,0,0.02), transparent);">
                <div class="flex items-center gap-3">
                  <button type="button" class="group-toggle-btn text-sm text-gray-300" aria-expanded="false" aria-label="Toggle group ${groupName}">▸</button>
                  <strong class="text-lg">${groupName}</strong>
                  <span class="ml-2 text-sm text-gray-400">(${counts.unique} items, ${counts.copies} total)</span>
                </div>
                <div class="group-title-actions"></div>
              </div>
              <div class="group-nested-tables" style="padding-left:0.5rem; display:none;">
                ${renderGroupTables(content, level + 1)}
              </div>
            </div>
          `;
        }
      }).join('');
    }

    contentDiv.innerHTML = `<div class="grouped-tables w-full p-2">${renderGroupTables(groupedCards, 0)}</div>`;

    // After DOM insertion, compute correct sticky header top offsets
    try {
      const top = computeTableHeaderTop(contentDiv);
      // Create or update floating group label overlay
      let overlay = document.getElementById('collection-group-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'collection-group-overlay';
        overlay.style.position = 'fixed';
        overlay.style.zIndex = '40';
        overlay.style.pointerEvents = 'none';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.padding = '6px 16px';
        overlay.style.gap = '12px';
        overlay.style.boxSizing = 'border-box';
        overlay.innerHTML = `<div id="collection-group-overlay-content" style="margin-left:1rem;color:#E6EEF8;font-weight:600;"></div>`;
        document.body.appendChild(overlay);
      }
      // Constrain overlay to the collection content region so it doesn't overlap the sidebar/logo
      try {
        const contentRect = contentDiv.getBoundingClientRect();
        overlay.style.left = `${contentRect.left}px`;
        overlay.style.width = `${contentRect.width}px`;
        overlay.style.right = 'auto';
      } catch (e) {
        // fallback to full-width
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.width = 'auto';
      }
      overlay.style.top = `${top}px`;

      // Update overlay based on scroll position inside the collection content
      const updateOverlay = () => {
        try {
          // Keep overlay horizontally aligned with the collection content in case of resize/layout changes
          try {
            const contentRect = contentDiv.getBoundingClientRect();
            overlay.style.left = `${contentRect.left}px`;
            overlay.style.width = `${contentRect.width}px`;
            overlay.style.right = 'auto';
          } catch (e) { }
          const wrappers = Array.from(contentDiv.querySelectorAll('.group-table-wrapper, .group-nest-wrapper'));
          const viewportTop = window.scrollY + top + 2; // slight offset inside
          let currentTitle = '';
          let currentSub = '';
          for (const w of wrappers) {
            const rect = w.getBoundingClientRect();
            const absTop = window.scrollY + rect.top;
            if (absTop <= viewportTop) {
              const titleEl = w.querySelector('.group-table-title strong');
              if (titleEl) currentTitle = titleEl.textContent.trim();
              // if nested, find immediate child group header under this wrapper
              const subEl = w.querySelector('.group-nested-tables .group-table-title strong');
              if (subEl) currentSub = subEl.textContent.trim();
            }
          }
          const content = document.getElementById('collection-group-overlay-content');
          if (content) content.textContent = currentTitle + (currentSub ? (' — ' + currentSub) : '');
          overlay.style.display = currentTitle ? 'flex' : 'none';
        } catch (err) { console.debug('[Collection] updateOverlay error', err); }
      };

      // Wire scroll and resize updates (debounced)
      let ovTimer = null;
      const ovHandler = () => { clearTimeout(ovTimer); ovTimer = setTimeout(updateOverlay, 60); };
      window.removeEventListener('scroll', window.__collection_group_overlay_handler || (() => { }));
      window.__collection_group_overlay_handler = ovHandler;
      window.addEventListener('scroll', ovHandler, { passive: true });
      window.addEventListener('resize', ovHandler);
      // initial update
      updateOverlay();

      // Wire group collapse/expand toggle buttons
      try {
        contentDiv.querySelectorAll('.group-toggle-btn').forEach(btn => {
          btn.removeEventListener('click', btn._groupToggleHandler || (() => { }));
          const handler = (e) => {
            const wrapper = e.currentTarget.closest('.group-table-wrapper, .group-nest-wrapper');
            if (!wrapper) return;
            const body = wrapper.querySelector('.group-table-body, .group-nested-tables');
            const isOpen = wrapper.getAttribute('data-open') !== 'false';
            if (isOpen) {
              wrapper.setAttribute('data-open', 'false');
              if (body) body.style.display = 'none';
              e.currentTarget.setAttribute('aria-expanded', 'false');
              e.currentTarget.textContent = '▸';
            } else {
              wrapper.setAttribute('data-open', 'true');
              if (body) body.style.display = '';
              e.currentTarget.setAttribute('aria-expanded', 'true');
              e.currentTarget.textContent = '▾';
            }
            // recompute overlay and header offsets after collapse change
            try { const top = computeTableHeaderTop(contentDiv); overlay.style.top = `${top}px`; ovHandler(); } catch (err) { console.debug('group toggle recompute failed', err); }
          };
          btn.addEventListener('click', handler);
          btn._groupToggleHandler = handler;
          // keyboard accessibility
          btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn._groupToggleHandler(e); } });
        });
      } catch (err) { console.debug('[Collection] wire group-toggle-btn failed', err); }
    } catch (err) { console.debug('[Collection] computeTableHeaderTop failed after grouped table render', err); }
  } else {
    contentDiv.innerHTML = `<div class="overflow-x-auto bg-gray-800 rounded-lg"><table class="w-full text-sm text-left text-gray-300">${tableHeader}<tbody>${renderTableRows(cards)}</tbody></table></div>`;
    try { computeTableHeaderTop(contentDiv); } catch (err) { console.debug('[Collection] computeTableHeaderTop failed after table render', err); }
  }

  addCollectionTableListeners();
}

// --- Migration: collection listeners moved from inline HTML ---
export function addCollectionCardListeners() {
  try {
    document.querySelectorAll('#collection-content .view-card-details-btn').forEach(btn => {
      btn.removeEventListener('click', handleViewCardClick);
      btn.addEventListener('click', handleViewCardClick);
    });
    document.querySelectorAll('#collection-content .delete-button').forEach(btn => {
      btn.removeEventListener('click', handleDeleteCardClick);
      btn.addEventListener('click', handleDeleteCardClick);
    });
    document.querySelectorAll('#collection-content .create-deck-from-commander-btn').forEach(btn => {
      btn.removeEventListener('click', handleCreateDeckFromCommanderClick);
      btn.addEventListener('click', handleCreateDeckFromCommanderClick);
    });
  } catch (err) {
    console.warn('[Collection.addCollectionCardListeners] error', err);
  }
}

function handleViewCardClick(e) {
  const firestoreId = e.currentTarget.dataset.firestoreId;
  const card = window.localCollection ? window.localCollection[firestoreId] : null;
  if (card) {
    if (typeof window.renderCardDetailsModal === 'function') window.renderCardDetailsModal(card);
    if (typeof window.openModal === 'function') window.openModal('card-details-modal');
  }
}

async function handleDeleteCardClick(e) {
  const firestoreId = e.currentTarget.dataset.firestoreId;
  if (!firestoreId) return;
  try {
    if (typeof window.db !== 'undefined' && typeof window.appId !== 'undefined' && typeof window.userId !== 'undefined') {
      const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
      await deleteDoc(doc(window.db, `artifacts/${window.appId}/users/${window.userId}/collection`, firestoreId));
      if (typeof window.showToast === 'function') window.showToast('Card removed from collection.', 'success');
    } else {
      console.warn('[Collection.handleDeleteCardClick] firestore context missing');
    }
  } catch (err) {
    console.error('[Collection.handleDeleteCardClick] error', err);
    if (typeof window.showToast === 'function') window.showToast('Failed to remove card from collection.', 'error');
  }
}

function handleCreateDeckFromCommanderClick(e) {
  const firestoreId = e.currentTarget.dataset.firestoreId;
  const card = window.localCollection ? window.localCollection[firestoreId] : null;
  if (card && typeof window.openDeckCreationModal === 'function') window.openDeckCreationModal(card);
}

// --- Additional helpers migrated from inline HTML ---
export function toggleCardDetailsEditMode() {
  try {
    const wrapper = document.getElementById('card-details-modal-content-wrapper');
    if (!wrapper) return;
    const isEditing = wrapper.classList.toggle('card-modal-edit-mode');
    if (isEditing) {
      showToast && showToast('Card edit mode enabled.', 'info');
    } else {
      const firestoreId = wrapper.dataset.firestoreId;
      if (firestoreId) saveCardDetails(firestoreId).catch(err => console.error('[Collection] saveCardDetails error', err));
    }
  } catch (err) {
    console.error('[Collection] toggleCardDetailsEditMode error', err);
  }
}

export async function saveCardDetails(firestoreId) {
  try {
    if (!firestoreId) {
      showToast && showToast('Cannot save changes. Card not found in collection.', 'error');
      return;
    }
    // dynamic import of firestore helpers to avoid top-level dependency
    const { doc, updateDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const userId = window.userId || null;
    const appId = window.appId || null;
    if (!userId || !appId) {
      console.warn('[Collection.saveCardDetails] missing user/app context');
      return;
    }
    const cardRef = doc(window.db, `artifacts/${appId}/users/${userId}/collection`, firestoreId);

    const modalVisibility = (typeof window !== 'undefined' && window.modalVisibilitySettings) ? window.modalVisibilitySettings : { count: true, finish: true, condition: true, purchasePrice: true, notes: true };
    const newCount = modalVisibility.count ? (parseInt(document.getElementById('modal-edit-count')?.value, 10) || 0) : (localCollection[firestoreId]?.count || 0);
    if (newCount <= 0) {
      await deleteDoc(cardRef);
      showToast && showToast('Card removed from collection as count was set to 0.', 'success');
      closeModal && closeModal('card-details-modal');
      return;
    }

    const updatedData = { count: newCount };
    if (modalVisibility.finish) updatedData.finish = document.getElementById('modal-edit-finish')?.value;
    if (modalVisibility.condition) updatedData.condition = document.getElementById('modal-edit-condition')?.value.trim() || null;
    if (modalVisibility.purchasePrice) updatedData.purchasePrice = parseFloat(document.getElementById('modal-edit-purchasePrice')?.value) || null;
    if (modalVisibility.notes) updatedData.notes = document.getElementById('modal-edit-notes')?.value.trim() || null;

    await updateDoc(cardRef, updatedData);
    showToast && showToast('Card details saved!', 'success');
    const wrapper = document.getElementById('card-details-modal-content-wrapper');
    wrapper && wrapper.classList.remove('card-modal-edit-mode');
  } catch (err) {
    console.error('[Collection.saveCardDetails] error', err);
    showToast && showToast('Failed to save card details.', 'error');
  }
}

export function renderCardDetailsModal(card) {
  // Global handler for coach widget actions (recalculate, edit, feedback)
  try {
    window.handleCoachAction = function (action, deckId, firestoreId) {
      try {
        // prefer a hosted implementation if it exists
        if (action === 'recalculate') {
          if (typeof window.recalculateAiSuggestion === 'function') return window.recalculateAiSuggestion(deckId, firestoreId);
          if (typeof window.refreshAiForDeck === 'function') return window.refreshAiForDeck(deckId);
          try { if (window.showToast) window.showToast('Recalculate not available.', 'info'); } catch (e) { console.debug('Recalculate not available'); }
          return null;
        }
        if (action === 'edit') {
          // open modal edit mode if supported
          try { wrapper.classList.add('card-modal-edit-mode'); } catch (e) { }
          if (typeof window.openCardEdit === 'function') return window.openCardEdit(firestoreId);
          try { if (window.showToast) window.showToast('Edit not available.', 'info'); } catch (e) { }
          return null;
        }
        if (action === 'feedback') {
          // payload: deckId, firestoreId, thumb (+1 or -1 passed as deckId param when using inline)
          const vote = firestoreId; // in some inline handlers we pass vote in this arg
          if (typeof window.sendAiFeedback === 'function') return window.sendAiFeedback(deckId, vote);
          try { if (window.showToast) window.showToast('Feedback recorded.', 'success'); } catch (e) { }
          return null;
        }
      } catch (err) { console.debug('[Coach] action handler error', err); }
    };
  } catch (e) { /* ignore */ }
  const contentDiv = document.getElementById('card-details-content');
  const wrapper = document.getElementById('card-details-modal-content-wrapper');
  if (!contentDiv || !wrapper) return;
  // Apply blurred card art as modal background for ambience
  try {
    const bgUrl = card.image_uris?.art_crop || card.image_uris?.normal || card.image_uri || card.image;
    if (bgUrl) {
      wrapper.style.backgroundImage = `linear-gradient(rgba(6,8,15,0.75), rgba(6,8,15,0.85)), url(${bgUrl})`;
      wrapper.style.backgroundSize = 'cover';
      wrapper.style.backgroundPosition = 'center';
      wrapper.style.backdropFilter = 'blur(6px)';
      wrapper.style.WebkitBackdropFilter = 'blur(6px)';
    } else {
      wrapper.style.backgroundImage = '';
    }
  } catch (e) { /* non-fatal */ }
  wrapper.dataset.firestoreId = card.firestoreId;
  wrapper.classList.remove('card-modal-edit-mode');
  const assignments = (cardDeckAssignments || {})[card.firestoreId] || [];
  // If this card is assigned to any decks, try to pull AI suggestion metadata
  let suggestionForModal = null;
  try {
    const decksMap = (typeof window !== 'undefined' && window.localDecks) ? window.localDecks : (typeof localDecks !== 'undefined' ? localDecks : {});
    for (const a of assignments) {
      const deck = decksMap && decksMap[a.deckId];
      if (!deck) continue;
      const suggestions = (deck && (deck.aiSuggestions || (deck.aiBlueprint && deck.aiBlueprint.aiSuggestions))) || [];
      const match = suggestions && suggestions.find && suggestions.find(s => {
        if (!s) return false;
        if (s.firestoreId && (s.firestoreId === card.firestoreId || s.firestoreId === card.firestore_id)) return true;
        if (s.scryfallId && (s.scryfallId === card.id || s.scryfallId === card.scryfall_id)) return true;
        if (s.id && (s.id === card.id || s.id === card.scryfall_id)) return true;
        return false;
      });
      if (match) { suggestionForModal = { match, deck }; break; }
    }
  } catch (err) { console.debug('[Collection] suggestion lookup failed', err); }

  // Prepare suggestion HTML if found (Coach's Insight widget)
  let suggestionHtml = '';
  if (suggestionForModal && suggestionForModal.match) {
    const m = suggestionForModal.match;
    const ratingVal = (typeof m.rating !== 'undefined' && m.rating !== null) ? m.rating : null;
    const reasonText = (m.reason || m.note || '').trim();
    const safeEsc = s => String(s === undefined || s === null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // highlight common mechanical/UX terms in the explanation for scanability
    function highlightTerms(text) {
      if (!text) return '';
      const terms = ['lesson', 'lessons', 'lesson subtheme', 'synergy', 'graveyard', 'draw', 'discard', 'mana', 'cmc', 'card selection', 'tempo', 'speed', 'slow', 'fast', 'removal', 'card advantage', 'mana ramp'];
      let out = safeEsc(text);
      terms.forEach(t => {
        const re = new RegExp('\\b' + t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'ig');
        out = out.replace(re, match => `<strong class="text-white font-semibold">${match}</strong>`);
      });
      return out;
    }

    function bulletsFromReason(text) {
      if (!text) return [];
      const lower = text.toLowerCase();
      if (lower.includes('pros:') || lower.includes('cons:')) {
        const parts = text.split(/pros:?|cons:?/i).map(s => s.trim()).filter(Boolean);
        return parts.slice(0, 4);
      }
      const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
      if (sentences.length <= 2) return sentences;
      return sentences.slice(0, 3);
    }

    const rn = (ratingVal !== null && !isNaN(Number(ratingVal))) ? Number(ratingVal) : 0;
    let color = '#f59e0b';
    if (rn >= 8) color = '#34d399';
    else if (rn <= 4) color = '#f87171';
    else color = '#f59e0b';
    const percent = Math.max(0, Math.min(100, (rn / 10) * 100));
    const scoreDisplay = Number.isFinite(rn) ? (Math.round(rn * 10) / 10).toFixed(1) : '0.0';
    const bullets = bulletsFromReason(reasonText).map(s => `<li class="mb-1">${highlightTerms(s)}</li>`).join('');
    const deckName = (suggestionForModal.deck && (suggestionForModal.deck.name || suggestionForModal.deck.title || suggestionForModal.deck.deckName)) || 'this deck';
    const deckIdAttr = suggestionForModal.deck && (suggestionForModal.deck.id || suggestionForModal.deck.firestoreId || suggestionForModal.deck.deckId) || '';
    const fsId = card && (card.firestoreId || card.id || card.scryfallId) || '';

    suggestionHtml = `
        <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 mt-3 shadow-sm coach-insight">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <svg class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8 6 3 8 3 12c0 5 4 9 9 9s9-4 9-9c0-4-5-6-9-10z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>Synergy with ${safeEsc(deckName)}</span>
              </h3>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="handleCoachAction('recalculate', '${deckIdAttr}', '${fsId}');" class="text-xs text-blue-400 hover:underline">Recalculate</button>
              <button onclick="handleCoachAction('edit', '${deckIdAttr}', '${fsId}');" class="text-xs text-gray-300 hover:text-white ml-1" title="Edit note">✎</button>
            </div>
          </div>

          <div class="flex items-start gap-4">
            <div class="flex-shrink-0 text-center">
              <div class="w-14 h-14 rounded-full p-1 flex items-center justify-center" style="background: conic-gradient(${color} ${percent * 3.6}deg, rgba(255,255,255,0.03) 0deg);">
                <div class="w-full h-full rounded-full flex items-center justify-center" style="background: rgba(6,8,15,0.9);">
                  <span class="text-lg font-bold" style="color: #ffffff;">${scoreDisplay}</span>
                </div>
              </div>
              <span class="text-[10px] text-gray-500 mt-1 block">${rn >= 8 ? 'Excellent' : rn >= 5 ? 'Average' : 'Poor'}</span>
            </div>

            <div class="text-sm text-gray-300 leading-relaxed flex-grow">
              <div class="mb-2">${highlightTerms(reasonText)}</div>
              ${bullets ? `<ul class="list-disc list-inside text-gray-300">${bullets}</ul>` : ''}
              <div class="mt-2 flex items-center gap-2">
                <button onclick="handleCoachAction('feedback','${deckIdAttr}', '+1');" class="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">👍</button>
                <button onclick="handleCoachAction('feedback','${deckIdAttr}', '-1');" class="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">👎</button>
                <span class="ml-3 text-[11px] text-gray-500">Last updated: ${safeEsc(m.updatedAt || m.updated || '')}</span>
              </div>
            </div>
          </div>
        </div>
      `;
  }

  // Default modal visibility settings. Many Scryfall-specific or low-value fields
  // are disabled by default (false) so they don't clutter the modal. Settings UI
  // can override these via `window.modalVisibilitySettings`.
  const modalVisibility = (typeof window !== 'undefined' && window.modalVisibilitySettings) ? window.modalVisibilitySettings : {
    count: true,
    finish: true,
    condition: true,
    purchasePrice: true,
    notes: true,
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
    image_uris: false
  };

  // Build a comprehensive details HTML block including common saved fields
  try {
    const details = [];
    const push = (label, value) => { if (value !== undefined && value !== null && String(value) !== '') details.push({ label, value }); };
    push('Firestore ID', card.firestoreId);
    push('Scryfall ID', card.id || card.scryfall_id);
    push('Name', card.name);
    push('Mana Cost', card.mana_cost || '');
    push('Type', card.type_line || '');
    push('Oracle Text', card.oracle_text || '');
    push('Power/Toughness', (card.power || card.toughness) ? `${card.power || '?'} / ${card.toughness || '?'}` : '');
    push('Set', card.set_name || card.set || '');
    push('Collector #', card.collector_number || '');
    push('Rarity', card.rarity || '');
    push('Colors', (card.colors || []).join(', '));
    push('Color Identity', (card.color_identity || []).join(', '));
    push('CMC', card.cmc ?? '');
    // Prices: try to format usd and usd_foil
    if (card.prices) {
      const p = card.prices;
      const priceText = [];
      if (p.usd) priceText.push(`USD: $${Number(p.usd).toFixed(2)}`);
      if (p.usd_foil) priceText.push(`USD (foil): $${Number(p.usd_foil).toFixed(2)}`);
      if (priceText.length) push('Prices', priceText.join(' — '));
    }
    push('Count', card.count ?? '');
    push('Finish', card.finish || '');
    push('Condition', card.condition || '');
    push('Purchase Price', (card.purchasePrice !== undefined && card.purchasePrice !== null) ? `$${Number(card.purchasePrice).toFixed(2)}` : '');
    push('Notes', card.notes || '');

    // Also include any AI suggestion we found earlier under suggestionForModal.match
    if (suggestionForModal && suggestionForModal.match) {
      const m = suggestionForModal.match;
      push('AI Rating', (typeof m.rating !== 'undefined' && m.rating !== null) ? `${m.rating}/10` : '');
      push('AI Reason', m.reason || m.note || '');
      push('AI Source', m.sourceType || m.source || '');
    }

    // Generic extra fields (non-empty) — show anything not already listed
    Object.keys(card).forEach(k => {
      // Skip core fields already represented in the details grid above
      if (['firestoreId', 'id', 'scryfall_id', 'name', 'mana_cost', 'type_line', 'oracle_text', 'power', 'toughness', 'set_name', 'set', 'collector_number', 'rarity', 'colors', 'color_identity', 'cmc', 'prices', 'count', 'finish', 'condition', 'purchasePrice', 'notes'].includes(k)) return;
      // Skip a set of Scryfall / low-value fields that should not appear by default
      if (['textless', 'set_type', 'lang', 'digital', 'cardmarket_id', 'object', 'highres_image', 'scryfall_set_uri', 'promo', 'nonfoil', 'games', 'purchase_uris', 'related_uris', 'set_search_uri', 'uri', 'security_stamp', 'oversized', 'booster', 'frame', 'prints_search_uri', 'edhrec_rank', 'variation', 'image_status', 'finishes', 'card_faces', 'reprint', 'promo_types', 'tcgplayer_id', 'story_spotlight', 'full_art', 'layout', 'image_uris'].includes(k)) return;
      const val = card[k];
      if (val === undefined || val === null) return;
      if ((typeof val === 'object' && Object.keys(val).length === 0) || (Array.isArray(val) && val.length === 0)) return;
      try { push(k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), (typeof val === 'object') ? JSON.stringify(val) : String(val)); } catch (e) { }
    });

    const detailsHtml = details.map(d => `
            <div class="mb-3 border-b border-gray-800 pb-2">
              <div class="text-xs text-gray-400 uppercase">${d.label}</div>
              <div class="text-sm text-gray-200 mt-1">${d.value}</div>
            </div>
          `).join('');

    // helper escaper and truncator
    const esc = s => String(s === undefined || s === null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Render mana symbols from {W}{U}{B}{R}{G}{C}{2}{W/U} etc into styled badges
    const renderManaSymbols = (text) => {
      if (!text) return '';
      // replace tokens like {2}, {W}, {W/U}, {T}
      return String(text).replace(/\{([^}]+)\}/g, (m, token) => {
        const key = token.toUpperCase();
        // normalize hybrid (use slash) and phyrexian (P)
        const display = key.replace('/', '/');
        // color mapping for main symbols
        const colorMap = { 'W': '#f8f5e6', 'U': '#cfe8ff', 'B': '#222222', 'R': '#ffd1cf', 'G': '#d4f5d6', 'C': '#dfe3e6' };
        const bg = colorMap[key] || '#333';
        const fg = (key === 'B' ? '#fff' : '#000');
        // numeric cost or generic
        const inner = display;
        return `<span class="mana-symbol" style="display:inline-block;min-width:20px;height:20px;padding:0 6px;margin:0 2px;border-radius:4px;background:${bg};color:${fg};font-weight:700;font-size:12px;line-height:20px;text-align:center;border:1px solid rgba(0,0,0,0.2)">${inner}</span>`;
      });
    };
    const trunc = (s, start = 6, end = 4) => {
      const str = String(s || '');
      if (str.length <= start + end + 3) return str;
      return `${str.slice(0, start)}...${str.slice(-end)}`;
    };

    // Legalities formatted as badges (green for Legal, red for Banned, gray otherwise)
    let legalitiesHtml = '';
    try {
      const l = card.legalities || {};
      if (l && typeof l === 'object') {
        // Focus on a common subset; omit obscure formats to reduce noise
        const preferred = ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pioneer', 'pauper', 'historic'];
        const formats = Object.keys(l).filter(f => preferred.includes(f.toLowerCase())).sort();
        // If none of the preferred formats exist, fall back to showing all (first 12)
        const show = formats.length ? formats : Object.keys(l).slice(0, 12);
        legalitiesHtml = show.map(f => {
          const val = String(l[f] || '').toLowerCase();
          const label = f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          let bg = 'bg-gray-700 text-gray-300';
          if (val === 'legal') bg = 'bg-green-500 text-white';
          else if (val === 'banned' || val === 'not_legal' || val === 'not legal' || val === 'illegal') bg = 'bg-red-600 text-white';
          else bg = 'bg-gray-600 text-white';
          return `<span class="inline-flex items-center gap-2 px-2 py-1 rounded-full ${bg} text-xs font-semibold mr-2 mb-2">${label}: <span class="ml-2 text-sm font-normal text-white">${String(l[f])}</span></span>`;
        }).join('');
      }
    } catch (e) { legalitiesHtml = ''; }

    // Rulings
    const rulingsCount = Array.isArray(card.rulings) ? card.rulings.length : 0;
    const rulingsLink = card.rulings_uri || (card.related_uris && card.related_uris.rulings) || '';

    // Collection fields
    const totalOwned = card.count ?? 0;
    const finish = card.finish || (Array.isArray(card.finishes) ? card.finishes.join(', ') : (card.isFoil ? 'Foil' : 'Nonfoil')) || 'Unknown';
    const priceText = (() => {
      try {
        const p = card.prices || {};
        const part = [];
        if (p.usd) part.push(`$${Number(p.usd).toFixed(2)}`);
        if (p.usd_foil) part.push(`Foil: $${Number(p.usd_foil).toFixed(2)}`);
        return part.join(' — ');
      } catch (e) { return ''; }
    })();
    const dateAdded = card.addedAt || card.added_at || card.originalReleaseDate || '';

    // Art & Metadata
    const artist = card.artist || card.artistName || card.artist_name || '';
    const frameEffects = (card.frame_effects && card.frame_effects.join(', ')) || card.frame_effect || '';
    const watermark = card.watermark || '';
    const borderColor = card.borderColor || card.border_color || '';
    const illustrationId = card.scryfallIllustrationId || (card.identifiers && card.identifiers.scryfallIllustrationId) || '';

    // Links and IDs
    const scryfallPage = card.scryfall_uri || card.scryfallUri || (card.related_uris && card.related_uris.permalink) || '';
    const scryfallId = card.id || card.scryfallId || card.scryfall_id || '';
    const oracleId = card.oracle_id || card.scryfallOracleId || card.scryfall_oracle_id || '';
    const firestoreId = card.firestoreId || '';
    const releasedAt = card.released_at || card.releasedAt || card.originalReleaseDate || '';

    contentDiv.innerHTML = `
      <div class="h-full overflow-auto pr-2">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="md:col-span-1 flex flex-col gap-4">
            ${suggestionHtml ? `<div class="bg-gray-800 p-3 rounded text-sm">${suggestionHtml}</div>` : ''}
            <img src="${esc(card.image_uris?.normal || card.image_uri || card.image)}" class="rounded-lg w-full max-w-[550px] h-auto object-contain">
          </div>
          <div class="md:col-span-2 space-y-4">
            <!-- Header (Always Visible) -->
            <div class="bg-gray-900 p-4 rounded">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <h2 class="text-3xl font-bold leading-tight">${esc(card.name)}</h2>
                  <div class="text-sm text-gray-300 mt-1">${renderManaSymbols(esc(card.mana_cost || card.manaCost || ''))} ${card.cmc || card.manaValue ? `| CMC: ${card.cmc ?? card.manaValue ?? ''}` : ''}</div>
                  <div class="text-sm text-gray-400 mt-2">${esc(card.type_line || card.type || '')}</div>
                  <div class="text-sm text-gray-400 mt-1">${esc((card.set_name || card.set || '') + (card.rarity ? ` • ${String(card.rarity).charAt(0).toUpperCase() + String(card.rarity).slice(1)}` : ''))}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm text-gray-400">${esc(card.power && card.toughness ? `${card.power} / ${card.toughness}` : '')}</div>
                </div>
              </div>
            </div>

            <!-- Gameplay & Rules -->
            <details open class="p-3 rounded" style="background: rgba(6,8,15,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border:1px solid rgba(255,255,255,0.04);">
              <summary class="cursor-pointer font-semibold text-gray-200">Gameplay & Rules</summary>
              <div class="mt-3">
                <div class="mb-3">
                  <div class="text-xs text-gray-400">Oracle Text</div>
                  <div class="text-sm text-gray-200 whitespace-pre-wrap mt-1">${renderManaSymbols(esc(card.oracle_text || card.originalText || card.text || ''))}</div>
                </div>
                ${card.flavorText || card.flavor_text ? `<div class="mb-3 italic text-sm text-gray-400 mt-2">${esc(card.flavorText || card.flavor_text)}</div>` : ''}
                ${card.keywords && Array.isArray(card.keywords) ? `<div class="mb-2"><div class="text-xs text-gray-400">Keywords</div><div class="text-sm text-gray-200 mt-1">${esc((card.keywords || []).join(', '))}</div></div>` : ''}
                ${card.power || card.toughness ? `<div class="mb-2"><div class="text-xs text-gray-400">Power / Toughness</div><div class="text-sm text-gray-200 mt-1">${esc(card.power || '') || '?'} / ${esc(card.toughness || '') || '?'}</div></div>` : ''}
                ${card.color_identity || card.colors ? `<div class="mb-2"><div class="text-xs text-gray-400">Color Identity</div><div class="text-sm text-gray-200 mt-1">${esc((card.color_identity || card.colors || []).join(', ') || '')}</div></div>` : ''}
                <div class="mb-2"><div class="text-xs text-gray-400">Legalities</div><div class="text-sm text-gray-200 mt-1">${legalitiesHtml || '<span class="text-gray-400">No legalities data</span>'}</div></div>
                <div class="mb-2"><div class="text-xs text-gray-400">Rulings</div><div class="text-sm text-gray-200 mt-1">${rulingsLink ? `<a href="${esc(rulingsLink)}" target="_blank" class="text-indigo-400 hover:underline">View Rulings (${rulingsCount})</a>` : `<span class="text-gray-400">${rulingsCount} rulings</span>`}</div></div>
              </div>
            </details>

            <!-- Collection Status -->
            <details class="p-3 rounded" style="background: rgba(6,8,15,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border:1px solid rgba(255,255,255,0.04);">
              <summary class="cursor-pointer font-semibold text-gray-200">Collection Status</summary>
              <div class="mt-3">
                ${(() => {
        const col = (typeof window !== 'undefined' && window.localCollection) ? window.localCollection : (typeof localCollection !== 'undefined' ? localCollection : {});
        const decks = (typeof window !== 'undefined' && window.localDecks) ? window.localDecks : (typeof localDecks !== 'undefined' ? localDecks : {});
        const assignmentsMap = (typeof window !== 'undefined' && window.cardDeckAssignments) ? window.cardDeckAssignments : (typeof cardDeckAssignments !== 'undefined' ? cardDeckAssignments : {});

        const targetId = card.id || card.scryfall_id;
        // Find all variants in collection matching this Scryfall ID
        const variants = Object.values(col).filter(c => c.id === targetId || c.scryfall_id === targetId);

        if (variants.length === 0) {
          return '<div class="text-gray-400 italic">Not in collection</div>';
        }

        const groups = {};
        const ensureGroup = (key, name) => {
          if (!groups[key]) groups[key] = { deckName: name, nonFoilCount: 0, foilCount: 0, nonFoilPrice: 0, foilPrice: 0, addedAt: null };
          return groups[key];
        };

        variants.forEach(v => {
          const totalCount = v.count || 1;
          let remainingCount = totalCount;
          const assigns = assignmentsMap[v.firestoreId] || [];
          const isFoil = v.finish === 'foil' || v.finish === 'etched';

          // Distribute counts to assigned decks
          assigns.forEach(t => {
            const deck = decks[t.deckId];
            if (deck && deck.cards && deck.cards[v.firestoreId]) {
              const countInDeck = deck.cards[v.firestoreId].count || 1;
              // We can only assign up to what we have (though technically data should be consistent)
              const actualAssign = Math.min(countInDeck, remainingCount);

              if (actualAssign > 0) {
                const g = ensureGroup(t.deckId, t.deckName || deck.name);
                if (isFoil) g.foilCount += actualAssign; else g.nonFoilCount += actualAssign;

                // Update metadata
                if (v.prices) {
                  if (v.prices.usd) g.nonFoilPrice = Number(v.prices.usd);
                  if (v.prices.usd_foil) g.foilPrice = Number(v.prices.usd_foil);
                }
                const date = v.addedAt || v.added_at || '';
                if (date) {
                  if (!g.addedAt || new Date(date) > new Date(g.addedAt)) g.addedAt = date;
                }

                remainingCount -= actualAssign;
              }
            }
          });

          // If there is any count left, it belongs to "No Deck"
          if (remainingCount > 0) {
            const g = ensureGroup('unassigned', 'No Deck');
            if (isFoil) g.foilCount += remainingCount; else g.nonFoilCount += remainingCount;

            if (v.prices) {
              if (v.prices.usd) g.nonFoilPrice = Number(v.prices.usd);
              if (v.prices.usd_foil) g.foilPrice = Number(v.prices.usd_foil);
            }
            const date = v.addedAt || v.added_at || '';
            if (date) {
              if (!g.addedAt || new Date(date) > new Date(g.addedAt)) g.addedAt = date;
            }
          }
        });

        let totalOwned = 0;
        const rows = Object.values(groups).map(g => {
          const total = g.nonFoilCount + g.foilCount;
          totalOwned += total;
          const rowTotal = (g.nonFoilCount * g.nonFoilPrice) + (g.foilCount * g.foilPrice);
          const dateStr = g.addedAt ? new Date(g.addedAt).toLocaleDateString() : '-';

          return `
                          <tr class="border-b border-gray-700/50 hover:bg-gray-700/30">
                              <td class="px-3 py-2 text-indigo-300 font-medium">${esc(g.deckName)}</td>
                              <td class="px-3 py-2 text-center text-gray-300">${g.nonFoilCount}</td>
                              <td class="px-3 py-2 text-center text-gray-300">${g.foilCount}</td>
                              <td class="px-3 py-2 text-right text-gray-400">${g.nonFoilPrice ? '$' + g.nonFoilPrice.toFixed(2) : '-'}</td>
                              <td class="px-3 py-2 text-right text-gray-400">${g.foilPrice ? '$' + g.foilPrice.toFixed(2) : '-'}</td>
                              <td class="px-3 py-2 text-right text-gray-200 font-medium">$${rowTotal.toFixed(2)}</td>
                              <td class="px-3 py-2 text-right text-xs text-gray-500">${dateStr}</td>
                          </tr>
                      `;
        }).join('');

        return `
                      <div class="mb-3 text-sm text-gray-400">Total Owned: <span class="text-white font-bold">${totalOwned}</span></div>
                      <div class="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800/40">
                          <table class="w-full text-xs text-left">
                              <thead class="bg-gray-900/50 text-gray-500 uppercase font-semibold">
                                  <tr>
                                      <th class="px-3 py-2">Deck Status</th>
                                      <th class="px-3 py-2 text-center">Non-Foil</th>
                                      <th class="px-3 py-2 text-center">Foil</th>
                                      <th class="px-3 py-2 text-right">NF Price</th>
                                      <th class="px-3 py-2 text-right">F Price</th>
                                      <th class="px-3 py-2 text-right">Total</th>
                                      <th class="px-3 py-2 text-right">Added</th>
                                  </tr>
                              </thead>
                              <tbody>${rows}</tbody>
                          </table>
                      </div>
                  `;
      })()}
              </div>
            </details>

            <!-- Art & Aesthetics -->
            <details class="p-3 rounded" style="background: rgba(6,8,15,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border:1px solid rgba(255,255,255,0.04);">
              <summary class="cursor-pointer font-semibold text-gray-200">Art & Aesthetics</summary>
              <div class="mt-3 text-sm text-gray-200">
                <div class="mb-2"><span class="text-gray-400">Artist:</span> ${esc(artist)}</div>
                <div class="mb-2"><span class="text-gray-400">Frame Effects:</span> ${esc(frameEffects)}</div>
                <div class="mb-2"><span class="text-gray-400">Watermark:</span> ${esc(watermark)}</div>
                <div class="mb-2"><span class="text-gray-400">Border Color:</span> ${esc(borderColor)}</div>
                <div class="mb-2"><span class="text-gray-400">Illustration ID:</span> ${illustrationId ? `<span title="${esc(illustrationId)}">${trunc(illustrationId)}</span>` : ''}</div>
              </div>
            </details>

            <!-- Developer / Metadata -->
            <details class="p-3 rounded" style="background: rgba(6,8,15,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border:1px solid rgba(255,255,255,0.04);">
              <summary class="cursor-pointer font-semibold text-gray-200">Developer / Metadata</summary>
              <div class="mt-3 text-sm text-gray-200">
                <div class="mb-2"><span class="text-gray-400">External Links:</span> ${scryfallPage ? `<a href="${esc(scryfallPage)}" target="_blank" class="text-indigo-400 hover:underline">Scryfall</a>` : '—'}</div>
                <div class="mb-2"><span class="text-gray-400">Scryfall ID:</span> ${esc(trunc(scryfallId || ''))}</div>
                <div class="mb-2"><span class="text-gray-400">Oracle ID:</span> ${esc(trunc(oracleId || ''))}</div>
                <div class="mb-2"><span class="text-gray-400">Firestore ID:</span> ${esc(trunc(firestoreId || ''))}</div>
                <div class="mt-3"><span class="text-gray-400">System Data:</span>
                  <div class="mt-1 text-sm text-gray-200">
                    <div>Released At: ${esc(releasedAt || '')}</div>
                    <div>Game Changer: ${esc(card.game_changer || card.gameChanger || false)}</div>
                    <div>Reserved List: ${esc(card.reserved || card.reserved_list || false)}</div>
                  </div>
                </div>
              </div>
            </details>

          </div>
        </div>
      </div>
    `;

  } catch (err) {
    console.error('[Collection.renderCardDetailsModal] error building modal', err);
  }

}

export function selectCommander(card) {
  try {
    try { window.currentCommanderForAdd = card; } catch (e) { currentCommanderForAdd = card; }
    const previewContainer = document.getElementById('selected-commander-preview');
    if (!previewContainer) return;
    previewContainer.innerHTML = `
      <img src="${card.image_uris?.art_crop}" class="w-16 h-12 object-cover rounded-sm">
      <div class="flex-grow"><p class="font-bold">${card.name}</p><p class="text-xs text-gray-400">${card.type_line}</p></div>
      <button type="button" id="clear-selected-commander" class="p-1 text-red-400 hover:text-red-200 text-2xl font-bold">&times;</button>
    `;
    previewContainer.classList.remove('hidden');
    const clearBtn = document.getElementById('clear-selected-commander');
    clearBtn && clearBtn.addEventListener('click', () => {
      try { window.currentCommanderForAdd = null; } catch (e) { currentCommanderForAdd = null; }
      previewContainer.innerHTML = '';
      previewContainer.classList.add('hidden');
    });
  } catch (err) {
    console.error('[Collection.selectCommander] error', err);
  }
}

export function openDeckCreationModal(commanderCard = null) {
  try {
    const form = document.getElementById('deck-creation-form');
    form && form.reset();
    try { window.currentCommanderForAdd = null; } catch (e) { currentCommanderForAdd = null; }
    try { window.tempAiBlueprint = null; } catch (e) { tempAiBlueprint = null; }
    const preview = document.getElementById('selected-commander-preview');
    if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }

    const commanderListContainer = document.getElementById('commander-collection-list');
    const legendaryCreatures = Object.values(localCollection || {}).filter(c => (c.type_line || '').includes('Legendary') && (c.type_line || '').includes('Creature'));
    if (legendaryCreatures.length > 0) {
      commanderListContainer.innerHTML = legendaryCreatures.map(c => `
        <div class="flex items-center gap-2 p-1 rounded-md hover:bg-gray-700 cursor-pointer select-commander-from-collection-btn" data-firestore-id='${c.firestoreId}' tabindex="0" role="button" aria-label="Select ${c.name}">
          <div style="width:64px;height:48px;position:relative;flex-shrink:0;"><img src="${c.image_uris?.art_crop}" class="collection-card-img rounded-sm" style="position:absolute;inset:0;object-fit:cover;" /></div>
          <span class="flex-grow">${c.name}</span>
          <button type="button" class="commander-select-btn bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-1 px-2 rounded ml-2" data-firestore-id='${c.firestoreId}'>Select</button>
        </div>
      `).join('');

      commanderListContainer.onclick = (e) => {
        const selectBtn = e.target.closest('.commander-select-btn');
        if (selectBtn) {
          const firestoreId = selectBtn.dataset.firestoreId;
          const card = localCollection[firestoreId];
          if (card) return selectCommander(card);
        }
        const btn = e.target.closest('.select-commander-from-collection-btn');
        if (!btn) return;
        const firestoreId = btn.dataset.firestoreId;
        const card = localCollection[firestoreId];
        if (card) selectCommander(card);
      };
      commanderListContainer.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const btn = e.target.closest('.select-commander-from-collection-btn');
          if (!btn) return;
          e.preventDefault();
          const firestoreId = btn.dataset.firestoreId;
          const card = localCollection[firestoreId];
          if (card) selectCommander(card);
        }
      };
    } else {
      commanderListContainer.innerHTML = '<p class="text-gray-500 text-sm p-2">No legendary creatures in your collection.</p>';
    }

    if (commanderCard) selectCommander(commanderCard);
    openModal && openModal('deck-creation-modal');
  } catch (err) {
    console.error('[Collection.openDeckCreationModal] error', err);
  }
}

export function searchForCommander() {
  try {
    const queryInput = document.getElementById('commander-search-input');
    const q = queryInput?.value?.trim();
    if (!q || q.length < 3) return showToast && showToast('Please enter at least 3 characters to search.', 'warning');
    // reuse collection search but with commander restrictions
    return searchForCard('commander');
  } catch (err) {
    console.error('[Collection.searchForCommander] error', err);
  }
}

export function filterCommanderCollectionList() {
  try {
    const filter = document.getElementById('commander-collection-filter')?.value?.toLowerCase() || '';
    const list = document.getElementById('commander-collection-list');
    if (!list) return;
    const items = Array.from(list.children || []);
    items.forEach(item => {
      const text = (item.textContent || '').toLowerCase();
      item.style.display = text.includes(filter) ? '' : 'none';
    });
  } catch (err) {
    console.error('[Collection.filterCommanderCollectionList] error', err);
  }
}

export function addCollectionTableListeners() {
  try {
    // Re-use card listeners for table buttons
    addCollectionCardListeners();

    const table = document.querySelector('#collection-content table');
    if (!table) return;

    // attach to all tables inside the collection content area
    document.querySelectorAll('#collection-content table thead th.sortable').forEach(th => {
      th.removeEventListener('click', handleTableHeaderSortClick);
      th.addEventListener('click', handleTableHeaderSortClick);
    });
  } catch (err) {
    console.warn('[Collection.addCollectionTableListeners] error', err);
  }
}

function handleTableHeaderSortClick(e) {
  const th = e.currentTarget;
  if (document.body.classList.contains('edit-mode')) return;

  const column = th.dataset.sort;
  document.querySelectorAll('thead th.sortable').forEach(otherTh => {
    if (otherTh !== th) otherTh.classList.remove('sort-asc', 'sort-desc');
  });

  if (window.collectionSortState && window.collectionSortState.column === column) {
    window.collectionSortState.direction = window.collectionSortState.direction === 'asc' ? 'desc' : 'asc';
    // mirror into module state
    collectionSortState = window.collectionSortState;
  } else {
    window.collectionSortState = window.collectionSortState || { column: 'name', direction: 'asc' };
    window.collectionSortState.column = column;
    window.collectionSortState.direction = 'asc';
    // mirror into module state
    collectionSortState = window.collectionSortState;
  }

  th.classList.remove('sort-asc', 'sort-desc');
  th.classList.add(window.collectionSortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');

  if (typeof window.renderPaginatedCollection === 'function') window.renderPaginatedCollection();
}

// Floating header sync and resize/scroll handler migrated from inline HTML
export function installFloatingHeaderSync() {
  try {
    const handler = () => {
      document.querySelectorAll('.overflow-x-auto').forEach(container => {
        try {
          // prefer lib/ui.js computeTableHeaderTop if available
          if (typeof window.computeTableHeaderTop === 'function') {
            window.computeTableHeaderTop(container);
          } else {
            // fallback: adjust any thead top values based on header height
            const appHeader = document.querySelector('header');
            const containerRect = container.getBoundingClientRect();
            let topOffset = 0;
            if (appHeader) {
              const rect = appHeader.getBoundingClientRect();
              topOffset = Math.max(0, Math.ceil(rect.bottom - containerRect.top));
            }
            const banner = document.querySelector('.page-banner');
            if (banner) {
              const bRect = banner.getBoundingClientRect();
              topOffset = Math.max(topOffset, Math.ceil(bRect.bottom - containerRect.top));
            }
            topOffset = Math.max(0, topOffset);
            container.querySelectorAll('table thead').forEach(thead => { thead.style.top = `${topOffset}px`; });
          }
        } catch (err) {
          console.warn('[FloatingHeaderSync] inner handler error', err);
        }
      });
    };

    let timer = null;
    const resizeHandler = () => { clearTimeout(timer); timer = setTimeout(handler, 120); };
    const scrollHandler = () => { if (timer) return; timer = setTimeout(() => { handler(); timer = null; }, 150); };

    window.addEventListener('resize', resizeHandler);
    window.addEventListener('scroll', scrollHandler, { passive: true });

    // expose for potential manual sync
    window.__collection_floating_header_sync = { handler, resizeHandler, scrollHandler };
  } catch (err) {
    console.error('[installFloatingHeaderSync] error', err);
  }
}

/**
 * Refresh prices for cards in the local collection using Scryfall.
 * Assumptions: use Scryfall per-card endpoint and persist updated prices to Firestore.
 * This will perform concurrent fetches (controlled concurrency) and batch updates to Firestore
 * to avoid committing one write per card.
 *
 * Options:
 *  - persist: boolean (default true) - whether to persist updated prices to Firestore
 */
export async function refreshCollectionPrices(options = { persist: true }) {
  const persist = options.persist !== false;
  const btn = document.getElementById('refresh-prices-btn');
  const spinner = document.getElementById('refresh-prices-spinner');
  const text = document.getElementById('refresh-prices-text');
  if (btn) btn.disabled = true;
  if (spinner) spinner.classList.remove('hidden');
  if (text) text.textContent = 'Refreshing...';

  try {
    const entries = Object.values(localCollection || {}).map(c => ({ firestoreId: c.firestoreId, scryfallId: c.id })).filter(e => e.scryfallId && e.firestoreId);
    if (entries.length === 0) {
      showToast && showToast('No cards found in local collection to refresh.', 'info');
      return;
    }

    // Process entries sequentially to avoid Scryfall rate limiting.
    const results = [];
    const total = entries.length;
    let processed = 0;

    // Create a progress toast if available
    let toastId = null;
    try {
      if (typeof window !== 'undefined' && window.showToastWithProgress) {
        toastId = window.showToastWithProgress('Refreshing prices...', 0, total);
      }
    } catch (e) { /* ignore toast errors */ }

    for (const entry of entries) {
      try {
        const res = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(entry.scryfallId)}`);
        if (!res.ok) throw new Error(`Scryfall fetch failed: ${res.status}`);
        const data = await res.json();
        const prices = data.prices || null;
        // update localCollection optimistically
        try { if (window.localCollection && window.localCollection[entry.firestoreId]) window.localCollection[entry.firestoreId].prices = prices; } catch (e) { }
        results.push({ firestoreId: entry.firestoreId, prices });
      } catch (err) {
        console.warn('[refreshCollectionPrices] fetch error for', entry.scryfallId, err);
        results.push({ firestoreId: entry.firestoreId, prices: null, error: String(err) });
      }
      processed += 1;
      try {
        if (toastId && typeof window !== 'undefined' && window.updateToastProgress) {
          window.updateToastProgress(toastId, processed, total);
        }
      } catch (e) { /* ignore toast update errors */ }
    }

    // remove progress toast (it will be removed again in finally block if present)
    try { if (toastId && typeof window !== 'undefined' && window.removeToastById) window.removeToastById(toastId); } catch (e) { }

    // Persist updates to Firestore in batches of 100
    if (persist && typeof window.db !== 'undefined' && window.userId && window.appId) {
      try {
        const { writeBatch, doc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const batches = [];
        let batch = writeBatch(window.db);
        let ops = 0;
        for (const r of results) {
          if (!r.prices) continue; // skip empty results
          const ref = doc(window.db, `artifacts/${window.appId}/users/${window.userId}/collection`, r.firestoreId);
          batch.update(ref, { prices: r.prices });
          ops++;
          if (ops >= 100) {
            batches.push(batch.commit());
            batch = writeBatch(window.db);
            ops = 0;
          }
        }
        if (ops > 0) batches.push(batch.commit());
        if (batches.length > 0) await Promise.all(batches);
      } catch (err) {
        console.warn('[refreshCollectionPrices] Firestore persist error', err);
        showToast && showToast('Prices refreshed locally but failed to persist to Firestore.', 'warning');
      }
    }

    // Recompute KPI and re-render
    try { if (typeof window.renderPaginatedCollection === 'function') window.renderPaginatedCollection(); } catch (e) { console.warn('[refreshCollectionPrices] re-render failed', e); }

    showToast && showToast('Prices refreshed.', 'success');
  } catch (err) {
    console.error('[refreshCollectionPrices] unexpected error', err);
    showToast && showToast('Failed to refresh prices.', 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (text) text.textContent = 'Refresh Prices';
  }
}

// Expose legacy/global shims for backwards compatibility with inline scripts
// and other non-module code. Do not overwrite existing window handlers if
// they were already provided by delegators; only set missing ones.
(function exposeLegacyAPIs() {
  try {
    const safeAssign = (name, fn) => {
      try {
        if (typeof window[name] === 'undefined' || window[name] === null) {
          window[name] = fn;
        }
      } catch (e) {
        // ignore assignment errors (some environments may have frozen globals)
      }
    };

    safeAssign('addCollectionCardListeners', addCollectionCardListeners);
    safeAssign('addCollectionTableListeners', addCollectionTableListeners);
    safeAssign('handleCardSelection', handleCardSelection);
    safeAssign('renderCardConfirmationModal', renderCardConfirmationModal);
    safeAssign('renderCardVersions', renderCardVersions);
    safeAssign('renderPaginatedCollection', renderPaginatedCollection);
    safeAssign('renderCollectionCard', renderCollectionCard);
    safeAssign('initCollectionModule', initCollectionModule);
    safeAssign('installFloatingHeaderSync', installFloatingHeaderSync);
    safeAssign('refreshCollectionPrices', refreshCollectionPrices);

    // Additional helpers migrated from inline HTML
    safeAssign('toggleCardDetailsEditMode', toggleCardDetailsEditMode);
    safeAssign('saveCardDetails', saveCardDetails);
    safeAssign('renderCardDetailsModal', renderCardDetailsModal);
    safeAssign('selectCommander', selectCommander);
    safeAssign('openDeckCreationModal', openDeckCreationModal);
    safeAssign('searchForCard', searchForCard);
    safeAssign('searchForCommander', searchForCommander);
    safeAssign('filterCommanderCollectionList', filterCommanderCollectionList);

    // Mark the module as loaded for delegators that poll for availability
    try { window.__collection_module_loaded = true; } catch (e) { }
  } catch (err) {
    console.warn('[Collection] exposeLegacyAPIs failed', err);
  }
})();
