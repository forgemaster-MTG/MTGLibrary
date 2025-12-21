import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function useDeck(deckId) {
    const [deck, setDeck] = useState(null);
    const [cards, setCards] = useState([]); // Array of card objects
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentUser } = useAuth();

    const refresh = async () => {
        if (!currentUser || !deckId || deckId === 'new') return;
        setLoading(true);
        try {
            // API returns { deck: {...}, items: [...] }
            const { deck: fetchedDeck, items } = await api.get(`/decks/${deckId}`);

            setDeck(fetchedDeck);
            // Map items (user_cards rows) to frontend expected shape
            // Note: `items` already has `count`, `name`, `image_uri` etc.
            // We might need to map firestore_id or id.
            setCards(items.map(i => ({
                ...i,
                countInDeck: i.count || 1, // field from DB is 'count'
                managedId: i.id // The row ID in user_cards
            })));

            setError(null);
        } catch (err) {
            console.error("Error fetching deck:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!currentUser || !deckId) {
            setLoading(false);
            return;
        }
        refresh();
    }, [currentUser, deckId]);

    return { deck, cards, loading, error, refresh };
}
