// Shared UI helpers: toasts, modals, hover preview, floating header utils

// Internal helper to ensure container exists and has correct classes
function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  // Reset and apply modern container styles
  // Fixed bottom-right, z-index high, flex column, gap for spacing
  container.className = 'fixed bottom-6 right-6 z-[120000] flex flex-col items-end gap-3 pointer-events-none';

  // Remove any legacy inline styles that might have been stuck
  container.style = '';
  // We need to re-apply the fixed positioning if the style attribute was completely wiped, 
  // but the className above handles it. 
  // Just in case some external script tries to mess with it, we can leave it be, 
  // as the classes 'fixed bottom-6 right-6' are robust.

  return container;
}

export function showToast(message, type = 'info') {
  const container = getToastContainer();

  const toast = document.createElement('div');

  // Base styles: Glassmorphism, rounded, shadow, transition, pointer-events-auto
  const baseClasses = 'pointer-events-auto flex items-center w-auto max-w-md p-4 rounded-xl shadow-2xl backdrop-blur-md border transition-all duration-300 transform translate-x-full opacity-0';

  let typeClasses = '';
  let icon = '';

  switch (type) {
    case 'success':
      typeClasses = 'bg-green-900/80 border-green-500/30 text-green-50';
      icon = `<svg class="w-6 h-6 mr-3 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
      break;
    case 'error':
      typeClasses = 'bg-red-900/80 border-red-500/30 text-red-50';
      icon = `<svg class="w-6 h-6 mr-3 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
      break;
    case 'warning':
      typeClasses = 'bg-yellow-900/80 border-yellow-500/30 text-yellow-50';
      icon = `<svg class="w-6 h-6 mr-3 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
      break;
    default: // info
      typeClasses = 'bg-slate-800/80 border-slate-600/30 text-slate-50';
      icon = `<svg class="w-6 h-6 mr-3 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  }

  toast.className = `${baseClasses} ${typeClasses}`;
  toast.innerHTML = `${icon}<span class="font-medium text-sm leading-snug">${message}</span>`;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-full', 'opacity-0');
  });

  // Auto dismiss
  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300); // Wait for transition
  }, 5000);

  return toast;
}

export function openModal(modalId) {
  console.log('[openModal] Called with modalId:', modalId);
  const modal = document.getElementById(modalId);
  console.log('[openModal] Modal element:', modal, 'Classes before:', modal?.classList.toString());
  if (!modal) {
    console.error('[openModal] Modal not found!');
    return;
  }
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  // Force display with inline style to override any CSS conflicts
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.visibility = 'visible';
  modal.style.pointerEvents = 'auto';
  // AI suggestions modal needs higher z-index to appear over deck creation modal
  modal.style.zIndex = modalId === 'ai-suggestions-modal' ? '999999' : '99999';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
  modal.style.minHeight = '100vh';
  modal.style.height = '100vh';
  console.log('[openModal] Modal should now be visible!');
  // Small accessibility/UX: autofocus primary inputs for known modals
  try {
    // Delay slightly to allow modal to become visible
    setTimeout(() => {
      if (modalId === 'ai-suggestions-modal') {
        const el = document.getElementById('ai-chat-input'); if (el) try { el.focus(); } catch (e) { }
      } else if (modalId === 'rule-lookup-modal') {
        const el = document.getElementById('rule-lookup-input'); if (el) try { el.focus(); } catch (e) { }
      } else if (modalId === 'mtg-chat-modal') {
        const el = document.getElementById('mtg-chat-input'); if (el) try { el.focus(); } catch (e) { }
      }
    }, 60);
  } catch (e) { }
}
if (typeof window !== 'undefined') window.openModal = openModal;

export function closeModal(modalId) {
  console.log('[closeModal] Called with modalId:', modalId, 'Stack trace:', new Error().stack);
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  // Clear all inline styles that openModal set
  modal.style.display = '';
  modal.style.opacity = '';
  modal.style.visibility = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
  modal.style.backgroundColor = '';
  modal.style.minHeight = '';
  modal.style.height = '';

  // If closing AI blueprint modal, restore deck creation modal
  if (modalId === 'ai-blueprint-modal' && window.__restoreDeckCreationModal) {
    const deckCreationModal = document.getElementById('deck-creation-modal');
    if (deckCreationModal) {
      deckCreationModal.style.display = '';
    }
    window.__restoreDeckCreationModal = false;
  }
}

export function showToastWithProgress(message, current, total) {
  const container = getToastContainer();

  const toast = document.createElement('div');
  const toastId = `toast-progress-${Date.now()}`;
  toast.id = toastId;

  const baseClasses = 'pointer-events-auto w-80 p-4 rounded-xl shadow-2xl backdrop-blur-md border transition-all duration-300 transform translate-x-full opacity-0';
  const typeClasses = 'bg-slate-800/90 border-slate-600/30 text-slate-50';

  toast.className = `${baseClasses} ${typeClasses}`;

  toast.innerHTML = `
    <div class="flex items-center mb-2">
      <svg class="w-5 h-5 mr-3 text-blue-400 shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.058a8 8 0 10-.238-4.75.75.75 0 111.489.132A9.48 9.48 0 0111.25 2c5.247 0 9.5 4.253 9.5 9.5S16.497 21 11.25 21 1.75 16.747 1.75 11.5c0-2.132.702-4.118 1.9-5.72L4 4z"></path></svg>
      <span class="font-medium text-sm flex-1">${message}</span>
      <span id="${toastId}-counter" class="text-xs font-mono text-slate-400">${current} / ${total}</span>
    </div>
    <div class="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
      <div id="${toastId}-bar" class="bg-blue-500 h-full transition-all duration-300 ease-out" style="width:${total ? (current / total * 100) : 0}%"></div>
    </div>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-full', 'opacity-0');
  });

  return toastId;
}

export function updateToastProgress(toastId, current, total) {
  const counter = document.getElementById(`${toastId}-counter`);
  const bar = document.getElementById(`${toastId}-bar`);
  if (counter) counter.textContent = `${current} / ${total}`;
  if (bar) bar.style.width = `${total ? (current / total * 100) : 0}%`;
}

export function removeToastById(toastId) {
  const toast = document.getElementById(toastId);
  if (toast) {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }
}

// Generic toast updater for non-progress toasts (preserves legacy API)
export function updateToast(id, message, type) {
  const toast = document.getElementById(id);
  if (!toast) return;

  // We'll just update the content and style, keeping the element
  let typeClasses = '';
  let icon = '';

  switch (type) {
    case 'success':
      typeClasses = 'bg-green-900/80 border-green-500/30 text-green-50';
      icon = `<svg class="w-6 h-6 mr-3 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
      break;
    case 'error':
      typeClasses = 'bg-red-900/80 border-red-500/30 text-red-50';
      icon = `<svg class="w-6 h-6 mr-3 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
      break;
    default:
      typeClasses = 'bg-slate-800/80 border-slate-600/30 text-slate-50';
      icon = `<svg class="w-6 h-6 mr-3 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  }

  // Reset classes but keep base structure
  const baseClasses = 'pointer-events-auto flex items-center w-auto max-w-md p-4 rounded-xl shadow-2xl backdrop-blur-md border transition-all duration-300 transform';
  toast.className = `${baseClasses} ${typeClasses}`;
  toast.innerHTML = `${icon}<span class="font-medium text-sm leading-snug">${message}</span>`;

  // Reset timeout for auto-dismiss
  // Note: This simple implementation doesn't clear the previous timeout, 
  // so it might disappear earlier than expected if updated late. 
  // For a perfect implementation we'd store the timeout ID on the element.
  // But for now, let's at least try to give it some time if it was about to die.

  // Re-trigger the exit animation sequence
  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Helpers for floating table headers (kept lightweight)
export function computeTableHeaderTop(container) {
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
    container.querySelectorAll('table thead').forEach(thead => {
      thead.style.top = `${topOffset}px`;
    });
  } catch (err) {
    console.error('[computeTableHeaderTop] error', err);
  }
}

// Export commonly used modal helpers onto window for legacy inline code
if (typeof window !== 'undefined') {
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.showToast = showToast;
  window.showToastWithProgress = showToastWithProgress;
  window.updateToastProgress = updateToastProgress;
  window.removeToastById = removeToastById;
  window.updateToast = updateToast;
  window.computeTableHeaderTop = computeTableHeaderTop;
  // Provide a default toggleEditMode implementation that focuses on UI state
  // and delegates heavy re-render work to existing window renderers if present.
  window.toggleEditMode = function toggleEditMode() {
    try {
      const appWrapper = document.getElementById('app-wrapper');
      if (!appWrapper) return;
      const isEditMode = appWrapper.classList.toggle('edit-mode');
      const buttonText = document.getElementById('edit-mode-text');
      if (buttonText) buttonText.textContent = isEditMode ? 'Exit Edit Mode' : 'Edit Mode';
      if (isEditMode) showToast && showToast('Edit mode enabled. Deletion is now possible.', 'warning');
      // Re-render views that might be affected by edit mode if renderers exist
      try { if (typeof window.renderCollection === 'function') window.renderCollection(); } catch (e) { }
      try { if (typeof window.renderDecksList === 'function') window.renderDecksList(); } catch (e) { }
      try { const activeDeckId = document.getElementById('single-deck-view')?.dataset?.deckId; if (activeDeckId && typeof window.renderSingleDeck === 'function') window.renderSingleDeck(activeDeckId); } catch (e) { }
    } catch (err) {
      console.warn('[UI.toggleEditMode] error', err);
    }
  };
}
