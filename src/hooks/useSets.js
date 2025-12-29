import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useSets() {
    const [sets, setSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSets = async () => {
            try {
                // Fetch from LOCAL API which reads from Postgres
                const data = await api.get('/sets');
                const validSets = data.data || [];

                setSets(validSets);
                setLoading(false);

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
