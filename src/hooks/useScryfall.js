import { useState, useCallback } from 'react';

export function useScryfall() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const searchCards = useCallback(async (query) => {
        if (!query || query.length < 2) return;

        setLoading(true);
        setError(null);
        try {
            // Using Scryfall Search API
            const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints`);
            if (!response.ok) {
                if (response.status === 404) {
                    setResults([]);
                    return;
                }
                throw new Error('Scryfall API error');
            }
            const data = await response.json();
            // Filter to valid cards (some might be tokens or art series which are fine, but let's stick to normal)
            setResults(data.data || []);
        } catch (err) {
            console.error(err);
            setError(err.message);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    return { results, loading, error, searchCards, setResults };
}
