/**
 * router.js
 * 
 * A lightweight hash-based router for the MTG Library SPA.
 * Handles URL changes (e.g. #/decks/123) and maps them to registered view handlers.
 */

export class Router {
    constructor() {
        this.routes = [];
        this.currentRoute = null;
        this.notFoundHandler = null;

        // Bind the listener so we can remove it if needed (though usually singleton)
        this._handleHashChange = this._handleHashChange.bind(this);
    }

    /**
     * Initialize the router and start listening for hash changes.
     * @param {boolean} trigger - Whether to trigger the current hash immediately.
     */
    init(trigger = true) {
        window.addEventListener('hashchange', this._handleHashChange);
        if (trigger) {
            this._handleHashChange();
        }
    }

    /**
     * Register a route.
     * @param {string|RegExp} path - The route path (e.g. '/decks', '/decks/:id') or regex.
     * @param {Function} handler - The function to call when route matches. Receives params object.
     */
    on(path, handler) {
        let regex;
        let keys = [];

        if (path instanceof RegExp) {
            regex = path;
        } else {
            // Convert path string to regex and extract param names
            // e.g. '/decks/:id' -> /^\/decks\/([^/]+)$/ and keys=['id']
            const pattern = path
                .replace(/:([^/]+)/g, (_, key) => {
                    keys.push(key);
                    return '([^/]+)';
                })
                .replace(/\//g, '\\/'); // Escape slashes

            regex = new RegExp(`^${pattern}$`);
        }

        this.routes.push({ regex, keys, handler });
        return this; // Chainable
    }

    /**
     * Set a handler for when no route matches.
     * @param {Function} handler 
     */
    setNotFound(handler) {
        this.notFoundHandler = handler;
    }

    /**
     * Navigate to a path programmatically.
     * @param {string} path - e.g. '/decks/123'
     */
    navigate(path) {
        window.location.hash = path;
    }

    /**
     * Internal handler for hash change events.
     */
    _handleHashChange() {
        // Get hash, strip leading '#'
        let hash = window.location.hash.slice(1);

        // Default to '/' if empty
        if (!hash) hash = '/';

        // Find matching route
        let match = null;
        let params = {};

        for (const route of this.routes) {
            const result = hash.match(route.regex);
            if (result) {
                match = route;
                // Extract params
                route.keys.forEach((key, index) => {
                    params[key] = decodeURIComponent(result[index + 1]);
                });
                break;
            }
        }

        if (match) {
            console.debug(`[Router] Matched route: ${hash}`, params);
            this.currentRoute = hash;
            match.handler(params);
        } else {
            console.warn(`[Router] No route found for: ${hash}`);
            if (this.notFoundHandler) {
                this.notFoundHandler(hash);
            }
        }
    }
}

// Export a singleton instance for convenience, or consumers can instantiate their own.
export const router = new Router();
