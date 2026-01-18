/**
 * HistoryService.js
 * 
 * Manages state history for Undo/Redo functionality using a robust snapshot approach.
 * Persists an ordered timeline of states and provides methods to traverse them.
 * 
 * Structure:
 * - timeline: Array of { state: Object, action: String, timestamp: Number }
 * - pointer: Index of the current state in the timeline
 */

class HistoryService {
    constructor() {
        this.timeline = [];
        this.pointer = -1;
        this.limit = 50; // Max history depth
        this.listeners = new Set();
    }

    /**
     * Initializes the history with an initial state.
     * Clears any existing history.
     */
    init(initialState, silent = false) {
        this.timeline = [{
            state: this._clone(initialState),
            action: 'Initial State',
            timestamp: Date.now()
        }];
        this.pointer = 0;
        if (!silent) this._notify();
    }

    /**
     * Records a new state after an action.
     * Removes any "future" history if we were in the middle of the timeline (forking).
     * Now supports optional undo/redo callbacks (Command Pattern) for side effects.
     */
    push(actionDescription, newState, undoFn = null, redoFn = null) {
        // If we are not at the end, discard the future
        if (this.pointer < this.timeline.length - 1) {
            this.timeline = this.timeline.slice(0, this.pointer + 1);
        }

        // Add new snapshot
        this.timeline.push({
            state: this._clone(newState),
            action: actionDescription,
            timestamp: Date.now(),
            undoFn,
            redoFn
        });

        // Enforce limit
        if (this.timeline.length > this.limit) {
            this.timeline.shift();
        } else {
            this.pointer++;
        }

        this._notify();
    }

    /**
     * Moves the pointer back one step and returns the previous state.
     * Executes undoFn if present.
     */
    async undo() {
        if (!this.canUndo()) return null;

        const recordToUndo = this.timeline[this.pointer];

        if (recordToUndo.undoFn) {
            try {
                await recordToUndo.undoFn();
            } catch (err) {
                console.error("Undo callback failed", err);
                // Continue with state revert anyway? Or stop? 
                // Better to continue to keep UI in sync with pointer, 
                // but warn user.
            }
        }

        this.pointer--;
        const prevRecord = this.timeline[this.pointer];
        this._notify();
        return this._clone(prevRecord.state);
    }

    /**
     * Moves the pointer forward one step and returns the next state.
     * Executes redoFn if present.
     */
    async redo() {
        if (!this.canRedo()) return null;

        this.pointer++;
        const recordToRedo = this.timeline[this.pointer];

        if (recordToRedo.redoFn) {
            try {
                await recordToRedo.redoFn();
            } catch (err) {
                console.error("Redo callback failed", err);
            }
        }

        this._notify();
        return this._clone(recordToRedo.state);
    }

    canUndo() {
        return this.pointer > 0;
    }

    canRedo() {
        return this.pointer < this.timeline.length - 1;
    }

    /**
     * Returns the list of actions for display (Action Log).
     * Filters out the initial state if desired, or returns all.
     */
    getLog() {
        // Return reverse chronological order for UI
        return [...this.timeline].reverse();
    }

    getCurrentAction() {
        return this.timeline[this.pointer]?.action || 'Unknown';
    }

    /**
     * Deep clone helper to ensure state immutability in history.
     * Uses JSON parse/stringify for simplicity and safety with serializable data.
     */
    _clone(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            console.error('[HistoryService] Clone failed', e);
            return obj;
        }
    }

    /**
     * Jumps to a specific point in history.
     * Executes necessary undo callbacks if moving back, or redo callbacks if moving forward.
     */
    async jumpTo(index) {
        if (index < 0 || index >= this.timeline.length) return null;

        // If jumping back
        if (index < this.pointer) {
            // Execute undo for each step from current down to target+1
            for (let i = this.pointer; i > index; i--) {
                const record = this.timeline[i];
                if (record.undoFn) {
                    try {
                        await record.undoFn();
                    } catch (err) {
                        console.error(`Undo failed at step ${i}`, err);
                    }
                }
            }
        }
        // If jumping forward
        else if (index > this.pointer) {
            // Execute redo for each step from current+1 up to target
            for (let i = this.pointer + 1; i <= index; i++) {
                const record = this.timeline[i];
                if (record.redoFn) {
                    try {
                        await record.redoFn();
                    } catch (err) {
                        console.error(`Redo failed at step ${i}`, err);
                    }
                }
            }
        }

        this.pointer = index;
        const record = this.timeline[this.pointer];
        this._notify();
        return this._clone(record.state);
    }

    // --- Subscription System for UI Updates ---

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    _notify() {
        this.listeners.forEach(listener => listener({
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            history: this.getLog(),
            pointer: this.pointer,
            activeState: this.timeline[this.pointer]?.state // Send current state for syncing subscribers
        }));
    }
}

export default new HistoryService();
