import {
  localDecks,
  localCollection,
  cardDeckAssignments,
  addCardToCollection,
  updateCardAssignments,
  deleteDeck as dataDeleteDeck
} from '../lib/data.js';
import { showToast, openModal, closeModal } from '../lib/ui.js';
import { openDeckSuggestionsModal } from './deckSuggestions.js';
import { db, appId } from '../main/index.js';
import {
  writeBatch,
  doc,
  updateDoc,
  runTransaction,
  deleteField,
  collection,
  getDoc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Helper: add a single card to deck by splitting the collection stack (creates a new collection doc)
async function addSingleCardWithSplit(uid, deckId, fid) {
  if (!uid) throw new Error('no uid');
  const collectionCard = (window.localCollection || localCollection)[fid];
  if (!collectionCard) throw new Error('collection card not found');
  const origRef = doc(db, `artifacts/${appId}/users/${uid}/collection`, fid);
  const newRef = doc(collection(db, `artifacts/${appId}/users/${uid}/collection`));
  const batch = writeBatch(db);
  const newCard = Object.assign({}, collectionCard, { count: 1, addedAt: new Date().toISOString() });
  delete newCard.firestoreId;
  batch.set(newRef, newCard);
  // If the original collection doc is assigned to any other deck, do NOT decrement/delete it
  // because that would remove cards from that other deck. Only split the stack when the
  // original doc is purely a collection item (not assigned elsewhere) or assigned to this deck.
  try {
    const assigns = (window.cardDeckAssignments || {})[fid] || [];
    const assignedElsewhere = assigns.some(a => a && a.deckId && a.deckId !== deckId);
    if (!assignedElsewhere) {
      if ((collectionCard.count || 0) > 1) batch.update(origRef, { count: (collectionCard.count || 0) - 1 }); else batch.delete(origRef);
    } else {
      // Leave original doc untouched; we still add a new dedicated collection doc for this deck
      console.debug('[addSingleCardWithSplit] source doc assigned to another deck, leaving original intact:', fid);
    }
  } catch (e) {
    // Defensive: if anything goes wrong, avoid touching the original doc
    console.warn('[addSingleCardWithSplit] assignment check failed, skipping decrement/delete for', fid, e);
  }
  const deckRef = doc(db, `artifacts/${appId}/users/${uid}/decks`, deckId);
  batch.set(deckRef, { cards: { [newRef.id]: { count: 1, name: collectionCard.name, type_line: collectionCard.type_line } } }, { merge: true });
  await batch.commit();
  return { newId: newRef.id, name: collectionCard.name, type_line: collectionCard.type_line };
}

// Helper: fetch server docs for newly-created collection ids and reconcile local placeholders
async function fetchAndReplacePlaceholders(mappings, deckId, uid) {
  if (!Array.isArray(mappings) || mappings.length === 0) return;
  for (const m of mappings) {
    try {
      const snap = await getDoc(doc(db, `artifacts/${appId}/users/${uid}/collection`, m.newId));
      if (snap && snap.exists()) {
        const data = snap.data();
        data.firestoreId = m.newId;
        if (!window.localCollection) window.localCollection = window.localCollection || {};
        window.localCollection[m.newId] = data;
        if (window.localCollection[m.newId]) delete window.localCollection[m.newId].pending;
        // Ensure deck local entry matches server
        if (!window.localDecks) window.localDecks = localDecks;
        const localDeck = window.localDecks[deckId] || localDecks[deckId];
        if (localDeck) {
          localDeck.cards = localDeck.cards || {};
          localDeck.cards[m.newId] = localDeck.cards[m.newId] || { count: data.count || 1, name: data.name, type_line: data.type_line };
        }
        try {
          console.log('[reconcile] fetched new collection doc from server', { newId: m.newId, dataPreview: { name: data.name, count: data.count, type_line: data.type_line } });
        } catch (e) { }
      }
    } catch (e) {
      console.warn('[reconcile] failed to fetch new collection doc', m.newId, e);
    }
  }
  try {
    updateCardAssignments();
    if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(deckId);
    try {
      // Log local deck.cards after reconciliation to help detect mismatches between optimistic and persisted state
      const localDeck = window.localDecks && window.localDecks[deckId];
      console.log('[reconcile] localDeck.cards keys after replace:', localDeck && localDeck.cards ? Object.keys(localDeck.cards) : null);
    } catch (e) { }
  } catch (e) { }
}

function getUserId() {
  return window.userId || (window.auth && window.auth.currentUser && window.auth.currentUser.uid) || null;
}

function isEditModeEnabled() {
  const wrapper = document.getElementById('app-wrapper');
  if (wrapper) return wrapper.classList.contains('edit-mode');
  return document.body && document.body.classList && document.body.classList.contains('edit-mode');
}

// Helper to show the app's styled confirmation modal and wire a single-use confirm handler
function showConfirmationModal(title, message, onConfirm) {
  try {
    if (typeof window.openModal === 'function' && document && document.getElementById && document.getElementById('confirmation-modal')) {
      // FIX: Close any other open modals first to prevent stacking
      try {
        if (typeof window.closeAllModals === 'function') {
          window.closeAllModals();
        } else {
          // Fallback: try to close common modals
          const commonModals = ['add-cards-to-deck-modal', 'import-data-modal', 'card-details-modal'];
          commonModals.forEach(modalId => {
            try {
              if (typeof window.closeModal === 'function') window.closeModal(modalId);
            } catch (e) { /* ignore */ }
          });
        }
      } catch (e) {
        console.debug('[showConfirmationModal] modal cleanup failed', e);
      }

      document.getElementById('confirmation-title').textContent = title;
      document.getElementById('confirmation-message').textContent = message;
      const btn = document.getElementById('confirm-action-btn');
      if (btn) {
        btn.onclick = async () => {
          try { if (typeof window.closeModal === 'function') window.closeModal('confirmation-modal'); } catch (e) { }
          try { await onConfirm(); } catch (e) { /* allow caller to handle errors */ }
          btn.onclick = null;
        };
      }
      try { window.openModal('confirmation-modal'); } catch (e) { /* fallback below */ }
    } else {
      // fallback to native confirm
      const ok = confirm(message);
      if (ok) return onConfirm();
    }
  } catch (e) {
    console.warn('[showConfirmationModal] failed, falling back to confirm()', e);
    const ok = confirm(message);
    if (ok) return onConfirm();
  }
}

// Helper: validate color identity subset (migrated from inline index-dev.html)
export function isColorIdentityValid(cardColors, commanderColors) {
  if (!cardColors || cardColors.length === 0) return true;
  const commanderSet = new Set(commanderColors || []);
  return (cardColors || []).every(c => commanderSet.has(c));
}

const deckChartInstances = {};

let currentViewMode = 'grid';

// Ensure Chart.js is loaded in the browser when needed. This dynamically
// injects a script tag pointing to a CDN and avoids re-loading if already in
// progress or present. Returns a Promise that resolves once Chart is available.
function ensureChartJsLoaded() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  if (window._mtg_chartjs_loading) return window._mtg_chartjs_loading;
  window._mtg_chartjs_loading = new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      // Use the UMD build which exposes a global `Chart` variable
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      script.async = true;
      script.onload = () => {
        // small nextTick to allow globals to register
        setTimeout(() => {
          if (typeof Chart !== 'undefined') resolve(); else reject(new Error('Chart failed to initialize'));
          window._mtg_chartjs_loading = null;
        }, 0);
      };
      script.onerror = (e) => { window._mtg_chartjs_loading = null; reject(new Error('Failed to load Chart.js')); };
      document.head.appendChild(script);
    } catch (err) {
      window._mtg_chartjs_loading = null;
      reject(err);
    }
  });
  return window._mtg_chartjs_loading;
}

export function renderDecklist(deckId, viewMode = null) {
  // Update or use persistent view mode
  if (viewMode) {
    currentViewMode = viewMode;
  } else {
    viewMode = currentViewMode;
  }

  const container = document.getElementById('decklist-container');
  if (!container) return;
  const deck = localDecks[deckId];
  if (!deck) return;
  const allCards = Object.keys(deck.cards || {}).map(firestoreId => {
    const cardData = localCollection[firestoreId];
    if (!cardData) return null;
    return { ...cardData, countInDeck: deck.cards[firestoreId].count };
  }).filter(Boolean);

  // --- Pre-calculate Available Foils ---
  const availableFoilsMap = {};
  try {
    const collectionValues = Object.values(localCollection || {});
    collectionValues.forEach(c => {
      if (c.finish === 'foil') {
        const assignments = cardDeckAssignments[c.firestoreId] || [];
        // Check if unassigned
        const isAssigned = assignments.some(a => a.deckId);
        if (!isAssigned) {
          availableFoilsMap[c.name] = true;
        }
      }
    });
  } catch (e) { console.error('Error calculating available foils', e); }

  // --- View Toggle Logic ---
  const gridBtn = document.getElementById('view-toggle-grid');
  const tableBtn = document.getElementById('view-toggle-table');
  if (gridBtn && tableBtn) {
    if (viewMode === 'grid') {
      gridBtn.classList.add('bg-indigo-600', 'text-white');
      gridBtn.classList.remove('text-gray-400', 'hover:text-white');
      tableBtn.classList.remove('bg-indigo-600', 'text-white');
      tableBtn.classList.add('text-gray-400', 'hover:text-white');
    } else {
      tableBtn.classList.add('bg-indigo-600', 'text-white');
      tableBtn.classList.remove('text-gray-400', 'hover:text-white');
      gridBtn.classList.remove('bg-indigo-600', 'text-white');
      gridBtn.classList.add('text-gray-400', 'hover:text-white');
    }
  }

  // --- Capture State ---
  const filterId = 'single-deck-filter';
  const groupById = 'single-deck-groupby';
  const currentFilter = document.getElementById(filterId)?.value || '';
  const currentGroup = document.getElementById(groupById)?.value || 'type_line';

  const filterHtml = `
    <div class="mb-4 flex flex-col sm:flex-row items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
      <div class="relative flex-1 w-full">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input id="${filterId}" placeholder="Search cards..." class="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
      </div>
      <select id="${groupById}" class="w-full sm:w-auto bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
        <option value="type_line">Group by Type</option>
        <option value="rarity">Group by Rarity</option>
        <option value="rating">Group by Rating</option>
        <option value="set_name">Group by Set</option>
        <option value="cmc">Group by Mana Value</option>
        <option value="">No Grouping</option>
      </select>
    </div>`;

  // --- Render Helpers ---
  function renderGridItem(card) {
    // Handle split cards / double-faced cards by checking card_faces if top-level image_uris is missing
    let img = card.image_uris?.normal || card.image_uris?.art_crop;
    if (!img && card.card_faces && card.card_faces.length > 0) {
      img = card.card_faces[0].image_uris?.normal || card.card_faces[0].image_uris?.art_crop;
    }
    img = img || 'https://placehold.co/250x350?text=No+Image';

    const price = card.finish === 'foil' ? (card.prices?.usd_foil || card.prices?.usd) : (card.prices?.usd || 'N/A');
    // Lookup AI suggestion metadata for this specific card on the deck (if present).
    // Suggestions are stored on the deck as `aiSuggestions` (each item should include firestoreId and rating/reason).
    let cardRating = '';
    let cardReason = '';
    try {
      const suggestions = (deck && (deck.aiSuggestions || (deck.aiBlueprint && deck.aiBlueprint.aiSuggestions))) || [];
      const match = suggestions && suggestions.find && suggestions.find(s => {
        if (!s) return false;
        // Only compare suggestion fields when present to avoid undefined === undefined matching
        if (s.firestoreId && (s.firestoreId === card.firestoreId || s.firestoreId === card.firestore_id)) return true;
        if (s.scryfallId && (s.scryfallId === card.id || s.scryfallId === card.scryfall_id)) return true;
        if (s.id && (s.id === card.id || s.id === card.scryfall_id)) return true;
        return false;
      });
      if (match) {
        cardRating = (typeof match.rating !== 'undefined' && match.rating !== null) ? match.rating : '';
        cardReason = match.reason || match.note || '';
      }
    } catch (e) {
      // Defensive: don't let suggestion lookup break rendering
      cardRating = '';
      cardReason = '';
    }
    const count = card.countInDeck || 1;
    // Decide whether to render the reason inline or only via tooltip
    const reasonText = (cardReason || '').trim();
    const reasonEsc = reasonText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Determine pill color by rating
    const ratingNum = (cardRating !== '' && !isNaN(Number(cardRating))) ? Number(cardRating) : null;
    let ratingPillClass = 'bg-gray-700 text-white';
    if (ratingNum !== null) {
      if (ratingNum >= 9) ratingPillClass = 'bg-green-500 text-white';
      else if (ratingNum >= 7) ratingPillClass = 'bg-yellow-400 text-black';
      else if (ratingNum >= 4) ratingPillClass = 'bg-amber-500 text-black';
      else ratingPillClass = 'bg-red-600 text-white';
    }
    return `
        <div class="relative group aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-lg bg-gray-900 transition-transform duration-200 hover:scale-105 hover:shadow-indigo-500/20 hover:z-10">
            <img src="${img}" alt="${card.name}" class="w-full h-full object-cover" loading="lazy">
            ${count > 1 ? `<div class="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md z-20">x${count}</div>` : ''}
            ${card.finish === 'foil'
        ? `<div class="absolute top-2 left-2 bg-yellow-500/80 text-yellow-100 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-20 backdrop-blur-sm border border-yellow-300/50">★</div>`
        : (availableFoilsMap[card.name] ? `<div class="absolute top-2 left-2 bg-gray-700/90 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-20 backdrop-blur-sm border border-yellow-500/30 cursor-help" title="Foil copy available in collection">☆</div>` : '')
      }
      <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col p-3">
                ${reasonText ? `<div class="mb-auto bg-black/80 backdrop-blur-md text-gray-100 text-xs leading-snug max-h-[60%] overflow-y-auto z-30 p-2 rounded border border-gray-700/50 shadow-lg">${reasonEsc}</div>` : '<div class="mb-auto"></div>'}
        <div class="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-200">
          <div class="font-bold text-white text-sm leading-tight mb-1">${card.name}</div>
                    <div class="flex flex-col gap-2 text-xs text-gray-300 mb-2">
                        <div class="flex justify-between items-center">
                          <span>${(card.type_line || '').split('—')[0].trim()}</span>
                          <span class="text-green-400 font-mono">${price !== 'N/A' ? '$' + price : ''}</span>
                        </div>
                        <div class="flex items-center">
                          <div class="inline-flex items-center">
                            <span class="inline-flex items-center ${ratingPillClass} text-xs font-semibold px-2 py-0.5 rounded">${cardRating !== '' ? `${cardRating}/10` : '—'}</span>
                          </div>
                        </div>
                    </div>
                    <div class="flex gap-2 justify-between">
                        <button class="view-card-details-btn flex-1 bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded text-xs font-medium transition-colors" data-firestore-id="${card.firestoreId}">View</button>
                        <button class="remove-card-from-deck-btn bg-red-900/50 hover:bg-red-600 text-red-200 hover:text-white p-1.5 rounded transition-colors" data-firestore-id="${card.firestoreId}" data-deck-id="${deckId}" title="Remove">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
  }

  function renderTable(cards) {
    if (!cards || cards.length === 0) return `<div class="text-gray-500 italic p-4 text-center bg-gray-800/50 rounded-lg">No cards in this section.</div>`;
    const rows = cards.map(card => {
      const type = (card.type_line || '').split(' — ')[0];
      const price = card.finish === 'foil' ? (card.prices?.usd_foil || card.prices?.usd) : (card.prices?.usd || 'N/A');
      return `
        <tr class="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors group" data-img="${card.image_uris?.normal || card.image_uris?.large || card.image_uris?.png || card.image_uris?.art_crop}">
          <td class="px-3 py-2 text-center font-mono text-indigo-300 font-bold">${card.countInDeck || 1}</td>
          <td class="px-3 py-2">
            <div class="flex items-center gap-3">
                <div class="relative w-8 h-8 rounded overflow-hidden hidden sm:block group-hover:scale-150 transition-transform origin-left z-10 shadow-sm">
                    <img src="${card.image_uris?.art_crop}" class="w-full h-full object-cover">
                </div>
                <div class="font-medium text-gray-200 group-hover:text-indigo-300 transition-colors cursor-pointer view-card-details-btn" data-firestore-id="${card.firestoreId}">${card.name}</div>
            </div>
          </td>
          <td class="px-3 py-2 text-gray-400 text-xs hidden sm:table-cell">${type}</td>
          <td class="px-3 py-2 text-center text-xs text-gray-500">${card.rarity ? card.rarity[0].toUpperCase() : '-'}</td>
          <td class="px-3 py-2 text-right font-mono text-xs text-gray-300">${price && price !== 'N/A' ? `$${Number(price).toFixed(2)}` : '-'}</td>
          <td class="px-3 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="remove-card-from-deck-btn text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-900/30 transition-colors" data-firestore-id="${card.firestoreId}" data-deck-id="${deckId}" title="Remove">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="overflow-hidden rounded-lg border border-gray-700/50 bg-gray-800/40">
        <table class="w-full text-sm text-left text-gray-300">
          <thead class="text-xs text-gray-500 uppercase bg-gray-900/50 border-b border-gray-700">
            <tr>
              <th class="px-3 py-2 text-center w-12">#</th>
              <th class="px-3 py-2">Card</th>
              <th class="px-3 py-2 hidden sm:table-cell">Type</th>
              <th class="px-3 py-2 text-center">R</th>
              <th class="px-3 py-2 text-right">$$</th>
              <th class="px-3 py-2 text-right w-10"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // --- Compose Content ---
  let filtered = allCards.filter(c => {
    if (!currentFilter) return true;
    const val = currentFilter.toLowerCase();
    try {
      return (c.name || '').toLowerCase().includes(val) || (c.set_name || '').toLowerCase().includes(val) || (c.type_line || '').toLowerCase().includes(val);
    } catch (e) { return true; }
  });
  filtered.sort((a, b) => a.name.localeCompare(b.name));

  // Enforce grouping by type for table view if no specific group is selected
  if (viewMode === 'table' && !currentGroup) {
    currentGroup = 'type_line';
  }

  let content = '';
  if (!currentGroup) {
    if (viewMode === 'grid') content = `<div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">${filtered.map(renderGridItem).join('')}</div>`;
    else content = renderTable(filtered);
  } else {
    const groups = filtered.reduce((acc, card) => {
      let key = 'Other';
      if (currentGroup === 'type_line') {
        const type = (card.type_line || '').toLowerCase();
        if (type.includes('land')) key = 'Lands';
        else if (type.includes('creature')) key = 'Creatures';
        else if (type.includes('instant')) key = 'Instants';
        else if (type.includes('sorcery')) key = 'Sorceries';
        else if (type.includes('artifact')) key = 'Artifacts';
        else if (type.includes('enchantment')) key = 'Enchantments';
        else if (type.includes('planeswalker')) key = 'Planeswalkers';
        else key = 'Other';
      } else if (currentGroup === 'cmc') {
        const cmc = Math.floor(card.cmc || 0);
        key = `${cmc} Mana`;
        if (cmc >= 7) key = '7+ Mana';
      } else if (currentGroup === 'rating') {
        // Bucket ratings into human-friendly groups using deck.aiSuggestions (if present)
        try {
          const suggestions = (deck && (deck.aiSuggestions || deck.aiBlueprint && deck.aiBlueprint.aiSuggestions)) || [];
          const match = suggestions && suggestions.find && suggestions.find(s => {
            if (!s) return false;
            if (s.firestoreId && (s.firestoreId === card.firestoreId || s.firestoreId === card.firestore_id)) return true;
            if (s.scryfallId && (s.scryfallId === card.id || s.scryfallId === card.scryfall_id)) return true;
            if (s.id && (s.id === card.id || s.id === card.scryfall_id)) return true;
            return false;
          });
          const rating = (match && typeof match.rating !== 'undefined' && match.rating !== null) ? Number(match.rating) : null;
          if (rating === null || Number.isNaN(rating)) {
            key = 'Unrated';
          } else if (rating >= 9) key = '9-10';
          else if (rating >= 7) key = '7-8';
          else if (rating >= 4) key = '4-6';
          else if (rating >= 1) key = '1-3';
          else key = '0';
          key = `Rating: ${key}`;
        } catch (e) {
          key = 'Rating: Unrated';
        }
      } else {
        key = card[currentGroup] || 'Other';
      }
      (acc[key] = acc[key] || []).push(card);
      return acc;
    }, {});

    const typeOrder = ['Creatures', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Planeswalkers', 'Lands', 'Other'];
    let groupKeys = Object.keys(groups);
    if (currentGroup === 'type_line') {
      groupKeys.sort((a, b) => {
        const ia = typeOrder.indexOf(a);
        const ib = typeOrder.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    } else if (currentGroup === 'rating') {
      // Order rating buckets highest to lowest
      const ratingOrder = ['Rating: 9-10', 'Rating: 7-8', 'Rating: 4-6', 'Rating: 1-3', 'Rating: 0', 'Rating: Unrated'];
      groupKeys.sort((a, b) => {
        const ia = ratingOrder.indexOf(a);
        const ib = ratingOrder.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    } else {
      groupKeys.sort();
    }

    content = groupKeys.map(k => {
      const cards = groups[k];
      const count = cards.reduce((s, c) => s + (c.countInDeck || 1), 0);
      let innerContent = (viewMode === 'grid')
        ? `<div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">${cards.map(renderGridItem).join('')}</div>`
        : renderTable(cards);
      return `
          <div class="mb-8">
              <div class="flex items-center gap-3 mb-3 border-b border-gray-700 pb-2">
                  <h4 class="text-lg font-bold text-indigo-300">${k}</h4>
                  <span class="bg-gray-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full">${count}</span>
              </div>
              ${innerContent}
          </div>`;
    }).join('');
  }

  container.innerHTML = filterHtml + content;

  // Re-attach listeners
  const fEl = document.getElementById(filterId);
  const gEl = document.getElementById(groupById);

  if (fEl) {
    fEl.value = currentFilter;
    fEl.addEventListener('keyup', (e) => { if (e.key === 'Enter') renderDecklist(deckId, viewMode); });
  }
  if (gEl) {
    gEl.value = currentGroup;
    gEl.addEventListener('change', () => renderDecklist(deckId, viewMode));
  }

  // Wire up View Details buttons explicitly to support 2-sided cards flip logic
  container.querySelectorAll('.view-card-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('[SingleDeck] View Details clicked', btn.dataset.firestoreId);
      const fid = btn.dataset.firestoreId;
      if (!fid) return;
      const card = (window.localCollection || localCollection)[fid];
      if (card) {
        if (typeof window.renderCardDetailsModal === 'function') {
          window.renderCardDetailsModal(card);
          if (typeof window.openModal === 'function') {
            window.openModal('card-details-modal');
          } else {
            // Fallback if openModal isn't global
            const m = document.getElementById('card-details-modal');
            if (m) m.classList.remove('hidden');
          }
        } else {
          console.error('[SingleDeck] renderCardDetailsModal not found on window');
        }
      } else {
        console.warn('[SingleDeck] Card not found in localCollection', fid);
      }
    });
  });
}

export async function renderManaCurveChart(manaCurveData) {
  // Ensure Chart.js is available before using it. If loading fails, bail silently
  // so the rest of the UI can still render.
  try {
    await ensureChartJsLoaded();
  } catch (err) {
    console.warn('[renderManaCurveChart] Chart.js not available:', err);
    return;
  }

  const canvas = document.getElementById('mana-curve-chart');
  const ctx = canvas?.getContext && canvas.getContext('2d');
  if (!ctx) return;
  const chartId = 'mana-curve-chart';
  try { if (deckChartInstances[chartId]) deckChartInstances[chartId].destroy(); } catch (e) { /* ignore */ }
  const labels = ['0', '1', '2', '3', '4', '5', '6', '7+'];
  const data = labels.map((label, index) => {
    const cmc = parseInt(label);
    if (index < 7) return manaCurveData[cmc] || 0;
    let sum = 0; for (let k in manaCurveData) if (parseInt(k) >= 7) sum += manaCurveData[k]; return sum;
  });

  try {
    deckChartInstances[chartId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Card Count', data, backgroundColor: 'rgba(79, 70, 229, 0.6)', borderColor: 'rgba(129, 140, 248, 1)', borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
    });
  } catch (e) {
    console.warn('[renderManaCurveChart] failed to instantiate chart', e);
  }
}

export function initSingleDeckModule() {
  window.renderDecklist = renderDecklist;
  window.renderManaCurveChart = renderManaCurveChart;
  window.attachSuggestionMetadataToDeck = attachSuggestionMetadataToDeck;
  window.renderDeckSuggestionSummary = renderDeckSuggestionSummary;
  window.deleteDeck = deleteDeck;
  window.handleAddSelectedCardsToDeck = handleAddSelectedCardsToDeck;
  window.batchAddCardsWithProgress = batchAddCardsWithProgress;
  console.log('[SingleDeck] Module initialized.');
}

// --- Single-deck UI flows migrated from inline HTML ---
export function openAddCardsToDeckModal(deckId) {
  const deck = window.localDecks?.[deckId] || localDecks[deckId];
  if (!deck) { showToast('Could not find the specified deck.', 'error'); return; }
  document.getElementById('add-cards-modal-title').textContent = 'Add Cards to "' + deck.name + '"';
  const commanderColors = deck.commander?.color_identity || ['W', 'U', 'B', 'R', 'G'];
  const tableBody = document.getElementById('add-cards-modal-table-body');
  const filterInput = document.getElementById('add-card-modal-filter');
  const jsonFilterInput = document.getElementById('add-card-modal-json-filter');
  const advancedSearchBtn = document.getElementById('add-cards-advanced-search-btn');
  const advancedSearchContainer = document.getElementById('add-cards-advanced-search-container');
  const tabsContainer = document.getElementById('add-cards-type-tabs');
  const previewToggle = document.getElementById('add-cards-show-preview-toggle');

  // Sidebar elements
  const sidebar = document.getElementById('add-cards-preview-sidebar');
  const sidebarImg = document.getElementById('add-cards-preview-img');
  const sidebarPlaceholder = document.getElementById('add-cards-preview-placeholder');

  if (filterInput) filterInput.value = '';
  if (jsonFilterInput) jsonFilterInput.value = '';

  // --- Advanced Search Toggle ---
  if (advancedSearchBtn && advancedSearchContainer) {
    advancedSearchBtn.onclick = () => {
      advancedSearchContainer.classList.toggle('hidden');
      advancedSearchBtn.classList.toggle('bg-gray-600');
      advancedSearchBtn.classList.toggle('text-white');
    };
  }

  // --- Preview Toggle Logic ---
  const isMobile = window.innerWidth < 768;
  const savedPreviewState = localStorage.getItem('mtg-add-cards-preview-enabled');
  let isPreviewEnabled = savedPreviewState !== null ? (savedPreviewState === 'true') : !isMobile;

  const modalContainer = document.querySelector('#add-cards-to-deck-modal > div');

  const updatePreviewVisibility = () => {
    if (sidebar && modalContainer) {
      if (isPreviewEnabled) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex', 'md:flex');
        // Expand modal to fit sidebar
        modalContainer.classList.remove('max-w-5xl');
        modalContainer.classList.add('max-w-[95vw]');
      } else {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex', 'md:flex');
        // Shrink modal to fit just the table
        modalContainer.classList.remove('max-w-[95vw]');
        modalContainer.classList.add('max-w-5xl');
      }
    }
  };

  if (previewToggle) {
    previewToggle.checked = isPreviewEnabled;
    previewToggle.onchange = (e) => {
      isPreviewEnabled = e.target.checked;
      localStorage.setItem('mtg-add-cards-preview-enabled', isPreviewEnabled);
      updatePreviewVisibility();
    };
  }
  updatePreviewVisibility();

  // --- Tabs Logic ---
  let activeTab = 'All';
  const cardTypes = ['All', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];

  // Helper to render mana cost with simple colors
  const renderManaCost = (manaCost) => {
    if (!manaCost) return '';
    return manaCost.replace(/\{([^}]+)\}/g, (match, symbol) => {
      symbol = symbol.toUpperCase();
      let colorClass = 'text-gray-400';
      let bgClass = 'bg-gray-700';
      if (symbol === 'W') { colorClass = 'text-yellow-100'; bgClass = 'bg-yellow-600/50'; }
      else if (symbol === 'U') { colorClass = 'text-blue-100'; bgClass = 'bg-blue-600/50'; }
      else if (symbol === 'B') { colorClass = 'text-gray-100'; bgClass = 'bg-gray-600/50'; }
      else if (symbol === 'R') { colorClass = 'text-red-100'; bgClass = 'bg-red-600/50'; }
      else if (symbol === 'G') { colorClass = 'text-green-100'; bgClass = 'bg-green-600/50'; }
      else if (!isNaN(parseInt(symbol))) { colorClass = 'text-gray-300'; bgClass = 'bg-gray-700'; }

      return '<span class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full ' + bgClass + ' ' + colorClass + ' mx-[1px]" title="{' + symbol + '}">' + symbol + '</span>';
    });
  };

  const updateSelectedCount = () => {
    const selectedCount = document.querySelectorAll('.add-card-checkbox:checked').length;
    const counter = document.getElementById('add-cards-selected-count'); if (counter) counter.textContent = selectedCount + ' card(s) selected';
  };

  const renderTable = () => {
    const filterText = (filterInput?.value || '').toLowerCase();
    const jsonFilterTextRaw = (jsonFilterInput?.value || '') || '';
    const jsonFilterText = jsonFilterTextRaw.trim().toLowerCase();
    const col = window.localCollection || localCollection;

    // Use window.cardDeckAssignments if imported one is empty (fallback)
    const assignments = window.cardDeckAssignments || cardDeckAssignments || {};

    const eligibleCards = Object.values(col)
      .filter(card => {
        // 1. Must have count > 0
        if ((card.count || 0) <= 0) return false;

        // 2. Must match color identity
        if (!isColorIdentityValid(card.color_identity, commanderColors)) return false;

        // 3. Must NOT be in any deck
        const cardAssignments = assignments[card.firestoreId] || [];
        if (cardAssignments.length > 0) return false;

        return true;
      })
      .filter(card => {
        // Tab Filter
        if (activeTab !== 'All') {
          if (!card.type_line.includes(activeTab)) return false;
        }

        // Name filter
        if (filterText && !(card.name || '').toLowerCase().includes(filterText)) return false;

        // JSON / full-text filter
        if (jsonFilterText) {
          try {
            const cardJson = JSON.stringify(card).toLowerCase();
            if (cardJson.includes(jsonFilterText)) return true;
            return false;
          } catch (e) { return false; }
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (eligibleCards.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">No eligible cards found (assigned cards are hidden).</td></tr>';
    } else {
      tableBody.innerHTML = eligibleCards.map(card => {
        const manaHtml = renderManaCost(card.mana_cost);
        // Oracle text truncation
        const fullOracleText = card.oracle_text || '';

        let finishBadge = '';
        if (card.finish === 'foil') finishBadge = '<span class="text-[10px] px-1.5 py-0.5 bg-yellow-900/40 text-yellow-200 rounded border border-yellow-700/50">Foil</span>';
        else if (card.finish === 'etched') finishBadge = '<span class="text-[10px] px-1.5 py-0.5 bg-green-900/40 text-green-200 rounded border border-green-700/50">Etched</span>';
        else finishBadge = '<span class="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded border border-gray-600">Non-Foil</span>';

        const setInfo = '<span class="text-[10px] text-gray-500 bg-gray-800 px-1 rounded border border-gray-700">' + (card.set || '').toUpperCase() + ' #' + (card.collector_number || '') + '</span>';

        // Image for preview
        const imgUrl = card.image_uris?.normal || card.image_uris?.large || card.image_uris?.small || '';

        return '<tr class="border-b border-gray-700 hover:bg-gray-700/50 transition-colors group/row cursor-pointer" data-img="' + imgUrl + '">' +
          '<td class="p-2 sm:p-4 w-10 text-center">' +
          '<div class="flex items-center justify-center">' +
          '<input type="checkbox" class="add-card-checkbox w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-600 ring-offset-gray-800 focus:ring-2" value="' + card.firestoreId + '">' +
          '</div>' +
          '</td>' +
          '<td class="px-2 py-2 sm:px-6 sm:py-3 font-medium text-white w-[30%]">' +
          '<div class="flex flex-col gap-0.5">' +
          '<span class="text-indigo-300 font-bold truncate">' + card.name + ' ' + manaHtml + '</span>' +
          '<span class="text-xs text-gray-400 truncate">' + card.type_line + '</span>' +
          '<div class="mt-0.5">' + setInfo + '</div>' +
          '</div>' +
          '</td>' +
          '<td class="px-2 py-2 sm:px-6 sm:py-3 text-gray-300 hidden sm:table-cell w-auto whitespace-normal" title="' + fullOracleText.replace(/"/g, '&quot;') + '">' +
          '<div class="line-clamp-3 text-xs leading-relaxed">' +
          fullOracleText +
          '</div>' +
          '</td>' +
          '<td class="px-2 py-2 sm:px-6 sm:py-3 text-center whitespace-nowrap w-[15%]">' +
          finishBadge +
          '</td>' +
          '<td class="px-2 py-2 sm:px-6 sm:py-3 text-center w-[10%]">' +
          '<span class="bg-gray-700 text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full">' + (card.count || 1) + '</span>' +
          '</td>' +
          '</tr>';
      }).join('');

      // Add hover listeners for sidebar preview
      tableBody.querySelectorAll('tr[data-img]').forEach(row => {
        row.addEventListener('mouseenter', (e) => {
          if (!isPreviewEnabled || !sidebarImg) return;
          const img = row.dataset.img;
          if (img) {
            sidebarImg.src = img;
            sidebarImg.classList.remove('opacity-0');
            if (sidebarPlaceholder) sidebarPlaceholder.classList.add('hidden');
          }
        });
      });
    }
    updateSelectedCount();
  };

  const renderTabs = () => {
    if (!tabsContainer) return;
    tabsContainer.innerHTML = cardTypes.map(type => {
      const isActive = type === activeTab;
      const activeClasses = 'bg-indigo-600 text-white border-indigo-500';
      const inactiveClasses = 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-gray-200';
      return '<button class="px-3 py-1 text-xs font-medium rounded-full border transition-colors ' + (isActive ? activeClasses : inactiveClasses) + '" data-type="' + type + '">' + type + '</button>';
    }).join('');

    tabsContainer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.type;
        renderTabs();
        renderTable();
      });
    });
  };
  renderTabs();

  if (filterInput) filterInput.oninput = renderTable;
  if (jsonFilterInput) jsonFilterInput.oninput = renderTable;
  if (tableBody) tableBody.addEventListener('change', updateSelectedCount);

  const selectAll = document.getElementById('add-cards-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      document.querySelectorAll('.add-card-checkbox').forEach(cb => cb.checked = e.target.checked);
      updateSelectedCount();
    });
  }

  const confirmBtn = document.getElementById('confirm-add-cards-to-deck-btn');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const selectedIds = Array.from(document.querySelectorAll('.add-card-checkbox:checked')).map(cb => cb.value);
      handleAddSelectedCardsToDeck(deckId, selectedIds);
    };
  }

  renderTable();
  openModal('add-cards-to-deck-modal');
}

export async function handleAddSelectedCardsToDeck(deckId, firestoreIds) {
  if (!deckId || !firestoreIds || firestoreIds.length === 0) { showToast('No cards selected to add.', 'warning'); return; }
  const deck = window.localDecks?.[deckId] || localDecks[deckId];
  if (!deck) { showToast('Deck not found.', 'error'); return; }
  const commanderColors = deck.commander?.color_identity || [];
  const userId = getUserId(); if (!userId) { showToast('User not signed in.', 'error'); return; }

  for (const fid of firestoreIds) {
    let collectionCard = (window.localCollection || localCollection)[fid];
    if (!collectionCard) {
      try {
        const snap = await getDoc(doc(db, 'artifacts/' + appId + '/users/' + userId + '/collection', fid));
        if (snap && snap.exists()) {
          const data = snap.data(); data.firestoreId = fid;
          if (!window.localCollection) window.localCollection = window.localCollection || {};
          window.localCollection[fid] = data;
          collectionCard = data;
        }
      } catch (e) {
        console.warn('[handleAddSelectedCardsToDeck] prefetch failed for', fid, e);
      }
    }

    if (!collectionCard) { showToast('Card not found in collection: ' + fid, 'error'); return; }
    if (!isColorIdentityValid(collectionCard.color_identity, commanderColors)) { showToast('Card "' + collectionCard.name + '" is not legal with this commander (color identity mismatch).', 'error'); return; }
  }

  for (const fid of firestoreIds) {
    const assigns = window.cardDeckAssignments?.[fid] || [];
    if (assigns.length > 0) {
      const assignment = assigns[0]; if (assignment.deckId !== deckId) { showToast('Card "' + (window.localCollection || localCollection)[fid].name + '" is already in another deck.', 'error'); return; }
    }
  }

  const batch = writeBatch(db);
  const createdMappings = [];
  const skippedIds = [];
  for (const fid of firestoreIds) {
    const collectionCard = (window.localCollection || localCollection)[fid];
    if (!collectionCard || collectionCard.count < 1) { console.warn('Skipping ' + fid); skippedIds.push(fid); continue; }

    const origCollectionRef = doc(db, 'artifacts/' + appId + '/users/' + userId + '/collection', fid);
    const newCollectionRef = doc(collection(db, 'artifacts/' + appId + '/users/' + userId + '/collection'));
    const newCardDoc = Object.assign({}, collectionCard, { count: 1, addedAt: new Date().toISOString() });
    delete newCardDoc.firestoreId;
    batch.set(newCollectionRef, newCardDoc);
    createdMappings.push({ orig: fid, newId: newCollectionRef.id, name: collectionCard.name, type_line: collectionCard.type_line });

    try {
      const assigns = (window.cardDeckAssignments || {})[fid] || [];
      const assignedElsewhere = assigns.some(a => a && a.deckId && a.deckId !== deckId);
      if (!assignedElsewhere) {
        if ((collectionCard.count || 0) > 1) {
          batch.update(origCollectionRef, { count: (collectionCard.count || 0) - 1 });
        } else {
          batch.delete(origCollectionRef);
        }
      } else {
        console.debug('[handleAddSelectedCardsToDeck] source doc assigned to other deck; not decrementing:', fid);
      }
    } catch (e) {
      console.warn('[handleAddSelectedCardsToDeck] assignment check failed, skipping decrement/delete for', fid, e);
    }

    const deckRef = doc(db, 'artifacts/' + appId + '/users/' + userId + '/decks', deckId);
    const cardInDeck = deck.cards?.[newCollectionRef.id];
    if (!cardInDeck) {
      batch.set(deckRef, { cards: { [newCollectionRef.id]: { count: 1, name: collectionCard.name, type_line: collectionCard.type_line } } }, { merge: true });
    } else {
      batch.update(deckRef, { ['cards.' + newCollectionRef.id + '.count']: (cardInDeck.count || 0) + 1 });
    }
  }

  try {
    await batch.commit();
    const addedCount = createdMappings.length;
    if (skippedIds.length > 0) {
      showToast('Added ' + addedCount + ' card(s) to ' + deck.name + '. ' + skippedIds.length + ' card(s) were skipped (not in collection).', 'warning');
    } else {
      showToast('Added ' + addedCount + ' card(s) to ' + deck.name + '.', 'success');
    }
    try {
      if (!window.localDecks) window.localDecks = localDecks;
      if (!window.localCollection) window.localCollection = localCollection;
      const localDeck = window.localDecks[deckId] || localDecks[deckId];
      localDeck.cards = localDeck.cards || {};
      createdMappings.forEach(({ orig, newId, name, type_line }) => {
        const collectionCard = (window.localCollection || localCollection)[orig];
        if (!collectionCard) return;

        // Clone card data before mutating the original collection entry to ensure clean state for new entry
        const newCardData = Object.assign({}, collectionCard, { count: 1, firestoreId: newId, pending: true, name, type_line });

        if ((collectionCard.count || 0) > 1) {
          collectionCard.count = Math.max((collectionCard.count || 0) - 1, 0);
          window.localCollection[newId] = newCardData;
          if (localDeck.cards[newId]) localDeck.cards[newId].count = (localDeck.cards[newId].count || 0) + 1; else localDeck.cards[newId] = { count: 1, name, type_line };
          try { console.log('[handleAdd] optimistic localCollection assignment (split)', { orig, newId, name, type_line, remainingOrigCount: collectionCard.count, placeholder: window.localCollection[newId] }); } catch (e) { }
        } else {
          delete window.localCollection[orig];
          window.localCollection[newId] = newCardData;
          if (localDeck.cards[newId]) localDeck.cards[newId].count = (localDeck.cards[newId].count || 0) + 1; else localDeck.cards[newId] = { count: 1, name, type_line };
          try { console.log('[handleAdd] optimistic localCollection assignment (moved)', { orig, newId, name, type_line, placeholder: window.localCollection[newId] }); } catch (e) { }
        }
      });
      updateCardAssignments();
      if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(deckId);

      // Refresh prices for each newly-created collection entry so the UI shows
      // per-card split / price immediately rather than waiting for a later batch refresh.
      try {
        if (typeof window.refreshCollectionPriceForId === 'function') {
          for (const m of createdMappings) {
            try {
              await window.refreshCollectionPriceForId(m.newId, { persist: false });
            } catch (e) { console.warn('[handleAddSelectedCardsToDeck] per-card refresh failed for', m.newId, e); }
          }
        }
      } catch (e) { /* non-fatal */ }
    } catch (e) { console.warn('Local optimistic update failed:', e); }
    try { await fetchAndReplacePlaceholders(createdMappings, deckId, userId); } catch (e) { console.warn('Reconcile after add failed', e); }
    closeModal('add-cards-to-deck-modal');
  } catch (error) {
    console.error('Error adding cards to deck:', error); showToast('Failed to add cards to deck.', 'error');
  }
}

// Batch-add cards to deck with progress toasts. Uses the same logic as handleAddSelectedCardsToDeck
export async function batchAddCardsWithProgress(deckId, firestoreIds, sourceMap = null) {
  if (!deckId || !firestoreIds || firestoreIds.length === 0) return;
  const deck = window.localDecks?.[deckId] || localDecks[deckId];
  if (!deck) return;
  const uid = getUserId(); if (!uid) { showToast('User not signed in.', 'error'); return; }

  const batchSize = 200;
  let processed = 0;
  const failedIds = [];
  const virtualIdMap = new Map();
  let toastId = null;

  try {
    toastId = showToastWithProgress('Adding cards to deck...', 'info', 0, firestoreIds.length);

    for (let i = 0; i < firestoreIds.length; i += batchSize) {
      const chunk = firestoreIds.slice(i, i + batchSize);

      // Prefetch and handle virtual cards - PARALLELIZED for speed
      const prefetchPromises = chunk.map(async (fid) => {
        const existing = (window.localCollection || localCollection)[fid];
        if (!existing) {
          const virtualCard = sourceMap ? sourceMap[fid] : null;
          if (virtualCard && virtualCard.isVirtual) {
            try {
              const newCollectionRef = doc(collection(db, 'artifacts/' + appId + '/users/' + uid + '/collection'));
              const cardData = {
                name: virtualCard.name,
                type_line: virtualCard.type_line,
                cmc: virtualCard.cmc || 0,
                color_identity: virtualCard.color_identity || [],
                count: 1,
                addedAt: new Date().toISOString(),
                image_uris: virtualCard.image_uris || {}
              };
              await setDoc(newCollectionRef, cardData);
              if (!window.localCollection) window.localCollection = {};
              window.localCollection[newCollectionRef.id] = { ...cardData, firestoreId: newCollectionRef.id };
              virtualIdMap.set(fid, newCollectionRef.id);
              console.log('[batchAdd] Created collection doc for virtual card ' + virtualCard.name + ': ' + fid + ' -> ' + newCollectionRef.id);
            } catch (e) {
              console.warn('[batchAdd] failed to create collection doc for virtual card', fid, e);
            }
          } else {
            try {
              const snap = await getDoc(doc(db, 'artifacts/' + appId + '/users/' + uid + '/collection', fid));
              if (snap && snap.exists()) {
                const data = snap.data(); data.firestoreId = fid;
                if (!window.localCollection) window.localCollection = {};
                window.localCollection[fid] = data;
              }
            } catch (e) {
              console.warn('[batchAdd] prefetch failed for', fid, e);
            }
          }
        }
      });
      await Promise.all(prefetchPromises);

      const mappedChunk = chunk.map(fid => virtualIdMap.get(fid) || fid);

      // Create reverse mapping from real ID to original ID for sourceMap lookup
      const reverseMap = new Map();
      chunk.forEach((origId, idx) => {
        const realId = mappedChunk[idx];
        reverseMap.set(realId, origId);
      });

      const filteredChunk = (mappedChunk || []).filter(fid => {
        try {
          const assigns = (window.cardDeckAssignments || {})[fid] || [];
          return !(assigns.length > 0 && assigns.some(a => a && a.deckId && a.deckId !== deckId));
        } catch (e) { return true; }
      });

      // Log filtering results for debugging: what was mapped, what was filtered out
      const skippedInChunk = mappedChunk.filter(fid => !filteredChunk.includes(fid));
      try {
        console.log('[batchAdd] chunk mapping summary', { mappedChunk, filteredChunk, skippedInChunk });
      } catch (e) { console.warn('[batchAdd] failed to log chunk mapping summary', e); }
      if (skippedInChunk.length) {
        failedIds.push(...skippedInChunk);
        console.warn('[batchAdd] skipping ids assigned to other decks:', skippedInChunk);
      }

      const newIdsForChunk = [];
      const makeBatch = () => {
        const b = writeBatch(db);
        for (const fid of filteredChunk) {
          const collectionCard = (window.localCollection || localCollection)[fid];
          if (!collectionCard) continue;

          // Determine suggested count from sourceMap (default to 1)
          const originalId = reverseMap.get(fid) || fid;
          const sourceItem = sourceMap && sourceMap[originalId];
          // Use suggestedAddCount if present (generic), fallback to count if isAutoBasicLand (legacy), else 1
          let suggestedCount = 1;
          if (sourceItem) {
            if (sourceItem.suggestedAddCount) suggestedCount = sourceItem.suggestedAddCount;
            else if (sourceItem.isAutoBasicLand && sourceItem.count) suggestedCount = sourceItem.count;
          }

          const deckRef = doc(db, 'artifacts/' + appId + '/users/' + uid + '/decks', deckId);
          const origCollectionRef = doc(db, 'artifacts/' + appId + '/users/' + uid + '/collection', fid);
          const newCollectionRef = doc(collection(db, 'artifacts/' + appId + '/users/' + uid + '/collection'));

          // Create new card doc with the correct count
          const newCardDoc = Object.assign({}, collectionCard, { count: suggestedCount, addedAt: new Date().toISOString() });
          delete newCardDoc.firestoreId;
          b.set(newCollectionRef, newCardDoc);
          newIdsForChunk.push({ orig: fid, newId: newCollectionRef.id, name: collectionCard.name, type_line: collectionCard.type_line, count: suggestedCount });

          try {
            const assigns = (window.cardDeckAssignments || {})[fid] || [];
            const assignedElsewhere = assigns.some(a => a && a.deckId && a.deckId !== deckId);
            if (!assignedElsewhere) {
              // Decrement by the amount we are "moving" (suggestedCount)
              if ((collectionCard.count || 0) > suggestedCount) {
                b.update(origCollectionRef, { count: (collectionCard.count || 0) - suggestedCount });
              } else {
                b.delete(origCollectionRef);
              }
            }
          } catch (e) {
            console.warn('[batchAdd] assignment check failed for', fid, e);
          }

          b.set(deckRef, { cards: { [newCollectionRef.id]: { count: suggestedCount, name: collectionCard.name, type_line: collectionCard.type_line } } }, { merge: true });
        }
        return b;
      };

      let attempts = 0;
      const maxAttempts = 3;
      let chunkCommitted = false;
      while (attempts < maxAttempts) {
        const batch = makeBatch();
        try {
          await batch.commit();
          processed += chunk.length;
          // After a successful commit, read back the deck doc to verify server-side persistence
          try {
            const deckRef = doc(db, 'artifacts/' + appId + '/users/' + uid + '/decks', deckId);
            const deckSnap = await getDoc(deckRef);
            if (deckSnap && deckSnap.exists()) {
              const serverDeck = deckSnap.data();
              try { console.log('[batchAdd] server deck doc cards keys after commit:', Object.keys(serverDeck.cards || {})); } catch (e) { }
            } else {
              console.warn('[batchAdd] deck doc not found immediately after commit');
            }
          } catch (e) { console.warn('[batchAdd] failed to read deck doc after commit', e); }
          updateToastProgress(toastId, Math.min(processed, firestoreIds.length), firestoreIds.length);
          chunkCommitted = true;
          break;
        } catch (err) {
          attempts += 1;
          console.warn('[batchAdd] commit attempt ' + attempts + ' failed', err);
          // FIX: Add more detailed error logging to help diagnose partial failures
          if (err.message) console.warn('[batchAdd] Error message:', err.message);
          if (err.code) console.warn('[batchAdd] Error code:', err.code);

          if (attempts >= maxAttempts) {
            console.error('[batchAdd] chunk commit failed after ' + attempts + ' attempts. Chunk size: ' + chunk.length + '. Continuing with next chunk.', chunk);
            // FIX: Log which cards were in the failed chunk for debugging
            console.error('[batchAdd] Failed chunk card IDs:', filteredChunk);
            break;
          }
          await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempts)));
        }
      }

      if (!chunkCommitted) {
        console.warn('[batchAdd] skipping optimistic update for failed chunk (size: ' + chunk.length + ')');
        failedIds.push(...chunk);
        continue;
      }

      try {
        const localDeck = window.localDecks[deckId] || localDecks[deckId];
        localDeck.cards = localDeck.cards || {};
        (newIdsForChunk || []).forEach(mapping => {
          const { orig, newId, name, type_line } = mapping;
          const collectionCard = (window.localCollection || localCollection)[orig];
          if (collectionCard) {
            if ((collectionCard.count || 0) > 1) {
              collectionCard.count = Math.max((collectionCard.count || 0) - 1, 0);
            } else {
              delete window.localCollection[orig];
            }
          }

          // FIX: Get the count from sourceMap to properly handle cards that should have count > 1
          const originalId = reverseMap.get(orig) || orig;
          const suggestedCount = sourceMap && sourceMap[originalId] ? (sourceMap[originalId].count || 1) : 1;

          window.localCollection[newId] = Object.assign({}, collectionCard || {}, { count: 1, firestoreId: newId, pending: true, name, type_line });
          // Apply the correct count to the deck card entry
          if (localDeck.cards[newId]) {
            localDeck.cards[newId].count = (localDeck.cards[newId].count || 0) + suggestedCount;
          } else {
            localDeck.cards[newId] = { count: suggestedCount, name, type_line };
          }
          // Log optimistic placeholder assignment so we can trace UI not updating
          try { console.log('[batchAdd] optimistic localCollection assignment', { newId, orig, name, type_line, suggestedCount, placeholder: window.localCollection[newId] }); } catch (e) { }
        });
        updateCardAssignments();
        if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(deckId);
      } catch (e) { console.warn('Local optimistic update failed:', e); }

      try {
        // Refresh prices for each newly-created collection entry so the UI reflects
        // the split and shows prices immediately. We keep persistence off here to
        // avoid extra writes during a large batch; these will be picked up later
        // by a full price refresh if desired.
        if (typeof window.refreshCollectionPriceForId === 'function') {
          for (const m of newIdsForChunk) {
            try {
              await window.refreshCollectionPriceForId(m.newId, { persist: false });
            } catch (e) { console.warn('[batchAdd] per-card refresh failed for', m.newId, e); }
          }
        }
        await fetchAndReplacePlaceholders(newIdsForChunk, deckId, uid);
      } catch (e) { console.warn('[batchAdd] reconcile failed for chunk', e); }
    }

    const finalFailed = [];
    if (failedIds.length > 0) {
      const retryMax = 3;
      for (const fid of failedIds) {
        let attempts = 0;
        let ok = false;
        while (attempts < retryMax && !ok) {
          attempts += 1;
          try {
            const res = await addSingleCardWithSplit(uid, deckId, fid);
            await fetchAndReplacePlaceholders([{ orig: fid, newId: res.newId, name: res.name, type_line: res.type_line }], deckId, uid);
            ok = true;
          } catch (err) {
            console.warn('[batchAdd][retry] attempt ' + attempts + ' for ' + fid + ' failed', err);
            await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempts)));
          }
        }
        if (!ok) finalFailed.push(fid);
      }
    }

    const allFailed = finalFailed.length > 0 ? finalFailed : [];
    if (failedIds.length === 0 && allFailed.length === 0) {
      showToast('All selected cards added to deck.', 'success');
    } else {
      const report = allFailed.length > 0 ? allFailed : failedIds;
      console.error('[batchAddCardsWithProgress] some cards failed to persist', report);
      window.__lastBatchAddFailedIds = report;
      showToast('Added most cards to deck; ' + report.length + ' card(s) failed to persist. See console.', 'warning');
    }
  } catch (err) {
    console.error('[batchAddCardsWithProgress] failed', err);
    showToast('Failed to add some cards to deck. See console.', 'error');
  } finally {
    if (toastId) removeToastById(toastId);
  }
}

// Save suggestion metadata onto the deck object (in-memory). This can be expanded to persist to Firestore.
export function attachSuggestionMetadataToDeck(deckId, suggestions) {
  if (!deckId || !suggestions) return;
  const deck = window.localDecks?.[deckId] || localDecks[deckId];
  if (!deck) return;
  // Optimistically update local state
  deck.aiSuggestions = deck.aiSuggestions || [];
  suggestions.forEach(s => {
    const existing = deck.aiSuggestions.find(x => x.firestoreId === s.firestoreId);
    if (existing) Object.assign(existing, s); else deck.aiSuggestions.push(Object.assign({}, s));
  });
  try { renderDeckSuggestionSummary(deckId); } catch (e) { }

  // Persist to Firestore under the deck document for the current user
  return (async () => {
    try {
      const uid = getUserId();
      if (!uid) { console.debug('[attachSuggestionMetadataToDeck] no user signed in, skipping persistence'); return; }
      // Show saving status in modal if present
      try { const statusEl = document.getElementById('deck-suggestions-save-status'); if (statusEl) statusEl.innerHTML = '<span class="tiny-spinner"></span>Saving...'; } catch (e) { }
      const deckRef = doc(db, 'artifacts/' + appId + '/users/' + uid + '/decks', deckId);
      // Write only the aiSuggestions field to avoid clobbering other data
      await updateDoc(deckRef, { aiSuggestions: deck.aiSuggestions });
      try { const statusEl = document.getElementById('deck-suggestions-save-status'); if (statusEl) statusEl.textContent = 'Saved'; const retry = document.getElementById('deck-suggestions-save-retry-btn'); if (retry) retry.classList.add('hidden'); } catch (e) { }
      // Optionally refresh localDecks from server copy for consistency
      try {
        const snap = await getDoc(deckRef);
        if (snap && snap.exists()) {
          const serverDeck = snap.data();
          // merge server aiSuggestions back into local optimistic copy
          deck.aiSuggestions = serverDeck.aiSuggestions || deck.aiSuggestions;
          try { renderDeckSuggestionSummary(deckId); } catch (e) { }
        }
      } catch (e) { /* non-fatal */ }
    } catch (err) {
      console.error('[attachSuggestionMetadataToDeck] failed to persist', err);
      showToast('Failed to save AI suggestion metadata. It will remain local until you refresh.', 'warning');
      try { const statusEl = document.getElementById('deck-suggestions-save-status'); if (statusEl) statusEl.textContent = 'Save failed'; const retry = document.getElementById('deck-suggestions-save-retry-btn'); if (retry) retry.classList.remove('hidden'); } catch (e) { }
      // Re-throw so callers (who expect a Promise) can handle errors
      throw err;
    }
  })();
}

export function renderDeckSuggestionSummary(deckId) {
  const container = document.getElementById('deck-suggestion-summary');
  if (!container) return;
  const deck = window.localDecks?.[deckId] || localDecks[deckId];
  if (!deck || !deck.aiSuggestions || deck.aiSuggestions.length === 0) {
    container.innerHTML = '<div class="text-sm text-gray-400">No AI suggestions</div>';
    return;
  }
  const lines = deck.aiSuggestions.slice(0, 5).map(s => '<div class="text-sm text-gray-200">' + (s.rating ? '<strong>' + s.rating + '/10</strong> ' : '') + (s.name || (window.localCollection || localCollection)[s.firestoreId]?.name || 'Card') + ' - ' + escapeHtml((s.reason || s.note || '').slice(0, 120)) + '</div>');
  container.innerHTML = '<div class="space-y-1">' + lines.join('') + '</div>';
}

export async function deleteDeck(deckId, alsoDeleteCards) {
  console.log('[deleteDeck] Called with', { deckId, alsoDeleteCards });
  const userId = getUserId();
  if (!deckId) {
    const modal = document.getElementById('deck-delete-options-modal');
    if (modal) {
      const btn = modal.querySelector('#delete-deck-only-btn') || modal.querySelector('#delete-deck-and-cards-btn');
      deckId = btn && (btn.dataset.deckId || btn.dataset.id) ? (btn.dataset.deckId || btn.dataset.id) : deckId;
    }
    if (!deckId && window.views && window.views.singleDeck) deckId = window.views.singleDeck.dataset.deckId;
  }
  console.log('[deleteDeck] Resolved deckId=', deckId, 'userId=', userId);
  if (!deckId) { showToast('Deck not found.', 'error'); return; }
  try {
    console.log('[deleteDeck] Calling dataDeleteDeck...');
    await dataDeleteDeck(deckId, !!alsoDeleteCards, getUserId());
    console.log('[deleteDeck] Delete successful');
    showToast('Deck deleted successfully.', 'success');
    if (window.views && window.views.singleDeck && window.views.singleDeck.dataset.deckId === deckId) {
      // Use router for navigation
      import('../main/router.js').then(({ router }) => router.navigate('/decks'));
    }
    closeModal('deck-delete-options-modal');
  } catch (error) {
    console.error('[deleteDeck] Error deleting deck:', error); showToast('Failed to delete deck.', 'error');
  }
}

export function addSingleDeckListeners(deckId) {
  const addBtn = document.getElementById('add-cards-to-deck-btn'); if (addBtn) addBtn.addEventListener('click', () => openAddCardsToDeckModal(deckId));

  // View Toggles
  const gridBtn = document.getElementById('view-toggle-grid');
  const tableBtn = document.getElementById('view-toggle-table');

  if (gridBtn) {
    gridBtn.onclick = () => {
      console.log('[DeckView] Grid toggle clicked');
      renderDecklist(deckId, 'grid');
    };
  } else {
    console.warn('[DeckView] Grid toggle button not found');
  }

  if (tableBtn) {
    tableBtn.onclick = () => {
      console.log('[DeckView] Table toggle clicked');
      renderDecklist(deckId, 'table');
    };
  } else {
    console.warn('[DeckView] Table toggle button not found');
  }

  document.querySelector('#single-deck-view .view-card-details-btn')?.addEventListener('click', (e) => { const fid = e.currentTarget.dataset.firestoreId; const card = (window.localCollection || localCollection)[fid]; if (card) { if (typeof window.renderCardDetailsModal === 'function') window.renderCardDetailsModal(card); if (typeof window.openModal === 'function') window.openModal('card-details-modal'); } });
  document.getElementById('deck-delete-btn')?.addEventListener('click', (e) => { const id = e.currentTarget.dataset.deckId; if (typeof window.openDeckDeleteOptions === 'function') window.openDeckDeleteOptions(id); });
  document.getElementById('ai-suggestions-btn')?.addEventListener('click', () => openDeckSuggestionsModal(deckId));
  // Render suggestion summary if present
  try { renderDeckSuggestionSummary(deckId); } catch (e) { }
  document.getElementById('export-deck-btn')?.addEventListener('click', (e) => { const id = e.currentTarget.dataset.deckId; if (typeof window.exportDeck === 'function') window.exportDeck(id); });
  document.getElementById('view-strategy-btn')?.addEventListener('click', () => { const deck = (window.localDecks || localDecks)[deckId]; if (deck && deck.aiBlueprint && typeof window.renderAiBlueprintModal === 'function') { window.renderAiBlueprintModal(deck.aiBlueprint, deck.name, true); window.openModal('ai-blueprint-modal'); } });
  // Delegated handlers for decklist actions (view, remove). Using delegation so rows can be re-rendered.
  const decklistContainer = document.getElementById('decklist-container');
  if (decklistContainer && !decklistContainer._delegatedHandler) {
    decklistContainer.addEventListener('click', (e) => {
      const viewBtn = e.target.closest && e.target.closest('.view-card-details-btn');
      if (viewBtn) {
        const fid = viewBtn.dataset.firestoreId;
        const card = (window.localCollection || localCollection)[fid];
        if (card) {
          if (typeof window.renderCardDetailsModal === 'function') window.renderCardDetailsModal(card);
          if (typeof window.openModal === 'function') window.openModal('card-details-modal');
        }
        return;
      }
      const remBtn = e.target.closest && e.target.closest('.remove-card-from-deck-btn');
      if (remBtn) {
        const fid = remBtn.dataset.firestoreId;
        const did = remBtn.dataset.deckId || deckId;
        if (!isEditModeEnabled()) { showToast && showToast('Enable Edit Mode to remove cards from a deck.', 'warning'); return; }
        // Styled confirmation modal
        showConfirmationModal('Remove card from deck?', 'Remove this card from the deck?', async () => {
          await removeCardFromDeck(did, fid);
        });
        return;
      }
      const returnBtn = e.target.closest && e.target.closest('.return-card-to-collection-btn');
      if (returnBtn) {
        const fid = returnBtn.dataset.firestoreId;
        const did = returnBtn.dataset.deckId || deckId;
        if (!isEditModeEnabled()) { showToast && showToast('Enable Edit Mode to remove cards from a deck.', 'warning'); return; }
        showConfirmationModal('Return card to collection?', 'Remove this card from the deck and return it to your collection?', async () => {
          await removeCardFromDeckAndReturnToCollection(did, fid);
        });
        return;
      }
    });
    decklistContainer._delegatedHandler = true;
  }
}

// Remove a card entry from a deck (only when in edit mode). This removes the reference
// from the deck document; it does not attempt to restore collection docs.
export async function removeCardFromDeck(deckId, firestoreId) {
  try {
    if (!isEditModeEnabled()) {
      showToast && showToast('Enable Edit Mode to remove cards from a deck.', 'warning');
      return;
    }
    if (!deckId || !firestoreId) return;
    const uid = getUserId(); if (!uid) { showToast && showToast('User not signed in.', 'error'); return; }
    const deckRef = doc(db, 'artifacts/' + appId + '/users/' + uid + '/decks', deckId);
    // If the deck locally shows a count > 1 for this card we remove the entry entirely for simplicity.
    await updateDoc(deckRef, { ['cards.' + firestoreId]: deleteField() });
    // Optimistic local update
    try {
      if (!window.localDecks) window.localDecks = localDecks;
      const localDeck = window.localDecks[deckId] || localDecks[deckId];
      if (localDeck && localDeck.cards) {
        delete localDeck.cards[firestoreId];
      }
      updateCardAssignments();
      if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(deckId);
      showToast && showToast('Card removed from deck.', 'success');
    } catch (e) { /* ignore optimistic errors */ }
  } catch (err) {
    console.error('[removeCardFromDeck] error', err);
    showToast && showToast('Failed to remove card from deck.', 'error');
  }
}

// Remove a card from a deck and return it to the user's collection.
// Behavior:
// - If there's an existing collection stack (same card id + finish) we increment that stack and delete the deck-specific collection doc.
// - Otherwise we leave the collection doc in place (it already exists) and just remove the deck reference.
export async function removeCardFromDeckAndReturnToCollection(deckId, firestoreId) {
  try {
    if (!isEditModeEnabled()) {
      showToast && showToast('Enable Edit Mode to remove cards from a deck.', 'warning');
      return;
    }
    if (!deckId || !firestoreId) return;
    const uid = getUserId(); if (!uid) { showToast && showToast('User not signed in.', 'error'); return; }

    // Fetch the card doc we're trying to return
    const cardSnap = await getDoc(doc(db, 'artifacts/' + appId + '/users/' + uid + '/collection', firestoreId));
    if (!cardSnap || !cardSnap.exists()) {
      showToast && showToast('Collection entry for this card could not be found.', 'error');
      return;
    }
    const cardData = cardSnap.data();

    // Look for an existing collection stack with same scryfall id + finish
    const col = window.localCollection || localCollection;
    const existing = Object.values(col || {}).find(c => c && c.id === cardData.id && ((c.finish || '') === (cardData.finish || '')) && c.firestoreId !== firestoreId);

    const batch = writeBatch(db);
    const deckRef = doc(db, 'artifacts/' + appId + '/users/' + uid + '/decks', deckId);
    // remove deck reference
    batch.update(deckRef, { ['cards.' + firestoreId]: deleteField() });

    if (existing && existing.firestoreId) {
      const existingRef = doc(db, 'artifacts/' + appId + '/users/' + uid + '/collection', existing.firestoreId);
      const newCount = (existing.count || 0) + (cardData.count || 1);
      batch.update(existingRef, { count: newCount });
      // delete the deck-specific collection doc to avoid duplicate docs
      const thisRef = doc(db, 'artifacts/' + appId + '/users/' + uid + '/collection', firestoreId);
      batch.delete(thisRef);
    } else {
      // No matching stack - leave the collection doc in place (it already exists) and just removed deck ref
    }

    await batch.commit();

    // Optimistic local updates
    try {
      if (!window.localDecks) window.localDecks = localDecks;
      if (!window.localCollection) window.localCollection = localCollection;
      const localDeck = window.localDecks[deckId] || localDecks[deckId];
      if (localDeck && localDeck.cards) delete localDeck.cards[firestoreId];
      if (existing && existing.firestoreId) {
        // increment local existing stack and remove the deck-specific placeholder
        window.localCollection[existing.firestoreId] = window.localCollection[existing.firestoreId] || existing;
        window.localCollection[existing.firestoreId].count = (window.localCollection[existing.firestoreId].count || 0) + (cardData.count || 1);
        delete window.localCollection[firestoreId];
      } else {
        // Ensure the returned collection doc is present locally
        window.localCollection[firestoreId] = Object.assign({}, cardData, { firestoreId });
      }
      updateCardAssignments();
      if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(deckId);
      showToast && showToast('Card returned to collection and removed from deck.', 'success');
    } catch (e) { console.warn('[removeCardFromDeckAndReturnToCollection] optimistic update failed', e); }

  } catch (err) {
    console.error('[removeCardFromDeckAndReturnToCollection] error', err);
    showToast && showToast('Failed to return card to collection.', 'error');
  }
}

// Expose compatibility shims
if (typeof window !== 'undefined') {
  window.openAddCardsToDeckModal = openAddCardsToDeckModal;
  window.handleAddSelectedCardsToDeck = handleAddSelectedCardsToDeck;
  window.batchAddCardsWithProgress = batchAddCardsWithProgress;
  window.deleteDeck = deleteDeck; // override earlier shim with wrapper
  window.addSingleDeckListeners = addSingleDeckListeners;
  window.removeCardFromDeckAndReturnToCollection = removeCardFromDeckAndReturnToCollection;
  window.renderSingleDeck = renderSingleDeck;
}

// --- Refactored renderSingleDeck from index.html ---

export function renderSingleDeck(deckId) {
  console.log(
    `[Function: renderSingleDeck] Rendering view for deck ID ${deckId}. (Refactored)`
  );
  const decksMap = window.localDecks || localDecks;
  let deck = decksMap[deckId];
  if (!deck) {
    // Fallback: try to find a deck by scanning values in case the keying differs
    deck = Object.values(decksMap || {}).find(d => d && (d.id === deckId || d.firestoreId === deckId || String(d.id) === String(deckId)));
    if (deck) {
      // Normalize deckId to the deck object's authoritative id
      deckId = deck.id || deck.firestoreId || deckId;
      console.log(`[renderSingleDeck] Fallback matched deck by scanning values. Resolved deckId -> ${deckId}`);
    }
  }

  if (!deck) {
    console.error(
      `[renderSingleDeck] Could not find deck with ID ${deckId}. Available deck keys: ${Object.keys(decksMap || {}).join(', ')}`
    );
    console.error(
      `[renderSingleDeck] Could not find deck with ID ${deckId}. Available deck keys: ${Object.keys(decksMap || {}).join(', ')}`
    );
    import('../main/router.js').then(({ router }) => router.navigate('/decks'));
    return;
  }

  const singleDeckView = document.getElementById("single-deck-view");
  if (!singleDeckView) return;

  singleDeckView.dataset.deckId = deckId;
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = deck.name;

  const localColl = window.localCollection || localCollection;

  const allDeckCards = Object.keys(deck.cards || {}).map(firestoreId => {
    const cardData = localColl[firestoreId];
    // If we don't yet have the collection doc locally, show a lightweight placeholder
    if (!cardData) {
      const deckEntry = deck.cards && deck.cards[firestoreId] ? deck.cards[firestoreId] : {};
      return {
        firestoreId,
        name: deckEntry.name || 'Loading...',
        type_line: deckEntry.type_line || 'Unknown',
        cmc: deckEntry.cmc || 0,
        count: deckEntry.count || 1,
        prices: deckEntry.prices || {},
        isPlaceholder: true,
        pending: true
      };
    }
    // The count in deck is stored on the deck object
    return { ...cardData, count: deck.cards[firestoreId].count };
  });

  if (deck.commander) {
    // Find the commander in the collection to get its full data, but use a count of 1
    const commanderInCollection = localColl[deck.commander.firestoreId];
    if (commanderInCollection) {
      allDeckCards.push({ ...commanderInCollection, count: 1 });
    }
  }


  // --- Inject Calculated Basic Lands for Stats ---
  if (typeof window.calculateBasicLandNeeds === 'function') {
    try {
      const targetLandCount = 37; // Standard Commander target
      const basicNeeds = window.calculateBasicLandNeeds(deck, targetLandCount);
      const manaColors = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };

      Object.entries(basicNeeds).forEach(([color, count]) => {
        if (count > 0) {
          // Create a virtual card entry for the stats
          allDeckCards.push({
            name: manaColors[color],
            type_line: 'Basic Land',
            cmc: 0,
            count: count,
            prices: { usd: 0 }, // Basic lands usually negligible for deck value
            isVirtual: true // Flag to identify if needed
          });
        }
      });
    } catch (e) {
      console.warn('[renderSingleDeck] Failed to calculate virtual basic lands for stats', e);
    }
  }

  const totalCost = allDeckCards.reduce((acc, card) => {
    const price =
      card.finish === "foil"
        ? card.prices?.usd_foil
        : card.prices?.usd;
    const cardCost = parseFloat(price) || 0;
    const count = card.count || 1;
    return acc + cardCost * count;
  }, 0);

  // Helper to count cards by type (inclusive check)
  const countByType = (type) => {
    return allDeckCards.reduce((sum, card) => {
      if ((card.type_line || '').includes(type)) return sum + (card.count || 1);
      return sum;
    }, 0);
  };

  const blueprint = deck.aiBlueprint?.suggestedCounts;
  const kpiData = [
    {
      label: "Total",
      current: allDeckCards.reduce((acc, c) => acc + (c.count || 1), 0),
      target: blueprint?.Total,
    },
    {
      label: "Creature",
      current: countByType("Creature"),
      target: blueprint?.Creature,
    },
    {
      label: "Land",
      current: countByType("Land"),
      target: blueprint?.Land,
    },
    {
      label: "Instant",
      current: countByType("Instant"),
      target: blueprint?.Instant,
    },
    {
      label: "Sorcery",
      current: countByType("Sorcery"),
      target: blueprint?.Sorcery,
    },
    {
      label: "Enchantment",
      current: countByType("Enchantment"),
      target: blueprint?.Enchantment,
    },
    {
      label: "Artifact",
      current: countByType("Artifact"),
      target: blueprint?.Artifact,
    },
    {
      label: "Planeswalker",
      current: countByType("Planeswalker"),
      target: blueprint?.Planeswalker,
    },
  ];

  // Add basic lands breakdown if mana calculator is available
  let basicLandsHtml = '';
  try {
    if (typeof window.calculateBasicLandNeeds === 'function') {
      const targetLandCount = 37; // Commander default
      const basicNeeds = window.calculateBasicLandNeeds(deck, targetLandCount);
      const manaColors = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
      const colorSymbols = {
        W: '<img src="https://svgs.scryfall.io/card-symbols/W.svg" class="inline-block w-4 h-4" alt="W">',
        U: '<img src="https://svgs.scryfall.io/card-symbols/U.svg" class="inline-block w-4 h-4" alt="U">',
        B: '<img src="https://svgs.scryfall.io/card-symbols/B.svg" class="inline-block w-4 h-4" alt="B">',
        R: '<img src="https://svgs.scryfall.io/card-symbols/R.svg" class="inline-block w-4 h-4" alt="R">',
        G: '<img src="https://svgs.scryfall.io/card-symbols/G.svg" class="inline-block w-4 h-4" alt="G">'
      };

      const basicLandPills = ['W', 'U', 'B', 'R', 'G']
        .filter(color => basicNeeds[color] > 0)
        .map(color => {
          const needed = basicNeeds[color];
          return `<div class="flex items-center gap-1 text-xs bg-gray-800/70 px-2 py-1 rounded">${colorSymbols[color]} ${needed}x ${manaColors[color]}</div>`;
        })
        .join('');

      if (basicLandPills) {
        basicLandsHtml = `
            <div class="bg-gray-700/50 p-3 rounded-lg mt-2">
              <div class="text-sm text-gray-400 mb-2">Recommended Basic Lands</div>
              <div class="flex flex-wrap gap-2">
                ${basicLandPills}
              </div>
            </div>
          `;
      }
    }
  } catch (e) {
    console.debug('[renderSingleDeck] Basic lands calculation failed', e);
  }

  const kpiHtml = kpiData
    .map((kpi) => {
      const hasTarget = kpi.target !== null && kpi.target !== undefined;
      const percentage = hasTarget
        ? Math.min((kpi.current / kpi.target) * 100, 100)
        : 0;
      let barColor = "bg-gray-500";
      if (hasTarget) {
        if (percentage < 50) barColor = "bg-red-500";
        else if (percentage < 90) barColor = "bg-yellow-500";
        else barColor = "bg-green-500";
      }

      return `
          <div class="bg-gray-700/50 p-3 rounded-lg relative overflow-hidden kpi-clickable" data-slot="${kpi.label}" title="Click to ask AI for ${kpi.label} suggestions">
              <div class="flex justify-between items-baseline">
                  <span class="text-sm text-gray-400">${kpi.label}</span>
                  <span class="font-bold text-lg">${kpi.current}${hasTarget ? ` / ${kpi.target}` : ""
        }</span>
              </div>
              ${hasTarget
          ? `<div class="kpi-gradient-bar ${barColor}" style="width: ${percentage}%"></div>`
          : ""
        }
          </div>
        `;
    })
    .join("");

  const manaCurveData = allDeckCards.reduce((acc, card) => {
    if (card && !card.type_line.toLowerCase().includes("land")) {
      const cmc = Math.min(card.cmc, 7); // Group 7+ cmc together
      const count = card.count || 1;
      acc[cmc] = (acc[cmc] || 0) + count;
    }
    return acc;
  }, {});

  const colorIdentity = deck.commander?.color_identity || [];
  const colorSymbols = {
    W: '<img src="https://svgs.scryfall.io/card-symbols/W.svg" class="w-5 h-5" alt="White Mana">',
    U: '<img src="https://svgs.scryfall.io/card-symbols/U.svg" class="w-5 h-5" alt="Blue Mana">',
    B: '<img src="https://svgs.scryfall.io/card-symbols/B.svg" class="w-5 h-5" alt="Black Mana">',
    R: '<img src="https://svgs.scryfall.io/card-symbols/R.svg" class="w-5 h-5" alt="Red Mana">',
    G: '<img src="https://svgs.scryfall.io/card-symbols/G.svg" class="w-5 h-5" alt="Green Mana">',
  };
  const colorIcons = colorIdentity
    .map((c) => colorSymbols[c])
    .join("");

  // FIX: Handle 2-sided cards for banner image
  const commanderArt = deck.commander?.image_uris?.art_crop ||
    (deck.commander?.card_faces && deck.commander.card_faces[0]?.image_uris?.art_crop) ||
    deck.commander?.image_uris?.normal ||
    (deck.commander?.card_faces && deck.commander.card_faces[0]?.image_uris?.normal) || '';

  // FIX: Handle 2-sided cards for mini view image
  const commanderImage = deck.commander?.image_uris?.normal ||
    (deck.commander?.card_faces && deck.commander.card_faces[0]?.image_uris?.normal) || '';

  singleDeckView.innerHTML = `
      <div class="space-y-6 animate-fade-in">
          <!-- Back Button -->
          <div>
              <button id="single-deck-back-btn" class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Back to Decks
              </button>
          </div>

          <!-- Banner Header -->
          <div class="relative w-full h-64 bg-gray-900 rounded-xl overflow-hidden shadow-2xl group">
              <div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style="background-image: url('${commanderArt}'); opacity: 0.6;"></div>
              <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>
              
              <div class="absolute bottom-0 left-0 p-6 w-full flex flex-col md:flex-row justify-between items-end gap-4">
                  <div>
                      <h2 class="text-4xl font-bold text-white mb-2 drop-shadow-lg tracking-tight">${deck.name}</h2>
                      <div class="flex items-center gap-3 text-gray-300">
                          <span class="bg-indigo-600/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">${deck.format}</span>
          <div class="flex items-center gap-1 bg-gray-800/60 backdrop-blur-sm px-2 py-1 rounded-full">${colorIcons}</div>
          <span class="ml-2 inline-flex items-center bg-gray-800/60 text-gray-100 text-sm font-semibold px-3 py-1 rounded-full">Deck Value: $${totalCost.toFixed(2)}</span>
                      </div>
                  </div>
                  <div class="flex items-center gap-3">
                      <button id="add-cards-to-deck-btn" class="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                          Add Cards
                      </button>
                      <div class="relative group/menu">
                          <button class="bg-gray-700/80 hover:bg-gray-600 text-white p-2 rounded-lg backdrop-blur-sm transition-colors">
                              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                          </button>
                          <div class="absolute right-0 bottom-full mb-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden group-hover/menu:block overflow-visible z-10 before:absolute before:-bottom-2 before:left-0 before:w-full before:h-2 before:content-['']">
                              <button id="deck-delete-btn" data-deck-id="${deckId}" class="w-full text-left px-4 py-3 text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors flex items-center gap-2 rounded-t-lg">
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                  Delete Deck
                              </button>
                              <button id="export-deck-btn" data-deck-id="${deckId}" class="w-full text-left px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border-t border-gray-700 rounded-b-lg">
                                  Export List
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Stats Toggle & Content -->
          <div class="flex justify-end mb-2">
              <button id="toggle-stats-btn" class="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors" onclick="const el = document.getElementById('deck-stats-container'); const btn = this; if(el.classList.contains('hidden')) { el.classList.remove('hidden'); btn.innerHTML = 'Hide Stats <svg class=\'w-3 h-3\' fill=\'none\' stroke=\'currentColor\' viewBox=\'0 0 24 24\'><path stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M5 15l7-7 7 7\'/></svg>'; } else { el.classList.add('hidden'); btn.innerHTML = 'Show Stats <svg class=\'w-3 h-3\' fill=\'none\' stroke=\'currentColor\' viewBox=\'0 0 24 24\'><path stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/></svg>'; }">
                  Hide Stats
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
              </button>
          </div>
          <div id="deck-stats-container" class="space-y-6 transition-all duration-300">
              <!-- Stats Bar -->
              <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  ${kpiHtml}
              </div>
              
              <!-- Basic Lands Breakdown -->
              ${basicLandsHtml}
          </div>

          <!-- Main Content Area -->
          <div class="flex flex-col lg:flex-row gap-6">
              <!-- Left: Decklist (Flexible Width) -->
              <!-- Mobile: Order 2 (Bottom), Desktop: Order 1 (Left) -->
              <div class="flex-1 min-w-0 bg-gray-800 rounded-xl shadow-lg p-1 order-2 lg:order-1">
                  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
                      <h3 class="text-lg font-bold text-white">Decklist</h3>
                      <div class="flex bg-gray-900/50 rounded-lg p-1 gap-1">
                          <button id="view-toggle-grid" class="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all" title="Grid View">
                              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                          </button>
                          <button id="view-toggle-table" class="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all" title="Table View">
                              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                          </button>
                      </div>
                  </div>
                  <div id="decklist-container" class="p-4">
                      <!-- Decklist rendered here -->
                  </div>
              </div>

              <!-- Right: Tools & Charts (Fixed Width on Desktop) -->
              <!-- Mobile: Order 1 (Top), Desktop: Order 2 (Right) -->
              <div class="w-full lg:w-80 space-y-6 shrink-0 order-1 lg:order-2">
                  <!-- Commander Mini-View (Collapsible) -->
                  ${deck.commander ? `
                  <div class="bg-gray-800 p-4 rounded-xl shadow-lg">
                      <div class="flex justify-between items-center mb-3 cursor-pointer" onclick="const el = document.getElementById('commander-card-content'); const icon = this.querySelector('svg'); if(el.classList.contains('hidden')) { el.classList.remove('hidden'); icon.style.transform = 'rotate(0deg)'; } else { el.classList.add('hidden'); icon.style.transform = 'rotate(180deg)'; }">
                          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">Commander</h3>
                          <svg class="w-4 h-4 text-gray-500 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                      <div id="commander-card-content" class="relative group">
                          ${(() => {
        // Check for 2-sided card
        if (deck.commander.card_faces && deck.commander.card_faces.length > 1 && deck.commander.card_faces[0].image_uris && deck.commander.card_faces[1].image_uris) {
          const front = deck.commander.card_faces[0].image_uris?.normal || deck.commander.card_faces[0].image_uris?.large || '';
          const back = deck.commander.card_faces[1].image_uris?.normal || deck.commander.card_faces[1].image_uris?.large || '';
          return `
                                <style>
                                    .dfs-flip-wrapper { perspective: 1000px; }
                                    .dfs-card { transition: transform 0.6s; transform-style: preserve-3d; position: relative; width: 100%; height: 100%; }
                                    .dfs-card.is-flipped { transform: rotateY(180deg); }
                                    .dfs-face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
                                    .dfs-back { transform: rotateY(180deg); }
                                </style>
                                <div class="dfs-flip-wrapper relative w-full" style="aspect-ratio: 63/88;">
                                    <div class="dfs-card w-full h-full relative" onclick="this.classList.toggle('is-flipped')">
                                        <div class="dfs-face w-full h-full">
                                            <img src="${front}" class="w-full rounded-lg shadow-md hover:shadow-indigo-500/30 transition-shadow duration-300 cursor-pointer" alt="${deck.commander.name}">
                                            <button class="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all z-10 border border-white/20" title="Flip Card" onclick="event.stopPropagation(); this.closest('.dfs-card').classList.toggle('is-flipped');">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                            </button>
                                        </div>
                                        <div class="dfs-face dfs-back w-full h-full">
                                            <img src="${back}" class="w-full rounded-lg shadow-md hover:shadow-indigo-500/30 transition-shadow duration-300 cursor-pointer" alt="${deck.commander.name}">
                                            <button class="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all z-10 border border-white/20" title="Flip Card" onclick="event.stopPropagation(); this.closest('.dfs-card').classList.toggle('is-flipped');">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                `;
        }
        // Standard single-faced card
        return `<img src="${commanderImage}" class="w-full rounded-lg shadow-md hover:shadow-indigo-500/30 transition-shadow duration-300 cursor-pointer" alt="${deck.commander.name}" onclick="if(typeof window.renderCardDetailsModal === 'function') window.renderCardDetailsModal(window.localCollection['${deck.commander.firestoreId}'])">`;
      })()}
                      </div>
                  </div>` : ''}

                  <div class="bg-gray-800 p-4 rounded-xl shadow-lg">
                      <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Mana Curve</h3>
                      <div class="h-32">
                          <canvas id="mana-curve-chart"></canvas>
                      </div>
                  </div>

                  <div class="bg-gray-800 p-4 rounded-xl shadow-lg">
                      <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">AI Tools</h3>
                      <div class="space-y-2">
                          ${deck.aiBlueprint ? `
                          <button id="view-strategy-btn" class="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/50 hover:border-purple-500 font-bold py-2 px-4 rounded-lg transition-all text-sm">View Strategy</button>
                          <button id="rerun-ai-summary-btn" class="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:shadow-orange-500/20 transition-all transform hover:-translate-y-0.5 text-sm flex items-center justify-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            Update Strategy
                          </button>
                          ` : ''}
                          <button id="ai-suggestions-btn" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all text-sm">
                              ✨ Deck Suggestions
                          </button>
                          <button id="deck-help-btn" class="w-full bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-600/50 hover:border-teal-500 font-bold py-2 px-4 rounded-lg transition-all text-sm">
                              💬 Ask AI Helper
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    `;

  renderDecklist(deckId);
  // Ensure chart is loaded before rendering
  if (typeof window.renderManaCurveChart === 'function') {
    window.renderManaCurveChart(manaCurveData);
  } else if (typeof renderManaCurveChart === 'function') {
    renderManaCurveChart(manaCurveData);
  }

  if (typeof window.addSingleDeckListeners === 'function') {
    window.addSingleDeckListeners(deckId);
  } else if (typeof addSingleDeckListeners === 'function') {
    addSingleDeckListeners(deckId);
  }

  // Back button listener
  const backBtn = document.getElementById('single-deck-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      import('../main/router.js').then(({ router }) => router.navigate('/decks'));
    });
  }

  // Attach KPI click handlers to ask AI for a single slot/type
  try {
    document.querySelectorAll('.kpi-clickable').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        const slot = el.dataset.slot;
        if (!slot) return;
        try {
          import('./deckSuggestions.js').then(mod => {
            if (mod.openDeckSuggestionsModal) mod.openDeckSuggestionsModal(deckId, { type: slot });
          }).catch(err => console.debug('deckSuggestions module not available for KPI click', err));
        } catch (err) { console.debug('KPI click handler failed', err); }
      });
    });
  } catch (err) { /* ignore attach errors */ }

  // Deck Help button: open a deck-scoped MTG chat helper
  try {
    const helpBtn = document.getElementById('deck-help-btn');
    if (helpBtn) helpBtn.addEventListener('click', () => {
      try { import('./deckSuggestions.js').then(mod => { if (mod.openDeckHelp) mod.openDeckHelp(deckId); else if (typeof window.openDeckHelp === 'function') window.openDeckHelp(deckId); }).catch(err => console.debug('deckSuggestions module not available for Deck Help', err)); } catch (e) { console.debug('Deck Help click handler failed', e); }
    });
  } catch (err) { /* ignore */ }

  // Deck Suggestions (full-deck) button
  try {
    const suggestBtn = document.getElementById('ai-suggestions-btn');
    if (suggestBtn) suggestBtn.addEventListener('click', () => {
      try {
        import('./deckSuggestions.js').then(mod => {
          if (mod.openDeckSuggestionsModal) mod.openDeckSuggestionsModal(deckId, { type: null });
        }).catch(err => console.debug('deckSuggestions module not available for full suggestions', err));
      } catch (e) { console.debug('Deck Suggestions click handler failed', e); }
    });
  } catch (e) { /* ignore */ }

  // View AI Strategy button
  try {
    const viewBtn = document.getElementById('view-strategy-btn');
    if (viewBtn) viewBtn.addEventListener('click', () => {
      try {
        import('./decks.js').then(mod => {
          if (mod.renderAiBlueprintModal) mod.renderAiBlueprintModal(deck.aiBlueprint || window.tempAiBlueprint || {}, deck.name, false, deckId, allDeckCards);
          try { openModal('ai-blueprint-modal'); } catch (e) { }
        }).catch(err => console.debug('decks module not available for View AI Strategy', err));
      } catch (e) { console.debug('View AI Strategy click failed', e); }
    });
  } catch (e) { /* ignore */ }

  // Rerun AI Summary button: asks Gemini for a new blueprint using the commander + current deck cards
  try {
    const rerunBtn = document.getElementById('rerun-ai-summary-btn');
    if (rerunBtn) rerunBtn.addEventListener('click', async () => {
      // Show loading state on button
      const originalText = rerunBtn.innerHTML;
      rerunBtn.innerHTML = '<span class="tiny-spinner"></span> Updating...';
      rerunBtn.disabled = true;

      // Show custom hammer toast
      let toastId = null;
      if (typeof window.showLoadingToast === 'function') {
        toastId = window.showLoadingToast('Forging new strategy...');
      } else if (typeof showLoadingToast === 'function') {
        toastId = showLoadingToast('Forging new strategy...');
      } else {
        showToast('Forging new strategy...', 'info');
      }

      try {
        // Load playstyle first
        let playstyle = null;
        try {
          const playstyleMod = await import('../settings/playstyle.js');
          if (playstyleMod && typeof playstyleMod.loadPlaystyleForUser === 'function' && window.userId) {
            playstyle = await playstyleMod.loadPlaystyleForUser(window.userId);
          }
        } catch (e) { console.debug('Failed to load playstyle for update strat', e); }

        const decksMod = await import('./decks.js');
        const blueprint = await (decksMod.getAiDeckBlueprint ? decksMod.getAiDeckBlueprint(deck.commander, allDeckCards, playstyle) : null);

        // Save the new blueprint to the deck
        if (blueprint) {
          // Preserve existing suggestedCounts if they exist in the current deck
          if (deck.aiBlueprint && deck.aiBlueprint.suggestedCounts) {
            blueprint.suggestedCounts = deck.aiBlueprint.suggestedCounts;
          }

          // Update local deck object
          deck.aiBlueprint = blueprint;
          // Persist to Firestore
          try {
            const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
            const { db, appId } = await import('../main/index.js');
            const uid = getUserId();
            if (uid) {
              await updateDoc(doc(db, 'artifacts/' + appId + '/users/' + uid + '/decks', deckId), { aiBlueprint: blueprint });
            }
          } catch (err) { console.error('Failed to persist updated blueprint', err); }
        }

        window.tempAiBlueprint = blueprint;
        if (decksMod.renderAiBlueprintModal) decksMod.renderAiBlueprintModal(blueprint, deck.name, false, deckId, allDeckCards);
        try { openModal('ai-blueprint-modal'); } catch (e) { }

        // Remove loading toast and show success
        if (toastId && typeof window.removeToastById === 'function') window.removeToastById(toastId);
        showToast('Strategy updated successfully!', 'success');
      } catch (err) {
        console.error('Rerun AI summary failed', err);
        if (toastId && typeof window.removeToastById === 'function') window.removeToastById(toastId);
        showToast('AI summary failed.', 'error');
      } finally {
        rerunBtn.innerHTML = originalText;
        rerunBtn.disabled = false;
      }
    });
  } catch (e) { /* ignore */ }
}
