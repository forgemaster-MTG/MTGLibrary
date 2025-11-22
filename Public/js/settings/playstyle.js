import { showToast } from '../lib/ui.js';
import {
  playstyleState,
  loadPlaystyleForUser,
  savePlaystyleForUser,
  clearPlaystyleForUser,
  attachPlaystyleToPrompt,
  askNextQuestion,
  synthesizeStructuredPlaystyle
} from './playstyleLogic.js';

// Re-export for compatibility
export {
  playstyleState,
  loadPlaystyleForUser,
  savePlaystyleForUser,
  clearPlaystyleForUser,
  attachPlaystyleToPrompt,
  askNextQuestion,
  synthesizeStructuredPlaystyle
};

// --- UI Logic ---

export function renderPlaystyleWidget(containerId = 'playstyle-profile-content') {
  // Prefer the profile modal content
  let container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;

  // Fallback to settings if profile modal not found (backward compat)
  if ((!container || container === null) && typeof document !== 'undefined') {
    const settingsContainer = document.getElementById('settings-playstyle');
    if (settingsContainer) container = settingsContainer;
  }

  if (!container) return;
  container.innerHTML = '';

  const box = document.createElement('div');
  // Remove fixed height constraints for modal use, let container handle scrolling
  box.className = 'flex flex-col gap-4';

  // Use a default message if no summary exists
  const summaryHtml = playstyleState.summary
    ? escapeHtml(playstyleState.summary)
    : '<div class="text-center py-8"><p class="text-gray-400 mb-2">No playstyle profile found.</p><p class="text-sm text-gray-500">Take the quiz to help our AI understand your Magic preferences!</p></div>';

  box.innerHTML = `
    <div id="playstyle-summary" class="text-gray-300 leading-relaxed text-base bg-gray-800/50 p-4 rounded-xl border border-gray-700">
        ${summaryHtml}
    </div>

    <div class="flex items-center justify-center gap-3 pt-2">
      <button id="start-playstyle-wizard-btn" class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all transform hover:scale-105">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        ${playstyleState.summary ? 'Update Profile' : 'Start Quiz'}
      </button>
      ${playstyleState.summary ? `<button id="clear-playstyle-btn" class="inline-flex items-center gap-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 font-semibold py-3 px-6 rounded-lg border border-red-900/50 transition-all">Clear</button>` : ''}
    </div>
  `;
  container.appendChild(box);

  // Wire up buttons
  const startBtn = box.querySelector('#start-playstyle-wizard-btn');
  const clearBtn = box.querySelector('#clear-playstyle-btn');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      console.log('[Playstyle] Start Quiz button clicked');
      // Dynamic import to avoid circular dependency issues if any remain, though logic is now split
      import('../pages/playstyleWizard.js?v=' + Date.now()).then(mod => {
        console.log('[Playstyle] Wizard module loaded', mod);
        if (typeof mod.initPlaystyleWizard === 'function') {
          mod.initPlaystyleWizard();
        }
        if (typeof mod.openPlaystyleWizard === 'function') {
          mod.openPlaystyleWizard();
        } else {
          console.error('[Playstyle] openPlaystyleWizard not found in module', mod);
        }
      }).catch(err => {
        console.error('[Playstyle] Failed to load wizard module', err);
        showToast('Failed to load Playstyle Wizard.', 'error');
      });
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear your playstyle profile?')) return;

      const uid = window.userId;
      if (uid) {
        await clearPlaystyleForUser(uid);
        // Re-render to show empty state
        renderPlaystyleWidget(containerId);
        showToast('Playstyle cleared.', 'success');
      }
    });
  }
}

function escapeHtml(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function initPlaystyleModule() {
  if (typeof window !== 'undefined') {
    window.playstyle = {
      loadPlaystyleForUser,
      savePlaystyleForUser,
      clearPlaystyleForUser,
      attachPlaystyleToPrompt,
      renderPlaystyleWidget
    };
    window.playstyleState = playstyleState;
    // Expose render function globally so logic module can trigger updates
    window.renderPlaystyleWidget = renderPlaystyleWidget;
  }
  console.log('[Playstyle] Module initialized.');
}

// auto-init if imported
initPlaystyleModule();
