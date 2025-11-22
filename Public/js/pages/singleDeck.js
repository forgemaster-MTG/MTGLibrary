import { localDecks, localCollection, addCardToCollection, updateCardAssignments, deleteDeck as dataDeleteDeck } from '../lib/data.js';
import { showToast, openModal, closeModal } from '../lib/ui.js';
import { openDeckSuggestionsModal } from './deckSuggestions.js';
import { db, appId } from '../main/index.js';
import { writeBatch, doc, updateDoc, runTransaction, deleteField, collection, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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
  if ((collectionCard.count || 0) > 1) batch.update(origRef, { count: (collectionCard.count || 0) - 1 }); else batch.delete(origRef);
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
      }
    } catch (e) {
      console.warn('[reconcile] failed to fetch new collection doc', m.newId, e);
    }
  }
  try { updateCardAssignments(); if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(deckId); } catch (e) { }
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

export function renderDecklist(deckId, viewMode = 'grid') {
  const container = document.getElementById('decklist-container');
  if (!container) return;
  const deck = localDecks[deckId];
  if (!deck) return;
  const allCards = Object.keys(deck.cards || {}).map(firestoreId => {
    const cardData = localCollection[firestoreId];
    if (!cardData) return null;
    return { ...cardData, countInDeck: deck.cards[firestoreId].count };
  }).filter(Boolean);

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
    const img = card.image_uris?.normal || card.image_uris?.art_crop || 'https://placehold.co/250x350?text=No+Image';
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
      <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                ${reasonText ? `<div class="absolute top-3 left-3 right-3 bg-black/70 backdrop-blur-sm text-gray-100 text-xs leading-snug max-h-50 overflow-hidden z-30 p-2 rounded">${reasonEsc}</div>` : ''}
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
        <tr class="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors group">
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

  let content = '';
  if (!currentGroup) {
    if (viewMode === 'grid') content = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">${filtered.map(renderGridItem).join('')}</div>`;
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
        ? `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">${cards.map(renderGridItem).join('')}</div>`
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

  

  // --- Restore State & Listeners ---
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
}

export function renderManaCurveChart(manaCurveData) {
  const ctx = document.getElementById('mana-curve-chart')?.getContext('2d');
  if (!ctx) return;
  const chartId = 'mana-curve-chart';
  if (deckChartInstances[chartId]) deckChartInstances[chartId].destroy();
  const labels = ['0', '1', '2', '3', '4', '5', '6', '7+'];
  const data = labels.map((label, index) => {
    const cmc = parseInt(label);
    if (index < 7) return manaCurveData[cmc] || 0;
    let sum = 0; for (let k in manaCurveData) if (parseInt(k) >= 7) sum += manaCurveData[k]; return sum;
  });
  deckChartInstances[chartId] = new Chart(ctx, {
    type: 'bar', data: { labels, datasets: [{ label: 'Card Count', data, backgroundColor: 'rgba(79, 70, 229, 0.6)', borderColor: 'rgba(129, 140, 248, 1)', borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
  });
}

export function initSingleDeckModule() {
  window.renderDecklist = renderDecklist;
  window.renderManaCurveChart = renderManaCurveChart;
  window.attachSuggestionMetadataToDeck = attachSuggestionMetadataToDeck;
  window.renderDeckSuggestionSummary = renderDeckSuggestionSummary;
  console.log('[SingleDeck] Module initialized.');
}

// --- Single-deck UI flows migrated from inline HTML ---
export function openAddCardsToDeckModal(deckId) {
  const deck = window.localDecks?.[deckId] || localDecks[deckId];
  if (!deck) { showToast('Could not find the specified deck.', 'error'); return; }
  document.getElementById('add-cards-modal-title').textContent = `Add Cards to "${deck.name}"`;
  const commanderColors = deck.commander?.color_identity || ['W', 'U', 'B', 'R', 'G'];
  const tableBody = document.getElementById('add-cards-modal-table-body');
  const filterInput = document.getElementById('add-card-modal-filter');
  const jsonFilterInput = document.getElementById('add-card-modal-json-filter');
  if (filterInput) filterInput.value = '';
  if (jsonFilterInput) jsonFilterInput.value = '';

  const renderTable = () => {
    const filterText = (filterInput?.value || '').toLowerCase();
    const jsonFilterTextRaw = (jsonFilterInput?.value || '') || '';
    const jsonFilterText = jsonFilterTextRaw.trim().toLowerCase();
    const col = window.localCollection || localCollection;
    const eligibleCards = Object.values(col)
      .filter(card => (card.count || 0) > 0 && isColorIdentityValid(card.color_identity, commanderColors))
      .filter(card => {
        // Name filter (existing behavior)
        if (filterText && !(card.name || '').toLowerCase().includes(filterText)) return false;

        // JSON / full-text filter: if provided, search the serialized card JSON
        if (jsonFilterText) {
          try {
            const cardJson = JSON.stringify(card).toLowerCase();
            if (cardJson.includes(jsonFilterText)) return true;
            // If the user provided an object-like string, also try to extract values and match them roughly
            // (fallback behavior already covered by substring search)
            return false;
          } catch (e) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (eligibleCards.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-gray-500">No eligible cards in your collection.</td></tr>`;
    } else {
      tableBody.innerHTML = eligibleCards.map(card => `
        <tr class="border-b border-gray-700 hover:bg-gray-700/50">
          <td class="p-4">
            <div class="flex items-center">
              <input id="checkbox-${card.firestoreId}" type="checkbox" data-firestore-id="${card.firestoreId}" class="add-card-checkbox w-4 h-4">
            </div>
          </td>
          <td class="px-6 py-4 font-medium whitespace-nowrap">${card.name}</td>
          <td class="px-6 py-4">${(card.type_line || '').split(' — ')[0]}</td>
          <td class="px-6 py-4 text-center">${card.count}</td>
        </tr>
      `).join('');
    }
    updateSelectedCount();
  };

  const updateSelectedCount = () => {
    const selectedCount = document.querySelectorAll('.add-card-checkbox:checked').length;
    const counter = document.getElementById('add-cards-selected-count'); if (counter) counter.textContent = `${selectedCount} card(s) selected`;
  };

  renderTable();
  filterInput && filterInput.addEventListener('input', renderTable);
  jsonFilterInput && jsonFilterInput.addEventListener('input', renderTable);
  tableBody && tableBody.addEventListener('change', updateSelectedCount);
  const selectAll = document.getElementById('add-cards-select-all'); if (selectAll) selectAll.addEventListener('change', (e) => { document.querySelectorAll('.add-card-checkbox').forEach(cb => cb.checked = e.target.checked); updateSelectedCount(); });
  document.getElementById('confirm-add-cards-to-deck-btn').onclick = () => {
    const selectedIds = Array.from(document.querySelectorAll('.add-card-checkbox:checked')).map(cb => cb.dataset.firestoreId);
    handleAddSelectedCardsToDeck(deckId, selectedIds);
  };
  openModal('add-cards-to-deck-modal');
}

export async function handleAddSelectedCardsToDeck(deckId, firestoreIds) {
  if (!deckId || !firestoreIds || firestoreIds.length === 0) { showToast('No cards selected to add.', 'warning'); return; }
  const deck = window.localDecks?.[deckId] || localDecks[deckId];
  if (!deck) { showToast('Deck not found.', 'error'); return; }
  const commanderColors = deck.commander?.color_identity || [];
  // Ensure we have a userId early so we can attempt to prefetch missing collection docs
  const userId = getUserId(); if (!userId) { showToast('User not signed in.', 'error'); return; }

  // Validate selected ids. If a local collection entry is missing, try fetching it from Firestore
  for (const fid of firestoreIds) {
    let collectionCard = (window.localCollection || localCollection)[fid];
    if (!collectionCard) {
      try {
        const snap = await getDoc(doc(db, `artifacts/${appId}/users/${userId}/collection`, fid));
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

    if (!collectionCard) { showToast(`Card not found in collection: ${fid}`, 'error'); return; }
    if (!isColorIdentityValid(collectionCard.color_identity, commanderColors)) { showToast(`Card "${collectionCard.name}" is not legal with this commander (color identity mismatch).`, 'error'); return; }
  }
  // Check assignments
  for (const fid of firestoreIds) {
    const assigns = window.cardDeckAssignments?.[fid] || [];
    if (assigns.length > 0) {
      const assignment = assigns[0]; if (assignment.deckId !== deckId) { showToast(`Card "${(window.localCollection || localCollection)[fid].name}" is already in another deck.`, 'error'); return; }
    }
  }

  // userId already retrieved above
  const batch = writeBatch(db);
  // track mapping from original fid -> newly created collection doc id so we can update local state optimistically
  const createdMappings = [];
  const skippedIds = [];
  for (const fid of firestoreIds) {
    const collectionCard = (window.localCollection || localCollection)[fid];
    if (!collectionCard || collectionCard.count < 1) { console.warn(`Skipping ${fid}`); skippedIds.push(fid); continue; }

    // Create a dedicated collection document for the card that will be associated with the deck.
    // This splits a stack rather than reusing the same document id for both collection and deck.
    const origCollectionRef = doc(db, `artifacts/${appId}/users/${userId}/collection`, fid);
    const newCollectionRef = doc(collection(db, `artifacts/${appId}/users/${userId}/collection`));
    const newCardDoc = Object.assign({}, collectionCard, { count: 1, addedAt: new Date().toISOString() });
    delete newCardDoc.firestoreId; // avoid copying an existing id into the new doc
    batch.set(newCollectionRef, newCardDoc);
    createdMappings.push({ orig: fid, newId: newCollectionRef.id, name: collectionCard.name, type_line: collectionCard.type_line });

    // Decrement or remove the original stack
    if ((collectionCard.count || 0) > 1) {
      batch.update(origCollectionRef, { count: (collectionCard.count || 0) - 1 });
    } else {
      batch.delete(origCollectionRef);
    }

    // Add the new collection doc id into the deck's cards map
    const deckRef = doc(db, `artifacts/${appId}/users/${userId}/decks`, deckId);
    const cardInDeck = deck.cards?.[newCollectionRef.id];
    if (!cardInDeck) {
      batch.set(deckRef, { cards: { [newCollectionRef.id]: { count: 1, name: collectionCard.name, type_line: collectionCard.type_line } } }, { merge: true });
    } else {
      batch.update(deckRef, { [`cards.${newCollectionRef.id}.count`]: (cardInDeck.count || 0) + 1 });
    }
  }

  try {
    await batch.commit();
    const addedCount = createdMappings.length;
    if (skippedIds.length > 0) {
      showToast(`Added ${addedCount} card(s) to ${deck.name}. ${skippedIds.length} card(s) were skipped (not in collection).`, 'warning');
    } else {
      showToast(`Added ${addedCount} card(s) to ${deck.name}.`, 'success');
    }
    try {
      if (!window.localDecks) window.localDecks = localDecks;
      if (!window.localCollection) window.localCollection = localCollection;
      const localDeck = window.localDecks[deckId] || localDecks[deckId];
      localDeck.cards = localDeck.cards || {};
      // Apply optimistic local updates according to the created mappings
      createdMappings.forEach(({ orig, newId, name, type_line }) => {
        const collectionCard = (window.localCollection || localCollection)[orig];
        if (!collectionCard) return;
        if ((collectionCard.count || 0) > 1) {
          collectionCard.count = Math.max((collectionCard.count || 0) - 1, 0);
          // create a local placeholder for the new collection doc
          window.localCollection[newId] = Object.assign({}, collectionCard, { count: 1, firestoreId: newId, pending: true, name, type_line });
          if (localDeck.cards[newId]) localDeck.cards[newId].count = (localDeck.cards[newId].count || 0) + 1; else localDeck.cards[newId] = { count: 1, name, type_line };
        } else {
          // original had count 1: remove it and add deck entry referencing newId
          delete window.localCollection[orig];
          window.localCollection[newId] = Object.assign({}, collectionCard, { count: 1, firestoreId: newId, pending: true, name, type_line });
          if (localDeck.cards[newId]) localDeck.cards[newId].count = (localDeck.cards[newId].count || 0) + 1; else localDeck.cards[newId] = { count: 1, name, type_line };
        }
      });
      updateCardAssignments();
      if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(deckId);
    } catch (e) { console.warn('Local optimistic update failed:', e); }
    // Reconcile placeholders with server data
    try { await fetchAndReplacePlaceholders(createdMappings, deckId, userId); } catch (e) { console.warn('Reconcile after add failed', e); }
    closeModal('add-cards-to-deck-modal');
  } catch (error) {
    console.error('Error adding cards to deck:', error); showToast('Failed to add cards to deck.', 'error');
  }
}

// Batch-add cards to deck with progress toasts. Uses the same logic as handleAddSelectedCardsToDeck
export async function batchAddCardsWithProgress(deckId, firestoreIds) {
  if (!deckId || !firestoreIds || firestoreIds.length === 0) return;
  const deck = window.localDecks?.[deckId] || localDecks[deckId];
  if (!deck) return;
  const uid = getUserId(); if (!uid) { showToast('User not signed in.', 'error'); return; }
  // We'll commit in small batches to show progress
  const batchSize = 50;
  let processed = 0;
  const failedIds = [];
  const toastId = showToastWithProgress('Adding cards to deck...', 0, firestoreIds.length);
  try {
    for (let i = 0; i < firestoreIds.length; i += batchSize) {
      const chunk = firestoreIds.slice(i, i + batchSize);
      // Prefetch any missing collection docs for this chunk to avoid skipping them
      for (const fid of chunk) {
        const existing = (window.localCollection || localCollection)[fid];
        if (!existing) {
          try {
            const snap = await getDoc(doc(db, `artifacts/${appId}/users/${uid}/collection`, fid));
            if (snap && snap.exists()) {
              const data = snap.data(); data.firestoreId = fid;
              if (!window.localCollection) window.localCollection = window.localCollection || {};
              window.localCollection[fid] = data;
            }
          } catch (e) {
            console.warn('[batchAdd] prefetch failed for', fid, e);
          }
        }
      }
      // Build batch and collect per-fid ops so we can retry the whole batch on failure
      // For this chunk we will collect the new collection doc ids we create so we can update local state
      const newIdsForChunk = [];
      const makeBatch = () => {
        const b = writeBatch(db);
        for (const fid of chunk) {
          const collectionCard = (window.localCollection || localCollection)[fid];
          if (!collectionCard) continue;
          const deckCardId = fid;
          const cardInDeck = deck.cards?.[deckCardId];
          const deckRef = doc(db, `artifacts/${appId}/users/${uid}/decks`, deckId);

          // Create a new collection doc to represent the unit moved into the deck
          const origCollectionRef = doc(db, `artifacts/${appId}/users/${uid}/collection`, fid);
          const newCollectionRef = doc(collection(db, `artifacts/${appId}/users/${uid}/collection`));
          const newCardDoc = Object.assign({}, collectionCard, { count: 1, addedAt: new Date().toISOString() });
          delete newCardDoc.firestoreId;
          b.set(newCollectionRef, newCardDoc);
          newIdsForChunk.push({ orig: fid, newId: newCollectionRef.id, name: collectionCard.name, type_line: collectionCard.type_line });

          // Decrement or delete the original stack
          if ((collectionCard.count || 0) > 1) {
            b.update(origCollectionRef, { count: collectionCard.count - 1 });
          } else {
            b.delete(origCollectionRef);
          }

          // Add deck entry referencing the new collection id (always create a dedicated deck entry for the new doc)
          b.set(deckRef, { cards: { [newCollectionRef.id]: { count: 1, name: (collectionCard && collectionCard.name) || '', type_line: (collectionCard && collectionCard.type_line) || '' } } }, { merge: true });
        }
        return b;
      };
      // commit with retries
      let attempts = 0;
      const maxAttempts = 3;
      let chunkCommitted = false;
      while (attempts < maxAttempts) {
        const batch = makeBatch();
        try {
          await batch.commit();
          processed += chunk.length;
          updateToastProgress(toastId, Math.min(processed, firestoreIds.length), firestoreIds.length);
          chunkCommitted = true;
          break; // success
        } catch (err) {
          attempts += 1;
          console.warn(`[batchAdd] commit attempt ${attempts} failed`, err);
          if (attempts >= maxAttempts) {
            // Log and continue with the next chunk rather than aborting the entire process so partial progress is preserved.
            console.error(`[batchAdd] chunk commit failed after ${attempts} attempts. Continuing with next chunk.`, chunk);
            break;
          }
          // wait with exponential backoff before retry
          await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempts)));
        }
      }
      // optimistic local update only for the successfully committed chunk
      if (!chunkCommitted) {
        // mark these ids as failed in console for troubleshooting and collect them
        console.warn('[batchAdd] skipping optimistic update for failed chunk', chunk);
        failedIds.push(...chunk);
        continue;
      }
      // optimistic local update
      try {
        const localDeck = window.localDecks[deckId] || localDecks[deckId];
        localDeck.cards = localDeck.cards || {};
        // Apply optimistic updates based on newIdsForChunk mapping
        (newIdsForChunk || []).forEach(mapping => {
          const { orig, newId, name, type_line } = mapping;
          const collectionCard = (window.localCollection || localCollection)[orig];
          if (collectionCard) {
            if ((collectionCard.count || 0) > 1) {
              collectionCard.count = Math.max((collectionCard.count || 0) - 1, 0);
            } else {
              // removed original
              delete window.localCollection[orig];
            }
          }
          // create local placeholder for the new collection doc
          window.localCollection[newId] = Object.assign({}, collectionCard || {}, { count: 1, firestoreId: newId, pending: true, name, type_line });
          if (localDeck.cards[newId]) localDeck.cards[newId].count = (localDeck.cards[newId].count || 0) + 1; else localDeck.cards[newId] = { count: 1, name, type_line };
        });
        updateCardAssignments();
        if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(deckId);
      } catch (e) { console.warn('Local optimistic update failed:', e); }
      // Reconcile server docs for this chunk's new ids
      try { await fetchAndReplacePlaceholders(newIdsForChunk, deckId, uid); } catch (e) { console.warn('[batchAdd] reconcile failed for chunk', e); }
    }
    // If some chunks failed, retry failed ids individually
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
            // reconcile this single created doc
            await fetchAndReplacePlaceholders([{ orig: fid, newId: res.newId, name: res.name, type_line: res.type_line }], deckId, uid);
            ok = true;
          } catch (err) {
            console.warn(`[batchAdd][retry] attempt ${attempts} for ${fid} failed`, err);
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
      showToast(`Added most cards to deck; ${report.length} card(s) failed to persist. See console.`, 'warning');
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
      const deckRef = doc(db, `artifacts/${appId}/users/${uid}/decks`, deckId);
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
  const lines = deck.aiSuggestions.slice(0, 5).map(s => `<div class="text-sm text-gray-200">${s.rating ? `<strong>${s.rating}/10</strong> ` : ''}${s.name || (window.localCollection || localCollection)[s.firestoreId]?.name || 'Card'} - ${escapeHtml((s.reason || s.note || '').slice(0, 120))}</div>`);
  container.innerHTML = `<div class="space-y-1">${lines.join('')}</div>`;
}

export async function deleteDeck(deckId, alsoDeleteCards) {
  const userId = getUserId();
  if (!deckId) {
    const modal = document.getElementById('deck-delete-options-modal');
    if (modal) {
      const btn = modal.querySelector('#delete-deck-only-btn') || modal.querySelector('#delete-deck-and-cards-btn');
      deckId = btn && (btn.dataset.deckId || btn.dataset.id) ? (btn.dataset.deckId || btn.dataset.id) : deckId;
    }
    if (!deckId && window.views && window.views.singleDeck) deckId = window.views.singleDeck.dataset.deckId;
  }
  if (!deckId) { showToast('Deck not found.', 'error'); return; }
  try {
    await dataDeleteDeck(deckId, !!alsoDeleteCards, getUserId());
    showToast('Deck deleted successfully.', 'success');
    if (window.views && window.views.singleDeck && window.views.singleDeck.dataset.deckId === deckId) { if (typeof window.showView === 'function') window.showView('decks'); }
    closeModal('deck-delete-options-modal');
  } catch (error) {
    console.error('Error deleting deck:', error); showToast('Failed to delete deck.', 'error');
  }
}

export function addSingleDeckListeners(deckId) {
  const addBtn = document.getElementById('add-cards-to-deck-btn'); if (addBtn) addBtn.addEventListener('click', () => openAddCardsToDeckModal(deckId));

  // View Toggles
  const gridBtn = document.getElementById('view-toggle-grid');
  const tableBtn = document.getElementById('view-toggle-table');
  if (gridBtn) gridBtn.onclick = () => renderDecklist(deckId, 'grid');
  if (tableBtn) tableBtn.onclick = () => renderDecklist(deckId, 'table');

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
    const deckRef = doc(db, `artifacts/${appId}/users/${uid}/decks`, deckId);
    // If the deck locally shows a count > 1 for this card we remove the entry entirely for simplicity.
    await updateDoc(deckRef, { [`cards.${firestoreId}`]: deleteField() });
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
    const cardSnap = await getDoc(doc(db, `artifacts/${appId}/users/${uid}/collection`, firestoreId));
    if (!cardSnap || !cardSnap.exists()) {
      showToast && showToast('Collection entry for this card could not be found.', 'error');
      return;
    }
    const cardData = cardSnap.data();

    // Look for an existing collection stack with same scryfall id + finish
    const col = window.localCollection || localCollection;
    const existing = Object.values(col || {}).find(c => c && c.id === cardData.id && ((c.finish || '') === (cardData.finish || '')) && c.firestoreId !== firestoreId);

    const batch = writeBatch(db);
    const deckRef = doc(db, `artifacts/${appId}/users/${uid}/decks`, deckId);
    // remove deck reference
    batch.update(deckRef, { [`cards.${firestoreId}`]: deleteField() });

    if (existing && existing.firestoreId) {
      const existingRef = doc(db, `artifacts/${appId}/users/${uid}/collection`, existing.firestoreId);
      const newCount = (existing.count || 0) + (cardData.count || 1);
      batch.update(existingRef, { count: newCount });
      // delete the deck-specific collection doc to avoid duplicate docs
      const thisRef = doc(db, `artifacts/${appId}/users/${uid}/collection`, firestoreId);
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
  window.deleteDeck = deleteDeck; // override earlier shim with wrapper
  window.addSingleDeckListeners = addSingleDeckListeners;
  window.removeCardFromDeckAndReturnToCollection = removeCardFromDeckAndReturnToCollection;
}
