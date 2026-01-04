import { useState, useCallback } from 'react';
import { api } from '../services/api';

export function useScryfall() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const searchCards = useCallback(async (query, options = {}) => {
        const { set, cn, ...advancedFilters } = options;

        const normalizedQuery = (query || '').trim();
        const hasFilters = set || cn || Object.keys(advancedFilters).length > 0;

        if (!hasFilters && (!normalizedQuery || normalizedQuery.length < 2)) {
            setResults([]);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // Use local API for caching and advanced search logic
            const response = await api.post('/api/cards/search', {
                query: normalizedQuery,
                set,
                cn,
                ...advancedFilters
            });

            setResults(response.data || []);
        } catch (err) {
            console.error(err);
            setError(err.message);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const getSuggestions = useCallback(async (query) => {
        if (!query || query.trim().length < 2) return [];
        try {
            const response = await api.get('/api/cards/autocomplete', { q: query });
            return response.data || [];
        } catch (err) {
            console.error('[useScryfall] Autocomplete error:', err);
            return [];
        }
    }, []);

    return { results, loading, error, searchCards, getSuggestions, setResults };
}
