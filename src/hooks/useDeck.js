import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function useDeck(deckId) {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const queryKey = ['deck', deckId];

    const {
        data,
        isLoading: loading,
        error,
        refetch
    } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!currentUser || !deckId || deckId === 'new') return null;
            // API returns { deck: {...}, items: [...] }
            const { deck: fetchedDeck, items } = await api.get(`/api/decks/${deckId}`);

            const mappedCards = items.map(i => ({
                ...i,
                countInDeck: i.count || 1, // field from DB is 'count'
                managedId: i.id // The row ID in user_cards
            }));

            return { deck: fetchedDeck, cards: mappedCards };
        },
        enabled: !!currentUser && !!deckId && deckId !== 'new',
        staleTime: 1000 * 60 * 1, // 1 minute (was 5 minutes)
    });

    const deck = data?.deck || null;
    const cards = data?.cards || [];

    // Helpers to mimic previous setState behavior (mostly for optimistic updates or specific mutations)
    const setDeck = (newDeck) => {
        queryClient.setQueryData(queryKey, (old) => ({ ...old, deck: typeof newDeck === 'function' ? newDeck(old.deck) : newDeck }));
    };

    const setCards = (newCards) => {
        queryClient.setQueryData(queryKey, (old) => ({ ...old, cards: typeof newCards === 'function' ? newCards(old.cards) : newCards }));
    };

    return {
        deck,
        cards,
        setDeck,
        setCards,
        loading,
        error,
        refresh: refetch
    };
}
