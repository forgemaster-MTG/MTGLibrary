import { showToast } from '../lib/ui.js';
import { addCardToCollection, localCollection } from '../lib/data.js';
import { renderCollectionCard } from './collection.js';

let currentSetCode = null;
let currentSetCards = [];
let currentViewMode = 'grid'; // 'grid' | 'table'
let interactionMode = 'details'; // 'details' | 'add'
let activeFilters = {
  owned: false,
  missing: false
};

// --- Main Entry Point ---
export async function showSetView(code) {
  currentSetCode = code;
  try {
    // Switch view
    if (typeof window.showView === 'function') window.showView('set-details');

    // Reset State
    currentSetCards = [];
    activeFilters = { owned: false, missing: false };
    interactionMode = 'details'; // Default to details
    updateFilterUI();

    // Show Loading
    const content = document.getElementById('set-details-content');
    if (content) {
      content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <div class="text-gray-400">Loading set data...</div>
        </div>
      `;
    }

    // Fetch Data
    const cards = await fetchAllCardsForSet(code);
    currentSetCards = cards.sort((a, b) => {
      const numA = parseInt(a.collector_number) || 0;
      const numB = parseInt(b.collector_number) || 0;
      return numA - numB;
    });

    // Render
    renderSetHeader(code, cards);
    renderSetContent();

  } catch (err) {
    console.error('showSetView error', err);
    showToast('Failed to load set.', 'error');
  }
}

// --- Data Fetching ---
async function fetchAllCardsForSet(code) {
  const encoded = encodeURIComponent(`set:${code}`);
  let url = `https://api.scryfall.com/cards/search?q=${encoded}&order=set&unique=prints`;
  const results = [];

  // Safety break
  let pages = 0;
  while (url && pages < 20) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch set cards');
    const data = await res.json();
    if (Array.isArray(data.data)) results.push(...data.data);
    if (data.has_more && data.next_page) url = data.next_page;
    else url = null;
    pages++;
    await new Promise(r => setTimeout(r, 50)); // Rate limit polite
  }
  return results;
}

// --- Rendering ---
function renderSetHeader(code, cards) {
  // Title & Meta
  const titleEl = document.getElementById('set-details-title');
  const metaEl = document.getElementById('set-details-meta');
  if (titleEl) titleEl.textContent = `${code.toUpperCase()} Set Details`; // Could fetch full set name if we had it, or derive from first card
  if (metaEl) metaEl.textContent = `${cards.length} cards`;

  // Update Stats
  updateSetStats();

  // Render Controls (Filters & Toggles)
  renderControls();
}

function renderControls() {
  // We need to inject the controls into the DOM or bind existing ones.
  // The HTML structure in index.html has placeholders.
  // Let's bind the View Tabs (Grid/Table) and Filters.
  // And add the new Interaction Mode toggle.

  const gridTab = document.getElementById('set-view-tab-grid');
  const tableTab = document.getElementById('set-view-tab-table');

  if (gridTab) {
    gridTab.onclick = () => {
      currentViewMode = 'grid';
      updateViewTabs();
      renderSetContent();
    };
  }
  if (tableTab) {
    tableTab.onclick = () => {
      currentViewMode = 'table';
      updateViewTabs();
      renderSetContent();
    };
  }

  const ownedFilter = document.getElementById('set-filter-owned');
  const missingFilter = document.getElementById('set-filter-missing');

  if (ownedFilter) {
    ownedFilter.checked = activeFilters.owned;
    ownedFilter.onchange = (e) => {
      activeFilters.owned = e.target.checked;
      if (activeFilters.owned) {
        activeFilters.missing = false;
        if (missingFilter) missingFilter.checked = false;
      }
      renderSetContent();
    };
  }

  if (missingFilter) {
    missingFilter.checked = activeFilters.missing;
    missingFilter.onchange = (e) => {
      activeFilters.missing = e.target.checked;
      if (activeFilters.missing) {
        activeFilters.owned = false;
        if (ownedFilter) ownedFilter.checked = false;
      }
      renderSetContent();
    };
  }

  // Interaction Mode Toggle
  // We'll inject this dynamically if it doesn't exist, or we can reuse the "Add Cards" button area?
  // The user wants a toggle between "Details" and "Add Cards".
  // Let's replace the "Add Cards" button with a segmented control or toggle.
  // Or add it next to the filters.

  // Let's find the container for filters and inject/update the toggle.
  const controlsContainer = document.querySelector('#set-details-view .flex.items-center.gap-3');
  if (controlsContainer) {
    // Check if we already added the toggle
    let toggleContainer = document.getElementById('set-interaction-toggle');
    if (!toggleContainer) {
      toggleContainer = document.createElement('div');
      toggleContainer.id = 'set-interaction-toggle';
      toggleContainer.className = 'flex bg-gray-900 rounded-lg p-1 border border-gray-600 ml-4';
      toggleContainer.innerHTML = `
                <button id="set-mode-details" class="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    Details
                </button>
                <button id="set-mode-add" class="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Add Cards
                </button>
            `;
      // Remove the old "Add Cards" button if it exists to avoid confusion?
      const oldBtn = document.getElementById('set-add-cards-modal-btn');
      if (oldBtn) oldBtn.remove();

      controlsContainer.appendChild(toggleContainer);
    }

    // Bind events
    const btnDetails = document.getElementById('set-mode-details');
    const btnAdd = document.getElementById('set-mode-add');

    if (btnDetails) btnDetails.onclick = () => { interactionMode = 'details'; updateModeToggle(); };
    if (btnAdd) btnAdd.onclick = () => { interactionMode = 'add'; updateModeToggle(); };

    updateModeToggle();
  }

  updateViewTabs();
}

function updateViewTabs() {
  const gridTab = document.getElementById('set-view-tab-grid');
  const tableTab = document.getElementById('set-view-tab-table');
  if (gridTab) {
    gridTab.className = currentViewMode === 'grid'
      ? 'px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white shadow-sm transition-all'
      : 'px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-all';
  }
  if (tableTab) {
    tableTab.className = currentViewMode === 'table'
      ? 'px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white shadow-sm transition-all'
      : 'px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-all';
  }
}

function updateModeToggle() {
  const btnDetails = document.getElementById('set-mode-details');
  const btnAdd = document.getElementById('set-mode-add');

  if (btnDetails) {
    btnDetails.className = interactionMode === 'details'
      ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white shadow-sm transition-all flex items-center gap-2'
      : 'px-3 py-1.5 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-all flex items-center gap-2';
  }
  if (btnAdd) {
    btnAdd.className = interactionMode === 'add'
      ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white shadow-sm transition-all flex items-center gap-2'
      : 'px-3 py-1.5 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-all flex items-center gap-2';
  }
}

function updateFilterUI() {
  const ownedFilter = document.getElementById('set-filter-owned');
  const missingFilter = document.getElementById('set-filter-missing');
  if (ownedFilter) ownedFilter.checked = activeFilters.owned;
  if (missingFilter) missingFilter.checked = activeFilters.missing;
}

function updateSetStats() {
  if (!currentSetCards.length) return;

  let collectedCount = 0;
  let totalValue = 0;

  // Map set cards to collection
  currentSetCards.forEach(card => {
    // Find all copies in collection for this Scryfall ID
    const inCollection = Object.values(localCollection).filter(c => c.id === card.id);
    if (inCollection.length > 0) {
      collectedCount++; // Count unique cards collected, not total copies
      inCollection.forEach(c => {
        const price = (c.finish === 'foil' ? card.prices?.usd_foil : card.prices?.usd) || 0;
        totalValue += parseFloat(price) * (c.count || 1);
      });
    }
  });

  const collectedEl = document.getElementById('set-stats-collected');
  const valueEl = document.getElementById('set-stats-value');

  if (collectedEl) collectedEl.textContent = `${collectedCount}/${currentSetCards.length}`;
  if (valueEl) valueEl.textContent = `$${totalValue.toFixed(2)}`;
}

function renderSetContent() {
  const content = document.getElementById('set-details-content');
  if (!content) return;

  // Filter
  let filtered = currentSetCards;
  if (activeFilters.owned) {
    filtered = filtered.filter(card => Object.values(localCollection).some(c => c.id === card.id));
  } else if (activeFilters.missing) {
    filtered = filtered.filter(card => !Object.values(localCollection).some(c => c.id === card.id));
  }

  if (filtered.length === 0) {
    content.innerHTML = `<div class="text-center text-gray-500 py-10">No cards match the filters.</div>`;
    return;
  }

  if (currentViewMode === 'table') {
    renderTable(content, filtered);
  } else {
    renderGrid(content, filtered);
  }
}

function renderGrid(container, cards) {
  // Reuse collection grid styles
  container.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';

  container.innerHTML = cards.map(card => {
    // Check collection status
    const inCol = Object.values(localCollection).filter(c => c.id === card.id);
    const totalCount = inCol.reduce((sum, c) => sum + (c.count || 0), 0);
    const isOwned = totalCount > 0;

    // Visuals
    const opacity = isOwned ? 'opacity-100' : 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all';
    const border = isOwned ? 'border-indigo-500/50' : 'border-transparent';

    // Image
    const img = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '';

    return `
      <div class="relative group aspect-[2.5/3.5] bg-gray-900 rounded-xl overflow-hidden border-2 ${border} ${opacity} cursor-pointer set-card-item" data-card-id="${card.id}">
        <img src="${img}" class="w-full h-full object-cover" loading="lazy" />
        ${isOwned ? `<div class="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">${totalCount}</div>` : ''}
        <div class="absolute bottom-0 left-0 right-0 bg-black/80 p-2 transform translate-y-full group-hover:translate-y-0 transition-transform">
          <div class="text-xs font-bold text-white truncate">${card.name}</div>
          <div class="text-[10px] text-gray-400">#${card.collector_number} • ${card.rarity}</div>
        </div>
      </div>
    `;
  }).join('');

  // Click handler for details/add
  container.querySelectorAll('.set-card-item').forEach(el => {
    el.addEventListener('click', () => handleCardClick(el.dataset.cardId));
  });
}

function handleCardClick(cardId) {
  if (interactionMode === 'add') {
    openAddCardModal(cardId);
  } else {
    // Details Mode
    const card = currentSetCards.find(c => c.id === cardId);
    if (!card) return;

    // Try to find a version in collection to pass firestoreId
    const inCollection = Object.values(localCollection).find(c => c.id === cardId);

    const cardToRender = inCollection ? inCollection : card;

    if (typeof window.renderCardDetailsModal === 'function') {
      window.renderCardDetailsModal(cardToRender);
      if (typeof window.openModal === 'function') window.openModal('card-details-modal');
    } else {
      console.warn('renderCardDetailsModal not found');
    }
  }
}

function renderTable(container, cards) {
  container.className = 'overflow-x-auto';

  const rows = cards.map(card => {
    const inCol = Object.values(localCollection).filter(c => c.id === card.id);
    const nonfoil = inCol.find(c => c.finish === 'nonfoil')?.count || 0;
    const foil = inCol.find(c => c.finish === 'foil')?.count || 0;

    return `
      <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
        <td class="p-3 text-sm text-gray-400">#${card.collector_number}</td>
        <td class="p-3">
          <div class="flex items-center gap-3 cursor-pointer hover:text-indigo-400 transition-colors" onclick="window.handleSetTableClick('${card.id}')">
            <div class="w-8 h-8 rounded overflow-hidden bg-gray-900 flex-shrink-0">
               <img src="${card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || ''}" class="w-full h-full object-cover" />
            </div>
            <span class="font-medium text-gray-200">${card.name}</span>
          </div>
        </td>
        <td class="p-3 text-sm text-gray-400">${card.rarity}</td>
        <td class="p-3 text-sm text-gray-400">${card.type_line.split('—')[0]}</td>
        <td class="p-3">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 uppercase">Non-Foil</span>
              <input type="number" min="0" class="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-center focus:border-indigo-500 focus:outline-none mass-update-input" 
                data-card-id="${card.id}" data-finish="nonfoil" value="${nonfoil}" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 uppercase">Foil</span>
              <input type="number" min="0" class="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-center focus:border-indigo-500 focus:outline-none mass-update-input" 
                data-card-id="${card.id}" data-finish="foil" value="${foil}" />
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="text-xs text-gray-500 uppercase border-b border-gray-700">
          <th class="p-3">#</th>
          <th class="p-3">Card</th>
          <th class="p-3">Rarity</th>
          <th class="p-3">Type</th>
          <th class="p-3">Collection</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // Bind inputs
  container.querySelectorAll('.mass-update-input').forEach(input => {
    input.addEventListener('change', (e) => handleMassUpdate(e.target));
  });
}

// Expose handler for table click
window.handleSetTableClick = (cardId) => handleCardClick(cardId);

// --- Interaction Handlers ---

async function handleMassUpdate(input) {
  const cardId = input.dataset.cardId;
  const finish = input.dataset.finish;
  const newCount = parseInt(input.value) || 0;

  if (newCount < 0) return;

  const card = currentSetCards.find(c => c.id === cardId);
  if (!card) return;

  // Find existing
  const existing = Object.values(localCollection).find(c => c.id === cardId && c.finish === finish);
  const currentCount = existing ? existing.count : 0;
  const diff = newCount - currentCount;

  if (diff === 0) return;

  // Optimistic update for UI responsiveness (optional, but good)
  // We rely on data.js to toast and update

  await addCardToCollection({
    ...card,
    finish,
    count: diff, // addCardToCollection adds this amount
    // Ensure we pass necessary fields for a new card
    scryfall_id: card.id,
    set: card.set,
    collector_number: card.collector_number,
    image_uris: card.image_uris,
    prices: card.prices
  });

  updateSetStats(); // Refresh header stats
}

// --- Sequential Add Modal ---
let modalCurrentIndex = 0;
let modalCards = [];

function openAddCardModal(startCardId) {
  // Filter cards based on current view filters or just use all?
  // User said "modal that lets you select a card type and it cycles through in numerical order"
  // Let's use the full sorted set list
  modalCards = currentSetCards;
  modalCurrentIndex = modalCards.findIndex(c => c.id === startCardId);
  if (modalCurrentIndex === -1) modalCurrentIndex = 0;

  renderModalContent();

  // Show modal (assuming a generic modal container exists or we create one)
  // We'll create a custom overlay for this specific flow
  let modal = document.getElementById('set-add-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'set-add-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm hidden';
    document.body.appendChild(modal);
  }
  modal.classList.remove('hidden');
}

function renderModalContent() {
  const modal = document.getElementById('set-add-modal');
  if (!modal) return;

  const card = modalCards[modalCurrentIndex];
  if (!card) return;

  // Get current counts
  const inCol = Object.values(localCollection).filter(c => c.id === card.id);
  const nonfoil = inCol.find(c => c.finish === 'nonfoil')?.count || 0;
  const foil = inCol.find(c => c.finish === 'foil')?.count || 0;

  const img = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '';

  modal.innerHTML = `
    <div class="bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden flex flex-col md:flex-row border border-gray-700 relative">
      <button class="absolute top-4 right-4 text-gray-400 hover:text-white z-10" onclick="document.getElementById('set-add-modal').classList.add('hidden')">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>

      <!-- Left: Image -->
      <div class="w-full md:w-1/2 bg-black/50 p-8 flex items-center justify-center relative">
         <button class="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gray-700/50 hover:bg-gray-600 text-white p-2 rounded-full" onclick="window.setModalPrev()">
           <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
         </button>
         <img src="${img}" class="max-h-[500px] rounded-lg shadow-lg" />
         <button class="absolute right-4 top-1/2 transform -translate-y-1/2 bg-gray-700/50 hover:bg-gray-600 text-white p-2 rounded-full" onclick="window.setModalNext()">
           <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
         </button>
      </div>

      <!-- Right: Controls -->
      <div class="w-full md:w-1/2 p-8 flex flex-col">
        <div class="mb-6">
          <h3 class="text-2xl font-bold text-white mb-1">${card.name}</h3>
          <p class="text-gray-400">#${card.collector_number} • ${card.rarity} • ${card.set_name}</p>
        </div>

        <div class="space-y-6 flex-grow">
          <!-- Non-Foil Control -->
          <div class="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
            <div class="flex justify-between items-center mb-2">
              <span class="font-semibold text-gray-200">Non-Foil</span>
              <span class="text-sm text-gray-400">$${card.prices?.usd || '---'}</span>
            </div>
            <div class="flex items-center gap-4">
              <button class="w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center transition-colors"
                onclick="window.updateModalCount('nonfoil', -1)">-</button>
              <span class="text-3xl font-bold text-indigo-400 w-16 text-center">${nonfoil}</span>
              <button class="w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center transition-colors"
                onclick="window.updateModalCount('nonfoil', 1)">+</button>
            </div>
          </div>

          <!-- Foil Control -->
          <div class="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
            <div class="flex justify-between items-center mb-2">
              <span class="font-semibold text-gray-200">Foil</span>
              <span class="text-sm text-gray-400">$${card.prices?.usd_foil || '---'}</span>
            </div>
            <div class="flex items-center gap-4">
              <button class="w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center transition-colors"
                onclick="window.updateModalCount('foil', -1)">-</button>
              <span class="text-3xl font-bold text-indigo-400 w-16 text-center">${foil}</span>
              <button class="w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl flex items-center justify-center transition-colors"
                onclick="window.updateModalCount('foil', 1)">+</button>
            </div>
          </div>
        </div>

        <div class="mt-auto pt-6 border-t border-gray-700 flex justify-between text-sm text-gray-500">
           <span>Use arrow keys to navigate</span>
           <span>${modalCurrentIndex + 1} / ${modalCards.length}</span>
        </div>
      </div>
    </div>
  `;
}

// Global helpers for modal interaction
window.setModalPrev = () => {
  if (modalCurrentIndex > 0) {
    modalCurrentIndex--;
    renderModalContent();
  }
};

window.setModalNext = () => {
  if (modalCurrentIndex < modalCards.length - 1) {
    modalCurrentIndex++;
    renderModalContent();
  }
};

window.updateModalCount = async (finish, delta) => {
  const card = modalCards[modalCurrentIndex];
  if (!card) return;

  // Find existing to get current count
  const existing = Object.values(localCollection).find(c => c.id === card.id && c.finish === finish);
  const currentCount = existing ? existing.count : 0;

  // Prevent negative
  if (currentCount + delta < 0) return;

  await addCardToCollection({
    ...card,
    finish,
    count: delta,
    scryfall_id: card.id,
    set: card.set,
    collector_number: card.collector_number,
    image_uris: card.image_uris,
    prices: card.prices
  });

  renderModalContent(); // Re-render to show new count
  updateSetStats(); // Update header stats
  renderSetContent(); // Update grid/table behind modal
};

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('set-add-modal');
  if (!modal || modal.classList.contains('hidden')) return;

  if (e.key === 'ArrowLeft') window.setModalPrev();
  if (e.key === 'ArrowRight') window.setModalNext();
  if (e.key === 'Escape') modal.classList.add('hidden');
});
