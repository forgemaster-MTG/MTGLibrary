import { useEffect, useCallback } from 'react';

// Key Combo Helper
const matchKey = (e, key, modifiers = []) => {
    if (!key) return false;
    if (e.key.toLowerCase() !== key.toLowerCase()) return false;

    const hasCtrl = modifiers.includes('ctrl') || modifiers.includes('meta'); // Treat meta (cmd) like ctrl for mac
    const hasShift = modifiers.includes('shift');
    const hasAlt = modifiers.includes('alt');

    if ((e.ctrlKey || e.metaKey) !== hasCtrl) return false;
    if (e.shiftKey !== hasShift) return false;
    if (e.altKey !== hasAlt) return false;

    return true;
};

/**
 * useKeyboardShortcuts
 * @param {Array} shortcuts - Array of shortcut objects { key: 'k', modifiers: ['ctrl'], action: () => {}, preventDefault: true }
 * @param {Object} options - { enabled: boolean, target: ref }
 */
export function useKeyboardShortcuts(shortcuts = [], options = {}) {
    const { enabled = true, target } = options;

    const handleKeyDown = useCallback((e) => {
        if (!enabled) return;

        // Iterate shortcuts
        for (const shortcut of shortcuts) {
            const { key, modifiers = [], action, preventDefault = true } = shortcut;

            if (matchKey(e, key, modifiers)) {
                if (preventDefault) e.preventDefault();
                action(e);
                return; // Execute only one match
            }
        }
    }, [shortcuts, enabled]);

    useEffect(() => {
        const element = target?.current || window;
        element.addEventListener('keydown', handleKeyDown);
        return () => element.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown, target]);
}
