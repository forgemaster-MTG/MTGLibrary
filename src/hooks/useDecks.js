import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function useDecks() {
    const [decks, setDecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentUser } = useAuth();

    const refresh = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const fetchedDecks = await api.get('/decks');
            // Map rows if needed
            setDecks(fetchedDecks);
            setError(null);
        } catch (err) {
            console.error("Error fetching decks:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!currentUser) {
            setDecks([]);
            setLoading(false);
            return;
        }
        refresh();
    }, [currentUser]);

    return { decks, loading, error, refresh };
}
