import { localDecks, localCollection, addCardToCollection, updateCardAssignments } from '../lib/data.js';
import { showToast, openModal, closeModal } from '../lib/ui.js';
import { db, appId } from '../main/index.js';
import { collection, addDoc, doc, updateDoc, writeBatch, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Helper to resolve user id from legacy globals
function getUserId() {
  return window.userId || (window.auth && window.auth.currentUser && window.auth.currentUser.uid) || null;
}

export function renderDecksList() {
  const container = document.getElementById('decks-list');
  const noDecksMsg = document.getElementById('no-decks-msg');
  const decks = Object.values(localDecks || {});
  if (!container) return;

  // Sort decks by creation date (newest first) or name
  decks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (decks.length === 0) {
    container.innerHTML = '';
    noDecksMsg && noDecksMsg.classList.remove('hidden');
    return;
  }
  noDecksMsg && noDecksMsg.classList.add('hidden');

  // "Create New Deck" Card HTML
  const createCardHtml = `
    <div 
      class="deck-card group bg-gray-800/50 hover:bg-gray-800 border-2 border-dashed border-gray-700 hover:border-indigo-500/50 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[300px]"
      onclick="document.getElementById('create-deck-btn').click()"
    >
      <div class="w-16 h-16 rounded-full bg-gray-700 group-hover:bg-indigo-600/20 flex items-center justify-center mb-4 transition-colors">
        <svg class="w-8 h-8 text-gray-400 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      </div>
      <h3 class="text-lg font-bold text-gray-300 group-hover:text-white">Create New Deck</h3>
      <p class="text-sm text-gray-500 mt-2">Start a new build</p>
    </div>
  `;

  const deckCardsHtml = decks.map(deck => {
    const commander = deck.commander;
    const commanderImg = commander ? commander.image_uris?.art_crop : 'https://placehold.co/600x440/1f2937/4b5563?text=No+Commander';
    const cardCount = Object.keys(deck.cards || {}).reduce((sum, key) => sum + (deck.cards[key].count || 1), 0) + (commander ? 1 : 0);

    // Determine colors based on commander identity or default
    const colors = commander && commander.colors && commander.colors.length > 0
      ? commander.colors.join('')
      : 'C'; // C for Colorless/Default

    return `
      <div class="deck-card group bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-indigo-500/20 border border-gray-700 hover:border-indigo-500/50 transition-all duration-300 flex flex-col">
        <!-- Image Section -->
        <div class="relative h-48 overflow-hidden">
          <img src="${commanderImg}" alt="${commander ? commander.name : 'Deck Art'}" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500">
          <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90"></div>
          
          <!-- Overlay Stats -->
          <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono text-white border border-white/10">
            ${deck.format === 'commander' ? 'EDH' : deck.format.toUpperCase()}
          </div>
        </div>

        <!-- Content Section -->
        <div class="p-4 flex-grow flex flex-col">
          <div class="flex justify-between items-start mb-2">
            <h3 class="text-lg font-bold text-white leading-tight group-hover:text-indigo-400 transition-colors line-clamp-1" title="${deck.name}">${deck.name}</h3>
          </div>
          
          <div class="flex items-center gap-2 mb-4">
             <span class="text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded">${cardCount} cards</span>
             ${commander ? `<span class="text-xs text-indigo-300 bg-indigo-900/20 px-2 py-0.5 rounded truncate max-w-[150px]">${commander.name}</span>` : ''}
          </div>

          <div class="mt-auto pt-4 border-t border-gray-700 flex gap-2">
            <button class="view-deck-btn flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-3 px-4 rounded-lg transition-colors min-h-[44px] flex items-center justify-center" data-deck-id="${deck.id}">
              View
            </button>
            <button class="delete-button bg-gray-700 hover:bg-red-900/50 hover:text-red-200 text-gray-300 p-3 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" data-deck-id="${deck.id}" title="Delete Deck">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Prepend the create card
  container.innerHTML = createCardHtml + deckCardsHtml;

  container.querySelectorAll('.view-deck-btn').forEach(btn => btn.addEventListener('click', (e) => {
    const deckId = e.currentTarget.dataset.deckId;
    try {
      if (typeof window.showView === 'function') window.showView('singleDeck');
      if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(deckId);
      return;
    } catch (err) {
      // fallback to event dispatch
    }
    const ev = new CustomEvent('view-deck', { detail: { deckId } });
    window.dispatchEvent(ev);
  }));

  container.querySelectorAll('.delete-button').forEach(btn => btn.addEventListener('click', (e) => {
    const deckId = e.currentTarget.dataset.deckId;
    // reuse modal flow
    const ev = new CustomEvent('delete-deck-request', { detail: { deckId } });
    window.dispatchEvent(ev);
  }));
}

export function initDecksModule() {
  window.renderDecksList = renderDecksList;
  console.log('[Decks] Module ready.');
}

// --- AI Blueprint helpers (migrated from inline HTML) ---
// Use runtime getter for per-user Gemini URL (may return null if no key saved)

export async function getAiDeckBlueprint(commanderCard, deckCards = null) {
  let prompt = `You are a world-class Magic: The Gathering deck architect specializing in the Commander format. Given the following commander card, you will generate a detailed blueprint for a 100-card deck.

            Your response must be a single, valid JSON object and nothing else. Do not wrap it in markdown backticks.
            
            The JSON object must have the following keys:
            1.  "name": A creative, flavorful name for the deck.
            2.  "summary": A concise, one-paragraph summary of the deck's primary strategy and win condition.
            3.  "strategy": A more detailed explanation (2-3 paragraphs) of how to pilot the deck. Cover the early, mid, and late game. Mention key synergies and important card types to look for.
            4.  "suggestedCounts": An object detailing the ideal number of cards for each major card type. The sum of these counts must equal 99 (for the main deck, excluding the commander). The keys must be exactly: "Land", "Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", and "Total" (which must be 99).

            Commander Card Details:
            - Name: ${commanderCard.name}
            - Type: ${commanderCard.type_line}
            - Mana Cost: ${commanderCard.mana_cost}
            - Oracle Text: ${commanderCard.oracle_text}
            - Power/Toughness: ${commanderCard.power || 'N/A'}/${commanderCard.toughness || 'N/A'}`;

  // If a user playstyle summary is available, append it to provide contextual guidance
  try {
    // If a deck card list was provided, append a short summary to the prompt so
    // Gemini can consider the current decklist when generating a blueprint/summary.
    if (deckCards && Array.isArray(deckCards) && deckCards.length > 0) {
      const sample = deckCards.slice(0, 120).map(c => `${c.name} x${c.count || 1}`).join(', ');
      prompt = `${prompt}\n\nCurrent Decklist (sample up to 120 cards):\n${sample}\n\nConsider this decklist when generating the blueprint.`;
    }
    // Prefer structured playstyle object when available
    let structured = null;
    try { if (window.playstyle && window.playstyleState) structured = window.playstyleState; } catch (e) { }
    if (!structured && typeof window.playstyle === 'object' && typeof window.playstyle.loadPlaystyleForUser === 'function' && window.userId) {
      try { structured = await window.playstyle.loadPlaystyleForUser(window.userId); } catch (e) { /* ignore */ }
    }
    if (structured) {
      // Append a JSON block with the structured playstyle and instruct Gemini to consider it
      prompt = `${prompt}\n\nUser Playstyle (JSON):\n${JSON.stringify(structured, null, 2)}\n\nUse this structured profile to tailor the deck blueprint and explain how cards and counts reflect the player's preferences.`;
    } else if (window.playstyleSummary) {
      prompt = `${prompt}\n\nUser Playstyle Summary:\n${window.playstyleSummary}`;
    }
  } catch (e) { /* non-fatal */ }

  try {
    const url = (typeof window.getGeminiUrl === 'function') ? await window.getGeminiUrl() : null;
    if (!url) {
      try { if (typeof window.renderGeminiSettings === 'function') window.renderGeminiSettings(); } catch (e) { }
      try { if (typeof window.showView === 'function') window.showView('settings'); } catch (e) { }
      throw new Error('Gemini API Key is not defined (per-user key missing).');
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) throw new Error(`Gemini API request failed with status ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Invalid or empty response from Gemini API');
    // Prefer fenced ```json blocks, fall back to first JSON substring
    let jsonText = null;
    const fenced = text.match(/```json([\s\S]*?)```/i);
    if (fenced) jsonText = fenced[1].trim();
    else {
      const m = text.match(/\{[\s\S]*\}/);
      jsonText = m ? m[0] : null;
    }
    if (!jsonText) throw new Error('No JSON found in Gemini response');

    // Sanitize control characters (unescaped control chars will break JSON.parse)
    function sanitizeJsonString(s) {
      if (!s || typeof s !== 'string') return s;
      // Escape any literal control characters (U+0000 - U+001F)
      return s.replace(/[\u0000-\u001F]/g, (ch) => {
        const code = ch.charCodeAt(0).toString(16).padStart(2, '0');
        return `\\u${code}`;
      });
    }

    let aiResponse = null;
    try {
      aiResponse = JSON.parse(jsonText);
    } catch (err) {
      // try sanitizing and parse again
      try {
        const sanitized = sanitizeJsonString(jsonText);
        aiResponse = JSON.parse(sanitized);
      } catch (err2) {
        console.error('Failed to parse Gemini JSON even after sanitization', err2, jsonText);
        throw err2;
      }
    }
    if (!aiResponse.name || !aiResponse.summary || !aiResponse.strategy || !aiResponse.suggestedCounts || aiResponse.suggestedCounts.Total !== 99) {
      throw new Error('Gemini response is missing required fields or has incorrect structure.');
    }
    return aiResponse;
  } catch (error) {
    console.error('Error getting AI deck blueprint:', error);
    return {
      name: `Deck for ${commanderCard.name}`,
      summary: 'An error occurred while generating the AI summary. This is a placeholder.',
      strategy: 'Could not generate a detailed strategy.',
      suggestedCounts: { 'Land': 37, 'Creature': 28, 'Instant': 10, 'Sorcery': 6, 'Artifact': 10, 'Enchantment': 8, 'Planeswalker': 0, 'Total': 99 }
    };
  }
}

export function renderAiBlueprintModal(blueprint, deckName, isReadOnly = false) {
  const titleEl = document.getElementById('ai-blueprint-title');
  const contentEl = document.getElementById('ai-blueprint-content');
  const footerEl = document.getElementById('ai-blueprint-footer');
  if (titleEl) titleEl.textContent = `AI Blueprint: ${deckName}`;
  const counts = blueprint.suggestedCounts || {};
  const countsHtml = Object.entries(counts).filter(([key]) => key !== 'Total').map(([key, value]) => `
    <div class="flex justify-between items-center p-2 bg-gray-900/50 rounded">
      <span class="font-semibold">${key}</span>
      <span class="text-indigo-400 font-bold">${value}</span>
    </div>
  `).join('');
  if (contentEl) contentEl.innerHTML = `
    <div>
      <h4 class="text-xl font-bold text-indigo-300 mb-2">Deck Summary</h4>
      <p class="text-gray-300">${blueprint.summary}</p>
    </div>
    <div>
      <h4 class="text-xl font-bold text-indigo-300 mb-2">Strategy</h4>
      <p class="text-gray-300 whitespace-pre-line">${blueprint.strategy}</p>
    </div>
    <div>
      <h4 class="text-xl font-bold text-indigo-300 mb-2">Suggested Card Counts (99 total)</h4>
      <div class="grid grid-cols-2 gap-2 text-sm">
        ${countsHtml}
        <div class="flex justify-between items-center p-2 bg-gray-700 rounded col-span-2">
          <span class="font-bold text-lg">Total</span>
          <span class="text-white font-bold text-lg">${counts.Total || 'N/A'}</span>
        </div>
      </div>
    </div>
  `;
  if (footerEl) {
    if (isReadOnly) footerEl.classList.add('hidden'); else footerEl.classList.remove('hidden');
  }
}

// Expose shims for legacy inline callers
if (typeof window !== 'undefined') {
  window.getAiDeckBlueprint = getAiDeckBlueprint;
  window.renderAiBlueprintModal = renderAiBlueprintModal;
}

// --- Deck management flows migrated from inline HTML ---
export function openDeckDeleteOptions(deckId) {
  const modal = document.getElementById('deck-delete-options-modal');
  const andCardsBtn = modal?.querySelector('#delete-deck-and-cards-btn');
  const onlyBtn = modal?.querySelector('#delete-deck-only-btn');
  if (andCardsBtn) { andCardsBtn.dataset.deckId = deckId; andCardsBtn.dataset.id = deckId; }
  if (onlyBtn) { onlyBtn.dataset.deckId = deckId; onlyBtn.dataset.id = deckId; }
  openModal('deck-delete-options-modal');
}

export async function handleDeckCreationSubmit(e) {
  e && e.preventDefault();
  if (window.__handleDeckCreationSubmitInFlight) {
    console.warn('handleDeckCreationSubmit already in-flight; ignoring duplicate submit.');
    return;
  }
  window.__handleDeckCreationSubmitInFlight = true;
  const deckNameInput = document.getElementById('deck-name-input');
  let deckName = deckNameInput?.value.trim();
  const deckFormat = document.getElementById('deck-format-select')?.value;

  // Use global temporary commander selection if present
  const currentCommanderForAdd = window.currentCommanderForAdd || null;

  if (deckFormat === 'commander' && !currentCommanderForAdd) {
    showToast('Please select a commander for this deck.', 'error');
    return;
  }

  const saveButton = document.getElementById('save-deck-btn');
  const saveText = document.getElementById('save-deck-text');
  const saveSpinner = document.getElementById('save-deck-spinner');

  if (saveButton) saveButton.disabled = true;
  if (saveText) saveText.textContent = 'Generating...';
  if (saveSpinner) saveSpinner.classList.remove('hidden');

  try {
    if (deckFormat === 'commander') {
      // Request AI blueprint via legacy shim if available
      if (typeof window.getAiDeckBlueprint === 'function') {
        const blueprint = await window.getAiDeckBlueprint(currentCommanderForAdd);
        window.tempAiBlueprint = blueprint;
        // Render confirmation via legacy function if present
        if (typeof window.renderAiBlueprintModal === 'function') {
          window.renderAiBlueprintModal(blueprint, deckName || blueprint.name);
          openModal('ai-blueprint-modal');
        }
      } else {
        showToast('AI service not available.', 'error');
      }
    } else {
      const newDeck = {
        name: deckName || `New ${deckFormat} Deck`,
        format: deckFormat,
        summary: '',
        commander: null,
        cards: {},
        createdAt: new Date().toISOString(),
        aiBlueprint: null
      };
      const userId = getUserId();
      if (!userId) { showToast('User not signed in.', 'error'); return; }
      const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/decks`), newDeck);
      showToast(`Deck "${newDeck.name}" created successfully!`, 'success');
      closeModal('deck-creation-modal');
      if (typeof window.showView === 'function') window.showView('singleDeck');
      if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(docRef.id);
    }
  } catch (error) {
    console.error('Error during deck creation process:', error);
    showToast('Failed to create deck.', 'error');
  } finally {
    if (saveButton) saveButton.disabled = false;
    if (saveText) saveText.textContent = 'Get AI Blueprint';
    if (saveSpinner) saveSpinner.classList.add('hidden');
    window.__handleDeckCreationSubmitInFlight = false;
  }
}

export async function createDeckFromBlueprint() {
  if (!window.tempAiBlueprint || !window.currentCommanderForAdd) {
    showToast('Missing blueprint or commander data.', 'error');
    return;
  }
  // Prevent duplicate submissions
  if (window.__createDeckFromBlueprintInFlight) {
    console.warn('createDeckFromBlueprint already in-flight; ignoring duplicate call.');
    return;
  }
  window.__createDeckFromBlueprintInFlight = true;
  const commander = window.currentCommanderForAdd;
  const deckName = document.getElementById('deck-name-input')?.value.trim() || window.tempAiBlueprint.name;
  try {
    // Ensure commander exists in collection
    const userId = getUserId();
    if (!userId) { showToast('User not signed in.', 'error'); return; }
    let commanderFirestoreId = commander.firestoreId;
    if (!commanderFirestoreId) {
      commanderFirestoreId = await addCardToCollection({ ...commander, count: 1, finish: 'nonfoil' }, userId);
    }

    const commanderForDeck = { ...commander, firestoreId: commanderFirestoreId };
    const newDeck = {
      name: deckName,
      format: 'commander',
      commander: commanderForDeck,
      cards: {},
      createdAt: new Date().toISOString(),
      aiBlueprint: window.tempAiBlueprint
    };

    // Persist the new deck to Firestore and obtain its id (docRef)
    // Reuse the userId that was already validated above.
    const decksCol = collection(db, `artifacts/${appId}/users/${userId}/decks`);
    const docRef = await addDoc(decksCol, newDeck);

    showToast(`Deck "${newDeck.name}" created successfully!`, 'success');
    // Clear temporary blueprint/commander data after successful creation
    window.tempAiBlueprint = null;
    window.currentCommanderForAdd = null;

    // Close modals and navigate to single deck view for the newly created deck
    closeModal('ai-blueprint-modal');
    closeModal('deck-creation-modal');
    if (typeof window.showView === 'function') window.showView('singleDeck');
    if (typeof window.renderSingleDeck === 'function') window.renderSingleDeck(docRef.id);
    // Return the created deck id so callers (e.g., UI buttons) can chain actions.
    return docRef.id;
  } catch (error) {
    console.error('Error creating deck from blueprint:', error);
    showToast('Failed to create the new deck.', 'error');
  } finally {
    // Ensure in-flight flag is cleared even on error
    window.__createDeckFromBlueprintInFlight = false;
    window.tempAiBlueprint = null;
    window.currentCommanderForAdd = null;
  }
}

export function exportDeck(deckId) {
  const deck = localDecks[deckId];
  if (!deck) { showToast('Deck not found for export.', 'error'); return; }
  let allCardsForList = [];
  if (deck.commander && deck.commander.firestoreId) allCardsForList.push({ name: deck.commander.name, count: 1 });
  Object.keys(deck.cards || {}).forEach(firestoreId => {
    const cardData = localCollection[firestoreId];
    if (cardData) allCardsForList.push({ name: cardData.name, count: deck.cards[firestoreId].count });
  });
  const deckDataToExport = { deckInfo: { name: deck.name, format: deck.format, commander: deck.commander ? { scryfall_id: deck.commander.id, name: deck.commander.name } : null }, cards: allCardsForList };
  const dataStr = JSON.stringify(deckDataToExport, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${deck.name.replace(/\s/g, '_')}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(`Exported ${deck.name} as a JSON file!`, 'success');
}

export function handleImportDeckData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    try {
      const deckData = JSON.parse(content);
      await processDeckImport(deckData);
    } catch (error) {
      console.error('Error parsing deck file:', error);
      showToast('Could not parse file. Please ensure it is a valid deck JSON export.', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

export async function processDeckImport(deckData) {
  showToast(`Importing deck "${deckData.deckInfo?.name || 'Unnamed'}"...`, 'info');
  const cardsToFetch = deckData.cards || [];
  const batch = writeBatch(db);
  const userId = getUserId();
  if (!userId) { showToast('User not signed in.', 'error'); return; }
  for (const card of cardsToFetch) {
    try {
      const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}`);
      if (response.ok) {
        const scryfallCard = await response.json();
        const cardToAdd = { ...scryfallCard, count: card.count, finish: 'nonfoil', addedAt: new Date().toISOString() };
        const existing = Object.values(localCollection).find(c => c.id === scryfallCard.id && c.finish === 'nonfoil');
        if (existing) {
          const newCount = existing.count + card.count;
          batch.update(doc(db, `artifacts/${appId}/users/${userId}/collection`, existing.firestoreId), { count: newCount });
        } else {
          batch.set(doc(collection(db, `artifacts/${appId}/users/${userId}/collection`)), cardToAdd);
        }
      }
    } catch (err) {
      console.warn('Error fetching card for import', card.name, err);
    }
  }
  await batch.commit();
  showToast('Deck cards added to collection. Deck import simplified.', 'success');
}

// Expose compatibility shims on window
if (typeof window !== 'undefined') {
  window.openDeckDeleteOptions = openDeckDeleteOptions;
  window.handleDeckCreationSubmit = handleDeckCreationSubmit;
  window.createDeckFromBlueprint = createDeckFromBlueprint;
  window.exportDeck = exportDeck;
  window.handleImportDeckData = handleImportDeckData;
  window.processDeckImport = processDeckImport;
}
