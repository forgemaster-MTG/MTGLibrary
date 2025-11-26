/**
 * chat.js
 * 
 * Manages the MTG Chat feature (AI Assistant).
 * Responsible for:
 * 1. Handling user input from the chat modal.
 * 2. Managing chat history state.
 * 3. Interacting with the Gemini API via `gemini.js`.
 * 4. Injecting context (Playstyle) into the AI system instruction.
 * 5. Exporting chat history.
 */

import { getGeminiUrlForCurrentUser } from '../firebase/gemini.js';
import { showToast } from '../lib/ui.js';

let mtgChatHistory = [];
let isRequestInFlight = false;

/**
 * Initializes the chat module.
 * Wires up event listeners for the chat modal (Submit, Save, Export).
 * Uses cloning to ensure clean event binding (removes legacy listeners).
 */
export function initChatModule() {
    const form = document.getElementById('mtg-chat-form');
    if (form) {
        // Remove old listeners by cloning (simple way to clear legacy listeners)
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('mtg-chat-input');
            const message = input.value.trim();
            if (!message) return;

            await handleMtgChat(message);
        });
    }

    // Wire up Save/Export buttons
    const saveBtn = document.getElementById('save-mtg-conversation-btn');
    if (saveBtn) {
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.addEventListener('click', () => saveConversationAsTxt());
    }

    const exportBtn = document.getElementById('export-mtg-conversation-btn');
    if (exportBtn) {
        const newBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        newBtn.addEventListener('click', () => exportConversationAsJson());
    }

    console.log('[Chat] Module initialized.');
}

/**
 * Handles sending a message to the MTG Chat AI.
 * Flow:
 * 1. Updates UI to loading state.
 * 2. Adds user message to local history and renders it.
 * 3. Constructs the System Instruction (including Playstyle context).
 * 4. Sends request to Gemini API.
 * 5. Processes response and updates UI.
 * 
 * @param {string} userMessage - The text entered by the user.
 */
export async function handleMtgChat(userMessage) {
    if (isRequestInFlight) return;
    isRequestInFlight = true;

    const input = document.getElementById('mtg-chat-input');
    const sendBtn = document.querySelector('#mtg-chat-form button[type="submit"]');
    const spinner = sendBtn.querySelector('.mtg-spinner');
    const btnText = sendBtn.querySelector('.mtg-btn-text');

    // UI Updates
    if (input) input.value = '';
    if (sendBtn) sendBtn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.classList.add('opacity-50');

    // Add User Message
    mtgChatHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    renderChatHistory();

    try {
        const systemInstruction = `
      You are MTG Forge, an elite Magic: The Gathering AI assistant.
      Your goal is to provide accurate, strategic, and engaging advice to players.
      
      **Persona & Style:**
      - Knowledgeable, friendly, and concise.
      - Use emojis to add flair (e.g., ⚔️, 🛡️, 🔥, 💀, 🌳, 💧, ☀️).
      - Format responses using **Tailwind CSS** classes within HTML tags for a premium look.
      - Do NOT use Markdown. Output raw HTML that can be injected directly into a <div>.
      
      **Formatting Rules:**
      - Use <p class="mb-2 text-gray-300"> for paragraphs.
      - Use <strong class="text-indigo-400"> for key terms or card names.
      - Use <ul class="list-disc pl-5 mb-2 space-y-1 text-gray-300"> for lists.
      - Use <div class="bg-gray-700/50 p-3 rounded-lg border-l-4 border-indigo-500 mb-2"> for important notes or rules citations.
      - Use <code class="bg-gray-900 px-1 py-0.5 rounded text-indigo-300 font-mono text-sm"> for mana costs (e.g., {1}{U}{B}) or keywords.

      **Content Guidance:**
      - If asked about rules, cite the Comprehensive Rules if possible.
      - If asked about deck building, consider mana curve, synergy, and format staples.
      - If asked about lore, be descriptive and immersive.
    `;

        // Inject Playstyle Summary if available
        try {
            let summary = null;
            if (typeof window.getPlaystyleSummary === 'function') {
                summary = await window.getPlaystyleSummary(null);
            } else if (window.playstyleState?.summary) {
                summary = window.playstyleState.summary;
            } else if (window.playstyleSummary) {
                summary = window.playstyleSummary;
            }

            if (summary) {
                systemInstruction += `\n\n**User Playstyle Context:**\n${summary}\n\nIMPORTANT: Tailor your advice to match this playstyle.`;
            }
        } catch (e) {
            console.warn('[Chat] Failed to load playstyle summary:', e);
        }

        // Prepare Payload
        const payload = {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: mtgChatHistory
        };

        const url = await getGeminiUrlForCurrentUser();
        if (!url) throw new Error('Gemini API Key not found. Please check your settings.');

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiText) throw new Error('Empty response from AI.');

        mtgChatHistory.push({ role: 'model', parts: [{ text: aiText }] });
        renderChatHistory();

    } catch (error) {
        console.error('[Chat] Error:', error);
        mtgChatHistory.push({
            role: 'model',
            parts: [{ text: `<div class="p-3 bg-red-900/30 border border-red-700 rounded text-red-200">Error: ${error.message}</div>` }]
        });
        renderChatHistory();
    } finally {
        isRequestInFlight = false;
        if (sendBtn) sendBtn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.classList.remove('opacity-50');
        if (input) input.focus();
    }
}

/**
 * Renders the chat history to the DOM.
 */
function renderChatHistory() {
    const container = document.getElementById('mtg-chat-history');
    if (!container) return;

    container.innerHTML = mtgChatHistory.map(msg => {
        const isUser = msg.role === 'user';
        const alignClass = isUser ? 'justify-end' : 'justify-start';
        const bgClass = isUser ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200';
        const roundedClass = isUser ? 'rounded-br-none' : 'rounded-bl-none';

        // For user messages, we escape HTML to prevent XSS.
        // For AI messages, we trust the "Tailwind HTML" instruction but should ideally sanitize (omitted for brevity/functionality focus).
        const content = isUser ? escapeHtml(msg.parts[0].text) : msg.parts[0].text;

        return `
      <div class="flex ${alignClass} mb-4">
        <div class="max-w-[85%] p-4 rounded-2xl ${roundedClass} ${bgClass} shadow-md leading-relaxed">
          ${content}
        </div>
      </div>
    `;
    }).join('');

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/**
 * Saves the conversation as a text file.
 */
function saveConversationAsTxt() {
    if (mtgChatHistory.length === 0) {
        showToast('No conversation to save.', 'info');
        return;
    }

    const text = mtgChatHistory.map(m => {
        const role = m.role === 'user' ? 'User' : 'MTG Forge';
        // Strip HTML tags for text export
        const cleanText = m.parts[0].text.replace(/<[^>]+>/g, '');
        return `${role}:\n${cleanText}\n`;
    }).join('\n-----------------------------------\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtg-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Conversation saved.', 'success');
}

/**
 * Exports the conversation as JSON.
 */
function exportConversationAsJson() {
    if (mtgChatHistory.length === 0) {
        showToast('No conversation to export.', 'info');
        return;
    }

    const json = JSON.stringify(mtgChatHistory, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtg-chat-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Conversation exported.', 'success');
}

// Helper to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expose globally for legacy calls if needed
window.handleMtgChat = handleMtgChat;
