import { useState, useEffect } from 'react';

export function useSets() {
    const [sets, setSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSets = async () => {
            try {
                // Check if we have cached sets in localStorage to save bandwidth
                const cached = localStorage.getItem('mtg_sets_cache');
                const cacheTime = localStorage.getItem('mtg_sets_timestamp');
                const oneDay = 24 * 60 * 60 * 1000;

                if (cached && cacheTime && (Date.now() - parseInt(cacheTime) < oneDay)) {
                    setSets(JSON.parse(cached));
                    setLoading(false);
                    return;
                }

                const response = await fetch('https://api.scryfall.com/sets');
                if (!response.ok) throw new Error('Failed to fetch sets');

                const data = await response.json();

                // Filter out digital only sets if desired, or keep them all.
                // We'll keep them but might filter in UI.
                const validSets = data.data;

                setSets(validSets);
                setLoading(false);

                // Cache it
                localStorage.setItem('mtg_sets_cache', JSON.stringify(validSets));
                localStorage.setItem('mtg_sets_timestamp', Date.now().toString());

            } catch (err) {
                console.error("Error fetching sets:", err);
                setError(err);
                setLoading(false);
            }
        };

        fetchSets();
    }, []);

    return { sets, loading, error };
}
