/**
 * Lightweight module providing deck suggestion flows using Gemini.
 * Exposes `openDeckSuggestionsModal(deckId)` as default.
 *
 * This version uses a "Send all, then filter" pattern:
 * 1. For each card type (Creature, Instant, etc.), find ALL available cards
 * from the user's collection that match the deck's color identity
 * and are not already in this deck.
 * 2. Send this entire list of candidates (up to ~300) to Gemini in a
 * single API call for that type.
 * 3. Ask Gemini to return a list of the *best* cards from that list,
 * limited to the number needed for the deck (e.g., "up to 4").
 * 4. The model returns JSON with its selections, ratings, and reasons.
 * 5. We then strictly enforce the "up to 4" limit on our side before
 * adding them to the deck.
 *
 * This is more robust than the "Ask, then Filter" pattern as it gives
 * the AI full context of all available cards to make the best tradeoffs.
 * It relies on Gemini's native JSON mode for reliable responses.
 */

import { showToast, openModal, closeModal } from '../lib/ui.js';
import { localCollection, localDecks } from '../lib/data.js';
import { calculateBasicLandNeeds } from '../lib/manaCalculator.js';

// --- JSON Schemas for Gemini ---

// This is the schema we *expect* Gemini to return.
// It's a list of suggestions.
const suggestionsResponseSchema = {
  type: "OBJECT",
  properties: {
    "suggestions": {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          "firestoreId": { "type": "STRING" },
          "rating": { "type": "NUMBER" },
          "reason": { "type": "STRING" }
        },
        required: ["firestoreId", "rating", "reason"]
      }
    }
  },
  required: ["suggestions"]
};

// --- End Schemas ---

// Local copy to avoid circular module imports. Validates that cardColors is a subset of commanderColors.
function isColorIdentityValid(cardColors, commanderColors) {
  if (!cardColors || cardColors.length === 0) return true; // Colorless cards are always valid
  if (!commanderColors || commanderColors.length === 0) return cardColors.length === 0; // Only colorless cards if commander is colorless

  const commanderSet = new Set(commanderColors);
  return (cardColors || []).every(c => commanderSet.has(c));
}

/**
 * Open a deck-scoped MTG chat helper that pre-populates the chat with
 * summary context about the deck and calls the existing MTG chat handler
 * or module if available.
 * @param {string} deckId
 */
function openDeckHelp(deckId) {
  try {
    const deck = (window.localDecks || localDecks)[deckId];
    if (!deck) { showToast('Deck not found for Deck Help.', 'error'); return; }

    // Build a short summary: name, format, commander, counts by type, and a sample of cards
    const commanderName = deck.commander?.name || 'Unknown';
    const cards = deck.cards || {};
    const localColl = window.localCollection || localCollection;
    const total = Object.values(cards).reduce((s, c) => s + (c.count || 0), 0);
    const typeCounts = {};
    const allCardsList = [];
    for (const fid of Object.keys(cards)) {
      const cdata = localColl[fid] || { name: cards[fid].name || fid, type_line: cards[fid].type_line || '' };
      const mainType = (cdata.type_line || '').split(' — ')[0] || 'Other';
      typeCounts[mainType] = (typeCounts[mainType] || 0) + (cards[fid].count || 0);
      allCardsList.push(`${cdata.name} x${cards[fid].count || 1}`);
    }

    const countsText = Object.keys(typeCounts).map(k => `${k}: ${typeCounts[k]}`).join(', ');
    const msg = `Deck Help Request:\nDeck: ${deck.name} (${deck.format || 'commander'})\nCommander: ${commanderName}\nTotal cards (non-commander): ${total}\nCounts: ${countsText}\n\nCurrent Deck List:\n${allCardsList.join('\n')}\n\nPlease provide guidance, improvements, and suggestions for this deck.\nIMPORTANT: Do NOT suggest adding any card that is already in the deck (listed above), unless it is a Basic Land. Ensure no duplicate names within your suggestions.`;

    // Prefer module-level MTG chat handler if present
    if (typeof window.__module_handleMtgChat === 'function') {
      try { window.__module_handleMtgChat(deckId, msg); return; } catch (e) { console.debug('module mtg chat handler failed', e); }
    }

    // Fallback to delegator
    if (typeof window.handleMtgChat === 'function') {
      try { window.handleMtgChat(msg); return; } catch (e) { console.debug('delegated handleMtgChat failed', e); }
    }

    // Last-resort: open the AI suggestions modal with the message in the status area
    try {
      openDeckSuggestionsModal(deckId, { type: null });
      const status = document.getElementById('deck-suggestions-status');
      if (status) status.textContent = 'Deck Help context loaded. Paste the following into MTG Chat:';
      appendResultBlock('DeckHelp', '', 0, 0, false, msg);
    } catch (e) {
      console.error('Could not open Deck Help UI', e);
      showToast('Deck Help is unavailable in this build.', 'error');
    }
  } catch (err) { console.error('openDeckHelp failed', err); showToast('Deck Help failed to start.', 'error'); }
}

// Expose helpers
try { window.openDeckSuggestionsModal = openDeckSuggestionsModal; window.openDeckHelp = openDeckHelp; } catch (e) { }

export { openDeckSuggestionsModal, openDeckHelp };

// --- Internal Module State ---
let allSuggestedMap = {}; // Map of firestoreId -> suggestion object
let previewSort = { field: 'rating', dir: -1 }; // Preview sorting state
let currentDeckId = null; // Store the deckId for the active modal
let currentTypeFilter = null; // If set, only process this type on Start

/**
 * Creates the modal element and appends it to the DOM if it doesn't exist.
 * This version uses the original two-column UI.
 */
function createModalIfNeeded() {
  if (document.getElementById('deck-suggestions-modal')) return;

  const modalHtml = `
  <div id="deck-suggestions-modal" class="modal hidden fixed inset-0 flex items-center justify-center z-50 modal-backdrop">
    <div class="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
      
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
        <div>
          <h3 id="deck-suggestions-title" class="text-xl font-bold text-white">AI Deck Builder</h3>
          <p id="deck-suggestions-subtitle" class="text-sm text-gray-400">Use AI to suggest cards for your deck.</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 bg-gray-800 rounded-lg p-1 border border-gray-700">
            <span class="text-xs text-gray-400 px-2">Mode:</span>
            <select id="deck-suggestions-mode-select" class="bg-transparent text-sm text-white focus:outline-none cursor-pointer">
              <option value="preview" selected>Preview & Approve</option>
              <option value="auto">Auto-Apply</option>
            </select>
          </div>
          <button id="deck-suggestions-start-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
            <span>Start Analysis</span>
          </button>
          <button id="deck-suggestions-cancel-btn" class="text-gray-400 hover:text-white p-2">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>

      <!-- Status Log (Collapsible/Scrollable) -->
      <div class="bg-gray-950 border-b border-gray-800 p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Analysis Log</span>
          <span id="deck-suggestions-status" class="text-xs text-indigo-400 font-mono">Ready to start.</span>
        </div>
        <div id="deck-suggestions-results" class="h-24 overflow-y-auto font-mono text-xs text-gray-400 space-y-1 pr-2 custom-scrollbar">
          <div class="text-gray-600 italic">Waiting for start...</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center border-b border-gray-700 bg-gray-800/30 px-4 gap-1 overflow-x-auto" id="deck-suggestions-tabs">
        <!-- Tabs injected dynamically -->
        <button class="px-4 py-3 text-sm font-medium text-indigo-400 border-b-2 border-indigo-500">All Suggestions</button>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-hidden relative bg-gray-900" id="deck-suggestions-content-area">
        <!-- Preview Table -->
        <div id="deck-suggestions-preview" class="absolute inset-0 overflow-auto custom-scrollbar p-4">
           <table class="w-full text-sm text-left text-gray-300 border-collapse">
            <thead class="text-xs text-gray-500 uppercase bg-gray-800/50 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th class="p-3 font-medium">Add</th>
                <th class="p-3 font-medium cursor-pointer hover:text-white group" data-sort="name">Name <span class="invisible group-hover:visible">↕</span></th>
                <th class="p-3 font-medium cursor-pointer hover:text-white group" data-sort="type">Type <span class="invisible group-hover:visible">↕</span></th>
                <th class="p-3 font-medium text-center">CMC</th>
                <th class="p-3 font-medium text-center">Rating</th>
                <th class="p-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody id="deck-suggestions-preview-body" class="divide-y divide-gray-800">
              <!-- Rows -->
            </tbody>
          </table>
          <div id="deck-suggestions-empty-state" class="hidden flex flex-col items-center justify-center h-full text-gray-500">
            <p>No suggestions yet.</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between">
        <div class="flex flex-col">
          <div class="text-sm text-gray-400" id="deck-suggestions-preview-selected-count">0 cards selected</div>
          <div class="flex items-center gap-2 mt-1">
             <div id="deck-suggestions-save-status" class="text-xs text-gray-500">&nbsp;</div>
             <button id="deck-suggestions-save-retry-btn" class="text-xs text-indigo-400 hover:text-indigo-300 underline hidden">Retry Save</button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button id="deck-suggestions-rerun-btn" class="text-gray-400 hover:text-white text-sm px-3 py-2 hidden">Find Replacements</button>
          <button id="deck-suggestions-apply-selected-btn" class="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed hidden">
            Add Selected Cards
          </button>
        </div>
      </div>

    </div>
  </div>
  `;
  const wrapper = document.createElement('div'); wrapper.innerHTML = modalHtml;
  document.body.appendChild(wrapper);

  // Wire cancel
  document.getElementById('deck-suggestions-cancel-btn').addEventListener('click', () => closeModal('deck-suggestions-modal'));
}

/**
 * Main entry point. Opens the modal and prepares it for a deck.
 * @param {string} deckId - The Firestore ID of the deck.
 */
function openDeckSuggestionsModal(deckId, opts = {}) {
  createModalIfNeeded();
  currentDeckId = deckId; // Store deckId
  currentTypeFilter = opts.type || null;

  const title = document.getElementById('deck-suggestions-title');
  const deck = (window.localDecks || localDecks)[deckId];
  if (!deck) { showToast('Deck not found for suggestions.', 'error'); return; }

  title.textContent = `AI Deck Builder: ${deck.name}`;
  allSuggestedMap = {};

  // If deck has persisted aiSuggestions, seed them into the preview map
  if (deck.aiSuggestions && typeof deck.aiSuggestions === 'object' && !Array.isArray(deck.aiSuggestions)) {
    Object.entries(deck.aiSuggestions).forEach(([id, s]) => {
      if (!s || !id) return;
      const card = (window.localCollection || localCollection)[id] || {};
      allSuggestedMap[id] = {
        ...card,
        firestoreId: id,
        rating: s.rating ?? null,
        reason: s.reason || s.note || '',
        slotType: s.slotType || card.type_line?.split(' — ')[0] || 'Unknown',
        sourceType: s.sourceType || card.type_line?.split(' — ')[0] || 'Unknown',
      };
    });
  }

  // --- Reset UI states ---
  document.getElementById('deck-suggestions-status').textContent = 'Ready to start.';
  document.getElementById('deck-suggestions-results').innerHTML = `<div class="text-gray-500 italic">Press "Start Analysis" to begin...</div>`;
  document.getElementById('deck-suggestions-preview-body').innerHTML = '';
  document.getElementById('deck-suggestions-empty-state').classList.remove('hidden');

  // Reset Tabs
  const tabsContainer = document.getElementById('deck-suggestions-tabs');
  tabsContainer.innerHTML = `<button class="px-4 py-3 text-sm font-medium text-white border-b-2 border-indigo-500 transition-colors" data-tab="all">All Suggestions</button>`;

  // Reset buttons
  document.getElementById('deck-suggestions-apply-selected-btn').classList.add('hidden');
  document.getElementById('deck-suggestions-rerun-btn').classList.add('hidden');

  const startBtn = document.getElementById('deck-suggestions-start-btn');
  startBtn.disabled = false;
  startBtn.innerHTML = `<span>Start Analysis</span>`;
  startBtn.onclick = () => startSuggestionFlow(deckId);

  // Wire Sort control (header clicks)
  document.querySelectorAll('#deck-suggestions-preview thead th[data-sort]').forEach(th => {
    th.onclick = () => {
      const field = th.dataset.sort;
      if (previewSort.field === field) {
        previewSort.dir = previewSort.dir * -1;
      } else {
        previewSort.field = field;
        previewSort.dir = 1; // Default asc for text, desc for rating? 
        if (field === 'rating') previewSort.dir = -1;
      }
      reRenderPreviewTable();
    };
  });

  // --- Event Listeners for checkboxes ---
  const updateCheckboxCount = () => {
    const cnt = document.querySelectorAll('.deck-suggestion-checkbox:checked').length;
    const el = document.getElementById('deck-suggestions-preview-selected-count');
    if (el) el.textContent = `${cnt} cards selected`;

    const applyBtn = document.getElementById('deck-suggestions-apply-selected-btn');
    if (cnt > 0) {
      applyBtn.disabled = false;
      applyBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      applyBtn.disabled = true;
      applyBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  };

  // Need to use event delegation on the body since table rows are dynamic
  document.body.removeEventListener('change', handleModalChangeEvents); // Remove old listener
  document.body.addEventListener('change', handleModalChangeEvents); // Add new one

  // Also listen for tab clicks
  tabsContainer.onclick = (e) => {
    if (e.target.tagName === 'BUTTON') {
      // clear active state
      tabsContainer.querySelectorAll('button').forEach(b => {
        b.classList.remove('text-white', 'border-indigo-500');
        b.classList.add('text-gray-400', 'border-transparent', 'hover:text-gray-200');
      });
      // set active
      e.target.classList.remove('text-gray-400', 'border-transparent', 'hover:text-gray-200');
      e.target.classList.add('text-white', 'border-indigo-500');

      // Filter view
      const type = e.target.dataset.tab;
      reRenderPreviewTable(type);
    }
  };

  openModal('deck-suggestions-modal');

  // If we seeded suggestions, render preview immediately
  if (Object.keys(allSuggestedMap).length > 0) {
    document.getElementById('deck-suggestions-empty-state').classList.add('hidden');
    reRenderPreviewTable();
    // Show buttons
    document.getElementById('deck-suggestions-apply-selected-btn').classList.remove('hidden');
    document.getElementById('deck-suggestions-rerun-btn').classList.remove('hidden');
    updateCheckboxCount();
  }
}

/**
 * Handles all 'change' events within the modal for dynamic content.
 */
function handleModalChangeEvents(e) {
  const target = e.target;
  if (!target || !target.classList) return;

  // Update selected count when a checkbox changes
  if (target.classList.contains('deck-suggestion-checkbox')) {
    const cnt = document.querySelectorAll('.deck-suggestion-checkbox:checked').length;
    const el = document.getElementById('deck-suggestions-preview-selected-count');
    if (el) el.textContent = `${cnt} selected`;
  }

  // Update allSuggestedMap when a rating input changes
  if (target.classList.contains('deck-suggestion-rating')) {
    const id = target.dataset.firestoreId;
    const v = parseInt(target.value, 10);
    if (allSuggestedMap[id]) {
      allSuggestedMap[id].rating = Number.isFinite(v) ? v : null;
    }
  }
}

/**
 * Builds a Map of { firestoreId -> cardObject } for a given type.
 * This map excludes cards that are already in the tempDeckList.
 * @param {string} type - The card type (e.g., 'Creature')
 * @param {string[]} commanderColors - The deck's color identity
 * @param {Object} tempDeckList - The current list of cards in the deck
 * @param {string} deckId - The ID of the current deck (to exclude from assignment checks)
 * @returns {Map<string, Object>}
 */
function buildCandidateMapForType(type, commanderColors, tempDeckList, deckId) {
  const col = window.localCollection || localCollection;
  const candidateMap = new Map();

  // --- Land Logic ---
  if (type === 'Land') {
    for (const card of Object.values(col)) {
      // 1. Check color identity (Lands are tricky, but we still respect the rule)
      if (!isColorIdentityValid(card.color_identity, commanderColors)) continue;

      // 2. Check type
      const mainType = (card.type_line || '').split(' — ')[0];
      if (mainType !== 'Land') continue;

      // 3. Check if it's a basic land
      const isBasic = card.type_line?.includes('Basic');

      // 4. For NON-basic lands, check if already in deck or assigned elsewhere
      if (!isBasic) {
        // Check if already in temp deck (from this session OR original)
        if (tempDeckList[card.firestoreId]) continue;

        // Strict Check: Is this card ID present in ANY other deck's card list?
        // We check localDecks directly to be 100% sure, bypassing potential stale cardDeckAssignments
        let isAssigned = false;
        const allDecks = window.localDecks || {};
        for (const otherDeckId in allDecks) {
          if (otherDeckId === deckId) continue; // Ignore current deck (already checked via tempDeckList/deck.cards)
          const otherDeck = allDecks[otherDeckId];
          if (otherDeck.cards && otherDeck.cards[card.firestoreId]) {
            isAssigned = true;
            break;
          }
          if (otherDeck.commander && otherDeck.commander.firestoreId === card.firestoreId) {
            isAssigned = true;
            break;
          }
        }
        if (isAssigned) continue;

      }
      // Basic lands can always be added (no uniqueness check)

      candidateMap.set(card.firestoreId, card);
    }
  }
  // --- Non-Land Logic ---
  else {
    for (const card of Object.values(col)) {
      // 1. Check color identity
      if (!isColorIdentityValid(card.color_identity, commanderColors)) continue;

      // 2. Check type (Allow partial match, e.g. "Legendary Creature" matches "Creature")
      if (type && !(card.type_line || '').includes(type)) continue;

      // 3. Check if already in temp deck (from this session OR original)
      if (tempDeckList[card.firestoreId]) continue;

      // 4. Strict Check: Is this card assigned to ANY other deck?
      let isAssigned = false;
      const allDecks = window.localDecks || {};
      for (const otherDeckId in allDecks) {
        if (otherDeckId === deckId) continue;
        const otherDeck = allDecks[otherDeckId];
        if (otherDeck.cards && otherDeck.cards[card.firestoreId]) {
          isAssigned = true;
          break;
        }
        if (otherDeck.commander && otherDeck.commander.firestoreId === card.firestoreId) {
          isAssigned = true;
          break;
        }
      }
      if (isAssigned) continue;


      candidateMap.set(card.firestoreId, card);
    }
  }
  return candidateMap;
}

/**
 * Starts the sequential suggestion flow, one API call per card type.
 * @param {string} deckId
 */
async function startSuggestionFlow(deckId, opts = {}) {
  // Prevent duplicate/parallel runs
  if (window.__deckSuggestionsFlowInFlight) {
    console.warn('[deckSuggestions] suggestion flow already in progress, ignoring duplicate start.');
    showToast('Suggestion flow is already running. Please wait for it to finish.', 'warning');
    return;
  }
  window.__deckSuggestionsFlowInFlight = true;


  // --- UI State Update: Show Loading ---
  const statusEl = document.getElementById('deck-suggestions-status');
  statusEl.textContent = 'Starting suggestion flow...';
  document.getElementById('deck-suggestions-start-btn').disabled = true;
  document.getElementById('deck-suggestions-start-btn').textContent = 'Processing...';
  document.getElementById('deck-suggestions-results').innerHTML = ''; // Clear results log
  // ---

  const deck = (window.localDecks || localDecks)[deckId];
  if (!deck) { try { window.__deckSuggestionsFlowInFlight = false; } catch (e) { }; showToast('Deck not found.', 'error'); return; }

  const blueprint = deck.aiBlueprint || {};
  const commanderColors = deck.commander?.color_identity || [];
  const targetTotal = (deck.format === 'commander' || !deck.format) ? 99 : 59; // 99 for commander, 59 for 60-card
  const deckFormat = deck.format || 'commander';

  // --- Get type counts from blueprint ---
  const typeCounts = blueprint.counts || {};

  // --- Better defaults for type counts ---
  // Prefer values from blueprint.suggestedCounts if present, otherwise fall back to sane defaults.
  const defaultTypeCounts = {
    'Creature': blueprint.suggestedCounts?.Creature ?? 25,
    'Planeswalker': blueprint.suggestedCounts?.Planeswalker ?? 0,
    'Instant': blueprint.suggestedCounts?.Instant ?? 10,
    'Sorcery': blueprint.suggestedCounts?.Sorcery ?? 10,
    'Artifact': blueprint.suggestedCounts?.Artifact ?? 10,
    'Enchantment': blueprint.suggestedCounts?.Enchantment ?? 10,
    'Land': blueprint.suggestedCounts?.Land ?? 30 // This is for non-basic lands in the 99
  };
  // ---

  // Keep a temporary deck list (firestoreId -> cardObject)
  // This list includes the original deck AND cards added during this session
  const tempDeckList = { ...deck.cards }; // Seed with original deck

  // Helper to count *all* non-commander cards
  function countNonCommander() {
    // The commander is not in the .cards list, so this is fine.
    return Object.values(tempDeckList).reduce((s, c) => s + (c.count || 0), 0);
  }

  // --- Helper to count cards of a specific type SLOT in the tempDeckList ---
  const getTempDeckCountForType = (typeToCount) => { // typeToCount is the SLOT (e.g., 'Planeswalker')
    let count = 0;
    for (const card of Object.values(tempDeckList)) {
      // Check original deck cards (which have no slotType)
      if (!card.slotType) {
        const mainType = (card.type_line || '').split(' — ')[0];
        if (mainType === typeToCount) {
          count += (card.count || 0);
        }
      }
      // Check suggested cards
      else if (card.slotType === typeToCount) {
        count += (card.count || 0);
      }
    }
    return count;
  };
  // ---


  // Types to fill: use a common order or blueprint.types
  let typesToFill = blueprint.types || ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land'];

  // If the modal was opened with a specific type filter, restrict to that
  if (currentTypeFilter) {
    typesToFill = [currentTypeFilter];
    console.debug(`[deckSuggestions] Running suggestion flow limited to type: ${currentTypeFilter}`);
  }

  // --- Main Loop: Process each type sequentially ---
  for (const type of typesToFill) {
    if (countNonCommander() >= targetTotal) break;

    // --- Calculate numToRequest based on blueprint ---
    // Use the *original* type from the loop (e.g., 'Planeswalker')
    const targetCount = typeCounts[type] || defaultTypeCounts[type] || 10; // Use blueprint, then default, then 10
    const currentCount = getTempDeckCountForType(type); // Get current count of 'Planeswalker'
    let numToRequest = Math.max(0, targetCount - currentCount);

    if (numToRequest === 0) {
      console.debug(`[deckSuggestions] Type ${type} is already full.`);
      continue;
    }
    // ---

    let effectiveType = type;
    let isFallback = false;
    let candidateMap = buildCandidateMapForType(effectiveType, commanderColors, tempDeckList, deckId);

    // --- FALLBACK LOGIC ---
    if (candidateMap.size === 0 && (type === 'Planeswalker' || type === 'Enchantment' || type === 'Artifact')) {
      const fallbackType = 'Creature';
      console.warn(`[deckSuggestions] No ${type} candidates found. Falling back to ${fallbackType}.`);
      effectiveType = fallbackType;
      isFallback = true;
      candidateMap = buildCandidateMapForType(effectiveType, commanderColors, tempDeckList, deckId);
    }
    // --- END FALLBACK LOGIC ---

    if (candidateMap.size === 0) {
      console.warn(`[deckSuggestions] No candidates found for ${effectiveType} (slot: ${type}).`);
      statusEl.textContent = `No candidates for ${effectiveType}.`;
      await new Promise(res => setTimeout(res, 500)); // Brief pause
      continue;
    }

    // --- This is the "Send all candidates" logic ---
    const fallbackMsg = isFallback ? `(for ${type} slot)` : '';
    const statusMsg = `Analyzing ${candidateMap.size} ${effectiveType}s ${fallbackMsg}...`;
    statusEl.textContent = statusMsg;
    console.log(`[deckSuggestions] ${statusMsg}`); // Console log now includes fallback info

    // 1. Build the full list of candidates to send
    const candidatesPreview = Array.from(candidateMap.values()).map(c => ({
      firestoreId: c.firestoreId,
      name: c.name,
      oracle_text: c.oracle_text || '',
      type_line: c.type_line || '',
      cmc: c.cmc || 0,
      power: c.power || null,
      toughness: c.toughness || null,
      colors: c.colors || [],
      // Include how many copies the user currently owns in their collection
      // so the AI can decide whether duplicates are possible (important for lands).
      owned_count: (c.count || 0),
      // Tiny hint: mark basic lands so the model can prefer them as duplicates when allowed
      is_basic_land: /^(Plains|Island|Swamp|Mountain|Forest)$/i.test(c.name || '')
    }));

    // --- Build Current Deck List String for Context ---
    const currentDeckNames = [];
    for (const cid of Object.keys(tempDeckList)) {
      const c = tempDeckList[cid];
      if (c && c.name) {
        currentDeckNames.push(c.name);
      }
    }
    const currentDeckContext = currentDeckNames.length > 0 ? `Current cards in deck:\n${currentDeckNames.join(', ')}` : 'Current deck is empty.';

    // 2. Create the prompt
    let singleCallInstructions = `
      You are an expert Magic: The Gathering deck builder.
      From the "candidates" list, select up to ${numToRequest} of the best cards for this "${effectiveType}" slot.
      The deck is a ${deckFormat} deck.
      Provide a 1-10 rating and a brief "reason" for each card you select.
      Prioritize cards that fit the deck "blueprint" themes: ${blueprint.themes ? blueprint.themes.join(', ') : 'General Synergy'}.
      Prioritize "Legendary" cards or other special variants (e.g. Artifact Creatures) if they fit the deck's theme better than standard cards.
      The commander is: ${deck.commander?.name || 'Unknown'}.
      Current deck size is ${countNonCommander()} / ${targetTotal}.
      ${currentDeckContext}
      IMPORTANT: Return the candidate's exact "firestoreId" string from the candidates list. 
      Do NOT suggest any card that is already in the deck (listed above).
      Ensure no duplicate names within your suggestions.
      Do NOT append suffixes like "_1", "_2" to indicate duplicates. If you want duplicates of a card, either return the same "firestoreId" multiple times or include a numeric "count" field on the suggestion object. Return ONLY a JSON object matching the provided schema.
    `;

    // --- Land-specific prompt modification ---
    if (effectiveType === 'Land') {
      singleCallInstructions = `
        You are an expert Magic: The Gathering deck builder.
        From the "candidates" list, select up to ${numToRequest} "Land" cards.
        The deck is a ${deckFormat} deck.
        DUPLICATES ARE NOT ALLOWED for lands, especially Basic Lands.
        FIRST, prioritize non-basic lands that provide helpful bonuses, mana fixing, or utility and match the commander's colors.
        SECOND, after selecting useful non-basic lands, fill the remaining ${numToRequest} slots with Basic Lands (e.g., "Plains", "Island", "Forest") as needed to meet the count.
        Provide a 1-10 rating and a brief "reason" for each card you select.
        IMPORTANT: Return the candidate's exact "firestoreId" string from the candidates list. Do NOT invent or append suffixes like "_1". If you want duplicates, return the same "firestoreId" multiple times or include a numeric "count" field on the suggestion object.
        The commander is: ${deck.commander?.name || 'Unknown'}.
        Current deck size is ${countNonCommander()} / ${targetTotal}.
        ${currentDeckContext}
        Return ONLY a JSON object matching the provided schema.
      `;
    }
    // --- End modification ---

    const singleCallData = {
      blueprint,
      instructions: singleCallInstructions.trim(),
      candidates: candidatesPreview,
    };

    // 3. Call Gemini
    const payload = {
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(singleCallData) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: suggestionsResponseSchema,
      }
    };

    const result = await callGeminiWithRetries(payload, 3, 1000);
    if (!result || !result.suggestions) {
      statusEl.textContent = `AI failed to respond for ${effectiveType}.`;
      console.error(`[deckSuggestions] AI failed to produce valid suggestions for ${effectiveType}.`, result);
      appendResultBlock(effectiveType, type, 0, 0, true, 'AI failed to respond.');
      await new Promise(res => setTimeout(res, 500));
      continue;
    }

    // 4. Process results
    const suggestions = result.suggestions || [];
    const mapped = []; // This will hold the cards we ACTUALLY add
    const addedNonBasicLands = new Set(); // Track non-basic lands we've already added in this batch

    for (const suggestion of suggestions) {
      let card = candidateMap.get(suggestion.firestoreId);
      // If AI returned an ID that doesn't match, attempt tolerant mapping.
      // Historically we've seen suffixes like `_1`, `-1`, ` (1)`, `-copy`, etc.
      if (!card && typeof suggestion.firestoreId === 'string') {
        const orig = suggestion.firestoreId;
        const candidatesToTry = [];

        // Common patterns to strip: _<num>, -<num>,  (<num>), -copy
        candidatesToTry.push(orig);
        candidatesToTry.push(orig.replace(/_\d+$/, ''));
        candidatesToTry.push(orig.replace(/-\d+$/, ''));
        candidatesToTry.push(orig.replace(/\s*\(\d+\)$/, ''));
        candidatesToTry.push(orig.replace(/-copy$/i, ''));
        // Also try trimming trailing dot-number (e.g., id.1)
        candidatesToTry.push(orig.replace(/\.\d+$/, ''));

        // Try each transformed key until we find a candidate in the map
        for (const tryKey of candidatesToTry) {
          if (!tryKey) continue;
          const found = candidateMap.get(tryKey);
          if (found) {
            card = found;
            if (tryKey !== orig) console.debug(`[deckSuggestions] Mapped AI-suggested id ${orig} -> ${tryKey}`);
            break;
          }
        }
      }
      if (!card) {
        console.warn(`[deckSuggestions] AI suggested card ID ${suggestion.firestoreId} not in candidate map.`);
        continue;
      }

      // --- Check for duplicate non-basic lands ---
      const isLand = card.type_line && card.type_line.includes('Land');
      const isBasic = card.type_line?.includes('Basic');

      if (isLand && !isBasic) {
        // This is a non-basic land
        if (addedNonBasicLands.has(card.firestoreId)) {
          console.debug(`[deckSuggestions] Skipping duplicate non-basic land: ${card.name} (${card.firestoreId})`);
          continue; // Skip this duplicate
        }
        // Track that we've added this non-basic land
        addedNonBasicLands.add(card.firestoreId);
      }
      // Basic lands are allowed to be duplicated (no check needed)
      // --- End duplicate check ---

      // --- !! CRITICAL FIX !! ---
      // Enforce the numToRequest limit.
      if (mapped.length >= numToRequest) {
        console.debug(`[deckSuggestions] Reached request limit of ${numToRequest} for ${type} slot, skipping remaining AI suggestions.`);
        break; // Stop processing suggestions for this type
      }

      // Check if card is already in the deck (do this BEFORE adding to mapped)
      if ((deck.cards || {})[card.firestoreId]) {
        appendResultBlock(
          `Already in Deck`,
          'Info',
          1,
          1,
          false,
          `${card.name} (${card.type_line}) already in deck, skipping`
        );
        console.debug(`[deckSuggestions] Card ${card.name} already in deck, skipping`);
        continue;
      }

      mapped.push(card);
      // --- END FIX ---

      // Add to aggregate map for preview
      allSuggestedMap[card.firestoreId] = Object.assign({
        // Base data from local collection
        ...card,
        // AI-provided data
        rating: suggestion.rating ?? null,
        reason: suggestion.reason ?? '',
        sourceType: effectiveType, // The type of card it IS (e.g., 'Creature')
        slotType: type, // The slot it FILLS (e.g., 'Planeswalker')
      }, allSuggestedMap[card.firestoreId] || {}); // Merge with any existing data

      // Add to temp deck list for next pass
      tempDeckList[card.firestoreId] = tempDeckList[card.firestoreId] || { count: 0, name: card.name, type_line: card.type_line };
      tempDeckList[card.firestoreId].count = (tempDeckList[card.firestoreId].count || 0) + 1;
      tempDeckList[card.firestoreId].slotType = type; // Mark which slot it fills
    }

    // Only proceed if we actually mapped cards to add
    if (mapped.length > 0) {
      // Append incremental per-type UI block
      appendResultBlock(effectiveType, type, mapped.length, numToRequest, false, '');

      // Add Tab for this type if not exists
      const tabsContainer = document.getElementById('deck-suggestions-tabs');
      if (tabsContainer && !tabsContainer.querySelector(`[data-tab="${type}"]`)) {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-3 text-sm font-medium text-gray-400 border-b-2 border-transparent hover:text-gray-200 transition-colors whitespace-nowrap';
        btn.dataset.tab = type;
        btn.textContent = `${type} (${mapped.length})`;
        tabsContainer.appendChild(btn);
      }

      // Live update the preview table as each type returns
      try {
        reRenderPreviewTable();
      } catch (e) { console.debug('preview re-render failed', e); }
    } else if (suggestions.length > 0) {
      appendResultBlock(effectiveType, type, 0, numToRequest, true, 'AI suggested cards we already have.');
    } else {
      appendResultBlock(effectiveType, type, 0, numToRequest, true, 'No suggestions from AI.');
    }

    statusEl.textContent = `Received ${mapped.length} suggestions for ${effectiveType}.`;
    console.log(`[deckSuggestions] Received ${mapped.length} suggestions for ${effectiveType}. (Slot: ${type}, Requested: ${numToRequest}, AI returned: ${suggestions.length})`);

    // Small delay to be polite
    await new Promise(res => setTimeout(res, 250));
  }
  // --- End Main Loop ---

  // --- Auto-Add Basic Lands ---
  try {
    const deckObj = (window.localDecks || localDecks)[deckId];
    // Fix: Pass a reasonable land target (e.g. 37 for commander, 24 for 60-card) instead of the full deck size
    // We try to find a custom land count in the deck or blueprint first.
    const getDeckLandTarget = (d) => {
      if (d.customLandCount) return Number(d.customLandCount);
      if (d.landCount) return Number(d.landCount);
      if (d.aiBlueprint) {
        if (d.aiBlueprint.totalLandCount) return Number(d.aiBlueprint.totalLandCount);
        if (d.aiBlueprint.counts && d.aiBlueprint.counts.Land) return Number(d.aiBlueprint.counts.Land);
      }
      return (d.format === 'commander' || !d.format) ? 37 : 24;
    };
    const targetLandCount = getDeckLandTarget(deckObj);

    // Temporarily add suggested cards to localCollection so calculateBasicLandNeeds can access them
    if (!window.localCollection) window.localCollection = {};
    const tempCollectionBackup = {};
    Object.keys(allSuggestedMap).forEach(id => {
      if (!window.localCollection[id]) {
        window.localCollection[id] = allSuggestedMap[id];
        tempCollectionBackup[id] = true; // Track what we added
      }
    });

    // Create a temp deck object that includes the suggested cards to get accurate basic land count
    const tempDeck = {
      ...deckObj,
      cards: tempDeckList
    };
    const basicLandNeeds = calculateBasicLandNeeds(tempDeck, targetLandCount);

    // Clean up temporary additions
    Object.keys(tempCollectionBackup).forEach(id => {
      delete window.localCollection[id];
    });

    const manaColors = {
      W: 'Plains',
      U: 'Island',
      B: 'Swamp',
      R: 'Mountain',
      G: 'Forest'
    };

    const col = window.localCollection || localCollection;
    const basicLandsAdded = [];

    ['W', 'U', 'B', 'R', 'G'].forEach(colorCode => {
      const needed = basicLandNeeds[colorCode];
      if (needed === 0) return;

      const basicName = manaColors[colorCode];
      let basicLand = Object.values(col).find(c =>
        c.name === basicName && c.type_line?.includes('Basic Land')
      );

      // If not found in collection, create a virtual one
      if (!basicLand) {
        console.warn(`[deckSuggestions] Basic land ${basicName} not found in collection. Creating virtual entry.`);
        const virtualId = `virtual-basic-${colorCode}-${deckId}`;
        basicLand = {
          firestoreId: virtualId,
          name: basicName,
          type_line: `Basic Land — ${basicName.split(' ').pop()}`,
          cmc: 0,
          color_identity: [colorCode],
          image_uris: { normal: `https://c1.scryfall.com/file/scryfall-cards/normal/front/0/0/00000000-0000-0000-0000-000000000000.jpg` },
          isVirtual: true
        };

        const art = {
          'Plains': 'https://cards.scryfall.io/normal/front/d/1/d1286953-f761-4c8d-8b19-5d283e762c56.jpg',
          'Island': 'https://cards.scryfall.io/normal/front/6/8/68654196-d969-425e-be2c-090e036998b9.jpg',
          'Swamp': 'https://cards.scryfall.io/normal/front/1/8/184a196e-8604-49d2-a66a-6f7c0eafd5de.jpg',
          'Mountain': 'https://cards.scryfall.io/normal/front/4/c/4c7d3c9a-919b-4102-8794-34f504413348.jpg',
          'Forest': 'https://cards.scryfall.io/normal/front/9/3/9366c5cd-a657-4321-98ca-596a97bb30d0.jpg'
        };
        if (art[basicName]) basicLand.image_uris = { normal: art[basicName], small: art[basicName] };
      }

      if (basicLand && !((deck.cards || {})[basicLand.firestoreId])) {
        allSuggestedMap[basicLand.firestoreId] = {
          ...basicLand,
          rating: 5,
          reason: `${needed}x basic ${basicName} for ${colorCode} mana`,
          sourceType: 'Land',
          slotType: 'Land',
          count: needed,
          isAutoBasicLand: true
        };
        basicLandsAdded.push(`${needed}x ${basicName}`);
        tempDeckList[basicLand.firestoreId] = {
          count: needed,
          name: basicLand.name,
          type_line: basicLand.type_line,
          slotType: 'Land'
        };
      }
    });

    if (basicLandsAdded.length > 0) {
      appendResultBlock('Basic Lands', 'Land', basicLandsAdded.length, basicLandsAdded.length, false, basicLandsAdded.join(', '));
      console.log(`[deckSuggestions] Auto-added basic lands: ${basicLandsAdded.join(', ')}`);
    }
  } catch (e) {
    console.error('[deckSuggestions] Failed to calculate basic lands', e);
  }

  // --- Done gathering ---
  statusEl.textContent = `Suggestion pass complete. ${countNonCommander() - Object.keys(deck.cards).length} new cards suggested.`;
  document.getElementById('deck-suggestions-start-btn').disabled = false;
  document.getElementById('deck-suggestions-start-btn').textContent = 'Run Another Pass';

  const mode = document.getElementById('deck-suggestions-mode-select')?.value || 'preview';

  if (mode === 'auto') {
    // Auto-apply
    // Log a concise preview of allSuggestedMap contents for debugging mapping issues
    try {
      const preview = Object.keys(allSuggestedMap).map(k => ({ id: k, name: allSuggestedMap[k]?.name || null, isVirtual: !!allSuggestedMap[k]?.isVirtual, count: allSuggestedMap[k]?.count || 1, slotType: allSuggestedMap[k]?.slotType || null }));
      console.log('[deckSuggestions] allSuggestedMap preview:', preview);
    } catch (e) { console.warn('[deckSuggestions] failed to serialize allSuggestedMap for logging', e); }

    const idsToAdd = Object.keys(allSuggestedMap).filter(id => !(deck.cards || {})[id]);
    console.log('[deckSuggestions] idsToAdd (attempting to add):', idsToAdd);
    if (idsToAdd.length === 0) { try { window.__deckSuggestionsFlowInFlight = false; } catch (e) { }; showToast('No new cards to add.', 'info'); return; }

    try {
      saveSuggestionMetadata(deckId, idsToAdd);
    } catch (e) { console.warn('[deckSuggestions] saveSuggestionMetadata (auto) failed', e); }

    if (typeof window.batchAddCardsWithProgress === 'function') {
      closeModal('deck-suggestions-modal');
      window.batchAddCardsWithProgress(deckId, idsToAdd, allSuggestedMap);
    } else if (typeof window.handleAddSelectedCardsToDeck === 'function') {
      closeModal('deck-suggestions-modal');
      window.handleAddSelectedCardsToDeck(deckId, idsToAdd);
    } else {
      showToast('Auto-apply is unavailable (handler not found).', 'error');
    }
  } else {
    // Preview mode
    if (Object.keys(allSuggestedMap).length > 0) {
      document.getElementById('deck-suggestions-preview').classList.remove('hidden');
      reRenderPreviewTable();

      document.getElementById('deck-suggestions-apply-selected-btn').classList.remove('hidden');
      document.getElementById('deck-suggestions-rerun-btn').classList.remove('hidden');
      document.getElementById('deck-suggestions-preview-selected-count').textContent = `${Object.keys(allSuggestedMap).length} selected`;

      document.getElementById('deck-suggestions-apply-selected-btn').onclick = () => {
        const ids = Array.from(document.querySelectorAll('.deck-suggestion-checkbox:checked')).map(cb => cb.dataset.firestoreId);
        saveSuggestionMetadata(deckId);
        closeModal('deck-suggestions-modal');
        if (typeof window.batchAddCardsWithProgress === 'function') {
          window.batchAddCardsWithProgress(deckId, ids, allSuggestedMap);
        } else if (typeof window.handleAddSelectedCardsToDeck === 'function') {
          window.handleAddSelectedCardsToDeck(deckId, ids);
        } else {
          showToast('Card add handler not found on window.', 'error');
        }
      };

      document.getElementById('deck-suggestions-rerun-btn').onclick = () => {
        const selectedIds = new Set(Array.from(document.querySelectorAll('.deck-suggestion-checkbox:checked')).map(cb => cb.dataset.firestoreId));
        Object.keys(allSuggestedMap).forEach(id => {
          if (!selectedIds.has(id)) delete allSuggestedMap[id];
        });
        document.getElementById('deck-suggestions-results').innerHTML = `<p class="text-sm text-gray-400">Finding replacements...</p>`;
        reRenderPreviewTable();
        startSuggestionFlow(deckId);
      };
    } else {
      appendResultBlock('Complete', '', 0, 0, true, 'No new suggestions found for this deck.');
      document.getElementById('deck-suggestions-preview').classList.add('hidden');
    }
    try { window.__deckSuggestionsFlowInFlight = false; } catch (e) { }
  }
}

/**
 * Appends a result block to the "Suggestion Log" (left column).
 * @param {string} effectiveType - The type of card found (e.g., 'Creature')
 * @param {string} slotType - The slot it was for (e.g., 'Planeswalker')
 * @param {number} count - Number of cards found
 * @param {number} requested - Number of cards requested
 * @param {boolean} isError - If true, styles as an error/warning
 * @param {string} message - An optional message
 */
/**
 * Appends a result block to the "Suggestion Log" (scrollable area).
 */
function appendResultBlock(effectiveType, slotType, count, requested, isError, message) {
  try {
    const resultsDiv = document.getElementById('deck-suggestions-results');
    // Remove initial placeholder if present
    if (resultsDiv.querySelector('.italic')) {
      resultsDiv.innerHTML = '';
    }

    const block = document.createElement('div');
    block.className = `flex items-center justify-between p-2 rounded ${isError ? 'bg-red-900/20 text-red-300' : 'bg-gray-800/40 text-gray-400'} border border-gray-800`;

    let title = effectiveType;
    if (slotType && effectiveType !== slotType) {
      title = `${effectiveType} (for ${slotType})`;
    }

    const countText = message ? `<span class="${isError ? 'text-red-400' : 'text-yellow-500'}">${message}</span>` : `<span class="text-green-400 font-mono">Found ${count}/${requested}</span>`;

    block.innerHTML = `
      <span class="font-medium">${title}</span>
      <span class="text-xs">${countText}</span>
    `;
    resultsDiv.appendChild(block);
    resultsDiv.scrollTop = resultsDiv.scrollHeight;
  } catch (e) { console.debug('UI append failed', e); }
}

/**
 * Saves the current `allSuggestedMap` metadata to the deck object.
 * This is called when "Add Selected" is clicked.
 * @param {string} deckId
 */
function saveSuggestionMetadata(deckId, argsSelectedIds) {
  if (typeof window.attachSuggestionMetadataToDeck !== 'function') {
    console.warn('[deckSuggestions] attachSuggestionMetadataToDeck function not found.');
    return;
  }

  // Get *only* the selected cards. Allow optional explicit set of ids (for auto mode).
  let selectedIds;
  if (arguments.length > 1 && argsSelectedIds) {
    // If caller passed an explicit set/array, normalize to a Set
    selectedIds = new Set(Array.from(argsSelectedIds));
  } else {
    selectedIds = new Set(Array.from(document.querySelectorAll('.deck-suggestion-checkbox:checked')).map(cb => cb.dataset.firestoreId));
  }

  const metadataToSave = [];
  for (const id of selectedIds) {
    if (allSuggestedMap[id]) {
      const s = allSuggestedMap[id];
      metadataToSave.push({
        firestoreId: id,
        // Save AI-generated fields
        rating: s.rating ?? null,
        reason: s.reason ?? '',
        sourceType: s.sourceType,
        slotType: s.slotType,
        // Additionally persist the card name and scryfall id so we can later resolve
        name: s.name || ((window.localCollection || localCollection)[id] || {}).name || '',
        scryfallId: s.id || s.scryfall_id || ((window.localCollection || localCollection)[id] || {}).id || '',
      });
    }
  }

  const statusEl = document.getElementById('deck-suggestions-save-status');
  const retryBtn = document.getElementById('deck-suggestions-save-retry-btn');
  statusEl.textContent = 'Saving AI metadata...';
  retryBtn.classList.add('hidden');

  try {
    // This function is expected to be on the window and return a Promise
    window.attachSuggestionMetadataToDeck(deckId, metadataToSave) // FIX: Pass the array
      .then(() => {
        statusEl.textContent = 'AI metadata saved.';
      })
      .catch(err => {
        console.error('Failed to save suggestion metadata', err);
        statusEl.textContent = 'Metadata save failed.';
        retryBtn.classList.remove('hidden');
      });
  } catch (e) {
    console.error('Error calling attachSuggestionMetadataToDeck', e);
    statusEl.textContent = 'Metadata save failed.';
    retryBtn.classList.remove('hidden');
  }
}


function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&"'<>]/g, (s) => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }[s]));
}

/**
 * Re-renders the entire preview table from the aggregated `allSuggestedMap`.
 */
/**
 * Re-renders the entire preview table from the aggregated `allSuggestedMap`.
 * @param {string} filterType - Optional slotType to filter by (matches tab data-tab)
 */
function reRenderPreviewTable(filterType = null) {
  const previewBody = document.getElementById('deck-suggestions-preview-body');
  if (!previewBody) return;

  // If no filter passed, try to find active tab
  if (!filterType) {
    const activeTab = document.querySelector('#deck-suggestions-tabs button.border-indigo-500');
    if (activeTab) filterType = activeTab.dataset.tab;
  }
  if (filterType === 'all') filterType = null;

  previewBody.innerHTML = '';
  let arr = Object.values(allSuggestedMap);

  // Filter
  if (filterType) {
    arr = arr.filter(s => s.slotType === filterType || s.sourceType === filterType);
  }

  // Sort
  arr.sort((a, b) => {
    let valA = a[previewSort.field];
    let valB = b[previewSort.field];

    // Handle numeric/nulls
    if (previewSort.field === 'rating' || previewSort.field === 'cmc') {
      valA = (valA === null || valA === undefined) ? -Infinity : Number(valA);
      valB = (valB === null || valB === undefined) ? -Infinity : Number(valB);
    } else {
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
    }

    if (valA < valB) return -1 * previewSort.dir;
    if (valA > valB) return 1 * previewSort.dir;
    return 0;
  });

  const selectedIds = new Set(Array.from(document.querySelectorAll('.deck-suggestion-checkbox:checked')).map(cb => cb.dataset.firestoreId));

  if (arr.length === 0) {
    document.getElementById('deck-suggestions-empty-state').classList.remove('hidden');
    document.getElementById('deck-suggestions-empty-state').innerHTML = `<p>No suggestions found for this category.</p>`;
  } else {
    document.getElementById('deck-suggestions-empty-state').classList.add('hidden');
  }

  arr.forEach(s => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-800/50 transition-colors group';

    // Get checkbox state. If table is re-rendering, maintain checked state.
    // Default to checked if it's a new card.
    // Logic: If selectedIds has entries, use that. If empty, it might be first render, so check if we should default to all.
    // Actually, simpler: If the ID is in selectedIds, check it. 
    // If selectedIds is EMPTY, it means either nothing selected OR first render.
    // We want default to be CHECKED.
    // So we need to track if the user has explicitly unselected things? 
    // For now, let's just say: if it's in the set, it's checked. If the set is empty, we check EVERYTHING (first render assumption).
    // But wait, if user unchecks everything, set is empty, and then it re-checks everything? That's bad.
    // Better: Initialize selectedIds with all IDs when we first create the map?
    // Or just check the DOM?

    // Current approach:
    // If we are re-rendering, we grabbed selectedIds from the DOM *before* clearing.
    // If that set was empty, it implies either nothing selected OR this is the first render.
    // We can distinguish by checking if there were any checkboxes at all.
    // Always default to checked
    let isChecked = true;

    const oracle = s.oracle_text || '';
    const cmc = s.cmc ?? '-';
    const rating = s.rating !== undefined && s.rating !== null ? s.rating : '';
    const reason = s.reason || '';

    // Type icon/text
    const typeLine = (s.type_line || '').split('—')[0].trim();

    tr.innerHTML = `
      <td class="p-3 w-10 text-center">
        <input type="checkbox" class="deck-suggestion-checkbox w-4 h-4 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-gray-700" data-firestore-id="${s.firestoreId}" ${isChecked ? 'checked' : ''}>
      </td>
      <td class="p-3 font-medium text-white">
        <div class="flex flex-col">
          <span>${escapeHtml(s.name)}</span>
          <span class="text-[10px] text-gray-500 sm:hidden">${typeLine}</span>
        </div>
      </td>
      <td class="p-3 text-sm text-gray-400 hidden sm:table-cell">${escapeHtml(typeLine)}</td>
      <td class="p-3 text-sm text-gray-400 text-center font-mono">${cmc}</td>
      <td class="p-3 text-center">
        <div class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 border border-gray-700 font-bold text-sm ${rating >= 8 ? 'text-green-400 border-green-900' : 'text-indigo-400'}">
          ${rating}
        </div>
      </td>
      <td class="p-3 text-sm text-gray-400 max-w-md">
        <div class="line-clamp-2" title="${escapeHtml(reason)}">${escapeHtml(reason)}</div>
      </td>
    `;
    previewBody.appendChild(tr);
  });
}

/**
 * Robust caller with retries/exponential backoff.
 * Returns the parsed JSON response from Gemini or null.
 * @param {object} payload - The full request payload for Gemini.
 * @param {number} retries - Number of retries.
 * @param {number} initialDelay - Starting delay in ms.
 * @returns {Promise<object|null>} Parsed JSON object or null.
 */
async function callGeminiWithRetries(payload, retries = 3, initialDelay = 1000) {
  let delay = initialDelay;
  // Deduplicate identical in-flight requests to avoid accidental duplicate model calls
  try {
    if (!window.__geminiInFlightMap) window.__geminiInFlightMap = {};
  } catch (e) { window.__geminiInFlightMap = {}; }
  const key = JSON.stringify(payload || {});
  if (window.__geminiInFlightMap[key]) {
    // Return the existing promise so callers share the same result
    return await window.__geminiInFlightMap[key];
  }

  // Store the promise while the request resolves (including retries)
  window.__geminiInFlightMap[key] = (async () => {

    // Resolve per-user Gemini URL at runtime (require per-user key; do not rely on hard-coded global)
    const url = (typeof window.getGeminiUrl === 'function') ? await window.getGeminiUrl() : null;
    if (!url) {
      console.error('[deckSuggestions] Gemini API Key is not configured.');
      try { if (typeof window.renderGeminiSettings === 'function') window.renderGeminiSettings(); } catch (e) { }
      try { if (typeof window.showView === 'function') window.showView('settings'); } catch (e) { }
      if (typeof showToast === 'function') showToast('No Gemini API key configured. Add it in Settings to enable AI features.', 'error');
      return null;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          const body = await resp.text();
          console.error(`[deckSuggestions] Gemini API error (Attempt ${attempt}):`, resp.status, body);
          throw new Error(`APIError: ${resp.status}`);
        }

        const data = await resp.json();

        // Check for blocked content
        if (!data.candidates || data.candidates.length === 0) {
          const blockReason = data.promptFeedback?.blockReason;
          if (blockReason) {
            console.error(`[deckSuggestions] Gemini request blocked: ${blockReason}`, data.promptFeedback);
            showToast(`Request blocked by AI: ${blockReason}`, 'error');
            return null; // Don't retry on content block
          }
          throw new Error('Empty response from Gemini');
        }

        const part = data.candidates?.[0]?.content?.parts?.[0];
        if (!part || !part.text) {
          console.warn(`[deckSuggestions] Malformed response part (Attempt ${attempt}):`, data);
          throw new Error('Malformed response part');
        }

        // With native JSON mode, part.text is a string *containing* JSON.
        const parsedJson = JSON.parse(part.text);
        return parsedJson; // Success!

      } catch (err) {
        console.warn(`[deckSuggestions] Gemini attempt ${attempt} failed:`, err.message);
        if (attempt === retries) {
          showToast('AI suggestions failed after multiple retries.', 'error');
          return null;
        }
        await new Promise(res => setTimeout(res, delay));
        delay = Math.min(delay * 2, 10000); // Exponential backoff, max 10s
      }
    }
    return null;
  })();

  try {
    return await window.__geminiInFlightMap[key];
  } finally {
    // Clean up entry for this payload so future requests can run
    try { delete window.__geminiInFlightMap[key]; } catch (e) { }
  }
}

// Note: exports are declared earlier (openDeckSuggestionsModal, openDeckHelp)
// No additional export here to avoid duplicate export errors.

