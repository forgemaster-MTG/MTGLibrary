/**
 * bugTracker.js
 * 
 * Handles fetching and displaying the known bugs list (tasklist.txt).
 */

export function initBugTracker() {
    const navBtn = document.getElementById('nav-bug-tracker');
    if (!navBtn) return;

    // Create modal if it doesn't exist
    if (!document.getElementById('bug-tracker-modal')) {
        const modalHtml = `
      <div id="bug-tracker-modal" class="fixed inset-0 z-[60] hidden flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700 m-4">
          <div class="flex justify-between items-center p-4 border-b border-gray-700">
            <h3 class="text-xl font-bold text-white flex items-center gap-2">
              <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Known Bugs & Tasks
            </h3>
            <button id="close-bug-tracker-btn" class="text-gray-400 hover:text-white transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="p-4 overflow-y-auto font-mono text-sm text-gray-300 bg-gray-900/50 flex-grow whitespace-pre-wrap" id="bug-tracker-content">
            Loading...
          </div>
          <div class="p-4 border-t border-gray-700 bg-gray-800/50 rounded-b-xl flex justify-between items-center">
             <p class="text-xs text-gray-500">Source: Public/tasklist.txt</p>
             <a href="https://discord.gg/p4ybr8h6QV" target="_blank" class="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1">
               <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.42-2.157 2.42zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.42-2.157 2.42z"/></svg>
               Report new bugs on Discord
             </a>
          </div>
        </div>
      </div>
    `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    const modal = document.getElementById('bug-tracker-modal');
    const closeBtn = document.getElementById('close-bug-tracker-btn');
    const contentDiv = document.getElementById('bug-tracker-content');

    function openModal() {
        modal.classList.remove('hidden');
        fetch('tasklist.txt')
            .then(response => {
                if (!response.ok) throw new Error('Failed to load task list');
                return response.text();
            })
            .then(text => {
                // Simple formatting: Bold headers, checkmarks green/red
                let formatted = text
                    .replace(/\[x\]/g, '<span class="text-green-400">[x]</span>')
                    .replace(/\[ \]/g, '<span class="text-red-400">[ ]</span>')
                    .replace(/\[\/\]/g, '<span class="text-yellow-400">[/]</span>')
                    .replace(/^# (.*$)/gm, '<span class="text-xl font-bold text-white">$1</span>')
                    .replace(/^## (.*$)/gm, '<span class="text-lg font-bold text-indigo-300 mt-4 block">$1</span>');

                contentDiv.innerHTML = formatted;
            })
            .catch(err => {
                contentDiv.textContent = 'Error loading bug list: ' + err.message;
            });
    }

    function closeModal() {
        modal.classList.add('hidden');
    }

    navBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}
