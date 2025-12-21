import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function useCollection() {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentUser } = useAuth();

    // Helper to refresh data manually if needed
    const refresh = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            console.log('[useCollection] Fetching from API...');
            const fetchedCards = await api.get('/collection');
            // Map items (user_cards rows) to frontend expected shape
            // Start with c.data (Scryfall data), then overlay row fields
            const mapped = fetchedCards.map(c => ({
                ...c.data, // Spread scryfall data (rarity, colors, etc.)
                ...c,      // Spread row fields (id, firestore_id, deck_id, count)
                // Field Mappings for UI compatibility
                deckId: c.deck_id,
                quantity: c.count,
                firestoreId: c.firestore_id,
                id: c.id // UUID
                // scryfall_id is in c.scryfall_id
            }));
            setCards(mapped);
            setError(null);
        } catch (err) {
            console.error("Error fetching collection:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!currentUser) {
            setCards([]);
            setLoading(false);
            return;
        }
        refresh();
    }, [currentUser]);

    const removeCard = async (id) => {
        try {
            await api.delete(`/collection/${id}`);
            await refresh();
        } catch (err) {
            console.error("Error removing card:", err);
            throw err;
        }
    };

    const updateCard = async (id, data) => {
        try {
            await api.put(`/collection/${id}`, data);
            await refresh();
        } catch (err) {
            console.error("Error updating card:", err);
            throw err;
        }
    };

    return { cards, loading, error, refresh, removeCard, updateCard };
}
