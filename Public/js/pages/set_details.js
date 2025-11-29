import { showToast } from '../lib/ui.js';
import { addCardToCollection, localCollection } from '../lib/data.js';
import { renderCollectionCard } from './collection.js';

let currentSetCode = null;
let currentSetCards = [];
let currentViewMode = 'grid'; // 'grid' | 'table'
let interactionMode = 'details'; // 'details' | 'add' | 'manage'
let activeFilters = {
  owned: false,
  missing: false
};
let groupBy = ''; // '' | 'number' | 'type' | 'rarity'

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
    groupBy = '';
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

  // Wire Back Button
  const backBtn = document.getElementById('set-details-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      if (typeof window.showView === 'function') window.showView('sets');
    };
  }

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

  // Interaction Mode Toggle & Grouping
  // Inject next to view toggles
  const viewControlsContainer = document.querySelector('#set-details-view .flex.items-center.gap-2.bg-gray-700');
  if (viewControlsContainer && viewControlsContainer.parentElement) {
    // We want to inject BEFORE the view controls container, or inside the parent flex container
    const parent = viewControlsContainer.parentElement; // The container holding "View" label and the toggle div
    const grandParent = parent.parentElement; // The main controls bar

    // Let's find the "View" label and toggle div wrapper
    // Actually, let's just append to the main controls bar if we can find it
    // The structure is: div.bg-gray-800... -> [Filters] [View Toggles]

    // Let's look for the container that holds the View Toggles
    // It's the last child of the controls bar usually

    let controlsGroup = document.getElementById('set-controls-group');
    if (!controlsGroup) {
      controlsGroup = document.createElement('div');
      controlsGroup.id = 'set-controls-group';
      controlsGroup.className = 'flex flex-wrap items-center gap-4';

      // Move existing View Toggles into this group if they aren't already
      // Actually, let's just insert our new controls before the View Toggles
      const viewLabel = Array.from(grandParent.children).find(el => el.textContent.includes('View'));
      if (viewLabel) {
        grandParent.insertBefore(controlsGroup, viewLabel);
      } else {
        grandParent.appendChild(controlsGroup);
      }
    }

    controlsGroup.innerHTML = ''; // Clear to rebuild

    // 1. Interaction Mode Toggle
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'flex bg-gray-900 rounded-lg p-1 border border-gray-600';
    toggleContainer.innerHTML = `
            <button id="set-mode-details" class="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2" title="View Card Details">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                Details
            </button>
            <button id="set-mode-add" class="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2" title="Quick Add Modal">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                Add
            </button>
            <button id="set-mode-manage" class="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2" title="Quick Edit Mode">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                Edit
            </button>
        `;
    controlsGroup.appendChild(toggleContainer);

    // 2. Grouping Dropdown
    const groupContainer = document.createElement('div');
    groupContainer.className = 'flex items-center gap-2 ml-2';
    groupContainer.innerHTML = `
            <label class="text-sm text-gray-400">Group:</label>
            <select id="set-group-select" class="bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">None</option>
                <option value="number">Number (50s)</option>
                <option value="type">Type</option>
                <option value="rarity">Rarity</option>
            </select>
        `;
    controlsGroup.appendChild(groupContainer);

    // Bind events
    document.getElementById('set-mode-details').onclick = () => { interactionMode = 'details'; updateModeToggle(); renderSetContent(); };
    document.getElementById('set-mode-add').onclick = () => { interactionMode = 'add'; updateModeToggle(); renderSetContent(); };
    document.getElementById('set-mode-manage').onclick = () => { interactionMode = 'manage'; updateModeToggle(); renderSetContent(); };

    const groupSelect = document.getElementById('set-group-select');
    groupSelect.value = groupBy;
    groupSelect.onchange = (e) => {
      groupBy = e.target.value;
      renderSetContent();
    };

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
  const btnManage = document.getElementById('set-mode-manage');

  const activeClass = 'px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white shadow-sm transition-all flex items-center gap-2';
  const inactiveClass = 'px-3 py-1.5 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-all flex items-center gap-2';

  if (btnDetails) btnDetails.className = interactionMode === 'details' ? activeClass : inactiveClass;
  if (btnAdd) btnAdd.className = interactionMode === 'add' ? activeClass : inactiveClass;
  if (btnManage) btnManage.className = interactionMode === 'manage' ? activeClass : inactiveClass;
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
    // Grouping Logic for Grid
    if (groupBy) {
      renderGroupedGrid(content, filtered);
    } else {
      renderGrid(content, filtered);
    }
  }
}

function renderGroupedGrid(container, cards) {
  const groups = {};

  cards.forEach(card => {
    let key = 'Other';
    if (groupBy === 'type') {
      key = card.type_line.split('—')[0].trim();
    } else if (groupBy === 'rarity') {
      key = card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1);
    } else if (groupBy === 'number') {
      const num = parseInt(card.collector_number) || 0;
      const chunk = Math.floor((num - 1) / 50);
      const start = chunk * 50 + 1;
      const end = (chunk + 1) * 50;
      key = `${start}-${end}`;
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  });

  container.innerHTML = '';
  container.className = 'space-y-8';

  // Sort keys
  let keys = Object.keys(groups);
  if (groupBy === 'number') {
    keys.sort((a, b) => parseInt(a.split('-')[0]) - parseInt(b.split('-')[0]));
  } else if (groupBy === 'rarity') {
    const order = ['Common', 'Uncommon', 'Rare', 'Mythic', 'Special', 'Bonus'];
    keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  } else {
    keys.sort();
  }

  keys.forEach(key => {
    const groupSection = document.createElement('div');
    // Default collapsed (hidden content), with toggle icon
    groupSection.innerHTML = `
            <h3 class="text-xl font-bold text-gray-300 mb-4 border-b border-gray-700 pb-2 sticky top-0 bg-gray-900/90 backdrop-blur-sm z-20 flex items-center justify-between cursor-pointer hover:text-white transition-colors group-header">
                <span>${key} <span class="text-sm font-normal text-gray-500 ml-2">(${groups[key].length})</span></span>
                <svg class="w-5 h-5 transform transition-transform -rotate-90 group-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </h3>
            <div class="group-grid-content hidden"></div>
        `;

    const header = groupSection.querySelector('.group-header');
    const content = groupSection.querySelector('.group-grid-content');
    const icon = groupSection.querySelector('.group-icon');

    header.onclick = () => {
      const isHidden = content.classList.contains('hidden');
      if (isHidden) {
        content.classList.remove('hidden');
        icon.classList.remove('-rotate-90');
      } else {
        content.classList.add('hidden');
        icon.classList.add('-rotate-90');
      }
    };

    renderGrid(content, groups[key]);
    container.appendChild(groupSection);
  });
}

function renderGrid(container, cards) {
  // Reuse collection grid styles with responsive flux
  container.className = 'grid gap-4';
  container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';

  container.innerHTML = cards.map(card => {
    // Check collection status
    const inCol = Object.values(localCollection).filter(c => c.id === card.id);
    const totalCount = inCol.reduce((sum, c) => sum + (c.count || 0), 0);
    const isOwned = totalCount > 0;

    const nonfoilCount = inCol.find(c => c.finish === 'nonfoil')?.count || 0;
    const foilCount = inCol.find(c => c.finish === 'foil')?.count || 0;

    // Visuals
    const opacity = isOwned ? 'opacity-100' : 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all';
    const border = isOwned ? 'border-indigo-500/50' : 'border-transparent';

    // Image - Robust fallback for split cards
    let img = card.image_uris?.normal || card.image_uris?.art_crop;
    if (!img && card.card_faces && card.card_faces.length > 0) {
      img = card.card_faces[0].image_uris?.normal || card.card_faces[0].image_uris?.art_crop;
    }
    img = img || '';

    // Quick Edit Overlay
    let quickEditHTML = '';
    let aspectRatio = 'aspect-[2.5/3.5]';
    let imgPadding = '';

    if (interactionMode === 'manage') {
      aspectRatio = 'aspect-[3.2/3.5]'; // Wider to accommodate bar
      imgPadding = 'pr-16'; // Make space on right
      quickEditHTML = `
                <div class="absolute inset-y-0 right-0 w-16 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-1 z-20 border-l border-gray-700" onclick="event.stopPropagation()">
                    
                    <!-- Non-Foil -->
                    <div class="flex flex-col items-center gap-0.5 w-full">
                        <button class="w-full bg-gray-700 hover:bg-gray-600 text-white text-[10px] rounded-t py-1" onclick="window.quickUpdate('${card.id}', 'nonfoil', 1)">▲</button>
                        <div class="w-full bg-gray-800 text-center text-xs font-bold text-gray-200 py-0.5 border-x border-gray-700">${nonfoilCount}</div>
                        <button class="w-full bg-gray-700 hover:bg-gray-600 text-white text-[10px] rounded-b py-1" onclick="window.quickUpdate('${card.id}', 'nonfoil', -1)">▼</button>
                        <span class="text-[9px] text-gray-500 uppercase mt-0.5">Normal</span>
                    </div>

                    <div class="w-full h-px bg-gray-700 my-1"></div>

                    <!-- Foil -->
                    <div class="flex flex-col items-center gap-0.5 w-full">
                        <button class="w-full bg-indigo-900/50 hover:bg-indigo-800/50 text-indigo-200 text-[10px] rounded-t py-1" onclick="window.quickUpdate('${card.id}', 'foil', 1)">▲</button>
                        <div class="w-full bg-gray-800 text-center text-xs font-bold text-indigo-300 py-0.5 border-x border-gray-700">${foilCount}</div>
                        <button class="w-full bg-indigo-900/50 hover:bg-indigo-800/50 text-indigo-200 text-[10px] rounded-b py-1" onclick="window.quickUpdate('${card.id}', 'foil', -1)">▼</button>
                        <span class="text-[9px] text-indigo-400 uppercase mt-0.5">Foil</span>
                    </div>

                </div>
            `;
    }

    return `
      <div class="relative group ${aspectRatio} bg-gray-900 rounded-xl overflow-hidden border-2 ${border} ${opacity} cursor-pointer set-card-item" data-card-id="${card.id}">
        ${quickEditHTML}
        <img src="${img}" class="w-full h-full object-cover ${imgPadding}" loading="lazy" />
        ${isOwned && interactionMode !== 'manage' ? `<div class="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">${totalCount}</div>` : ''}
        <div class="absolute bottom-0 left-0 right-0 bg-black/80 p-2 transform translate-y-full group-hover:translate-y-0 transition-transform z-10">
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
  if (interactionMode === 'manage') return; // Click handled by overlay buttons

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

window.quickUpdate = async (cardId, finish, delta) => {
  const card = currentSetCards.find(c => c.id === cardId);
  if (!card) return;

  // Find existing
  const existing = Object.values(localCollection).find(c => c.id === cardId && c.finish === finish);
  const currentCount = existing ? existing.count : 0;

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

  updateSetStats();
  // Re-render only the specific card if possible, or full content
  // Full content is safer to ensure stats/visuals update correctly
  renderSetContent();
};

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

  // Ensure modal exists
  let modal = document.getElementById('set-add-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'set-add-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm hidden';
    // Close on click outside
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    };
    document.body.appendChild(modal);
  }

  renderModalContent();
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
