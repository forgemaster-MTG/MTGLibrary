import { useState, useEffect, useCallback } from 'react';
import HistoryService from '../services/HistoryService';

/**
 * useUndo Hook
 * 
 * Integrates the HistoryService with a React component's state.
 * 
 * @param {Object} initialState - The initial state of the data to track
 * @param {Function} onStateChange - Callback function (state setter) to update the component when Undo/Redo occurs
 * @returns {Object} - { undo, redo, recordAction, canUndo, canRedo, history }
 */
const useUndo = (initialState, onStateChange) => {
    // Local state to track history status for re-rendering
    const [historyStatus, setHistoryStatus] = useState({
        canUndo: false,
        canRedo: false,
        history: [],
        pointer: -1
    });

    // Initialize history only once on mount
    useEffect(() => {
        if (initialState) {
            HistoryService.init(initialState);
        }
    }, []); // Empty dependency array - init once

    // Subscribe to HistoryService updates
    useEffect(() => {
        const unsubscribe = HistoryService.subscribe((status) => {
            setHistoryStatus(status);

            // Sync local component state if the update came from an external source (like Navbar jumpTo)
            // We check if the status has an activeState and if it differs from what we expect?
            // Simplified: If activeState is provided, we just apply it.
            // CAUTION: This might loop if not careful.
            // But since HistoryService only emits on push/undo/redo/jumpTo, it should be fine.
            // We only apply if we are "connected".
            if (status.activeState && onStateChange) {
                onStateChange(status.activeState);
            }
        });
        return unsubscribe;
    }, [onStateChange]);

    // Helper: Perform Undo
    const performUndo = useCallback(() => {
        const prevState = HistoryService.undo();
        if (prevState) {
            onStateChange(prevState);
        }
    }, [onStateChange]);

    // Helper: Perform Redo
    const performRedo = useCallback(() => {
        const nextState = HistoryService.redo();
        if (nextState) {
            onStateChange(nextState);
        }
    }, [onStateChange]);

    // Helper: Record a new action with optional side-effect callbacks (Command Pattern)
    const recordAction = useCallback((actionDescription, newState, undoFn = null, redoFn = null) => {
        HistoryService.push(actionDescription, newState, undoFn, redoFn);
    }, []);

    // Keyboard Shortcuts (Ctrl+Z / Ctrl+Y)
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Check for Ctrl (or Cmd on Mac)
            if ((e.ctrlKey || e.metaKey)) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Ctrl+Shift+Z = Redo
                        if (HistoryService.canRedo()) performRedo();
                    } else {
                        // Ctrl+Z = Undo
                        if (HistoryService.canUndo()) performUndo();
                    }
                } else if (e.key === 'y') {
                    // Ctrl+Y = Redo (Windows standard)
                    e.preventDefault();
                    if (HistoryService.canRedo()) performRedo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [performUndo, performRedo]);

    return {
        undo: performUndo,
        redo: performRedo,
        recordAction,
        canUndo: historyStatus.canUndo,
        canRedo: historyStatus.canRedo,
        history: historyStatus.history,
        pointer: historyStatus.pointer
    };
};

export default useUndo;
