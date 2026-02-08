import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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


    // Mutations
    const removeCardMutation = useMutation({
        mutationFn: async (cardId) => {
            await api.put(`/api/collection/${cardId}`, { deck_id: null });
        },
        onMutate: async (cardId) => {
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);

            // Optimistically remove
            if (previousData) {
                queryClient.setQueryData(queryKey, (old) => ({
                    ...old,
                    cards: old.cards.filter(c => c.managedId !== cardId && c.id !== cardId)
                }));
            }

            return { previousData };
        },
        onError: (err, cardId, context) => {
            queryClient.setQueryData(queryKey, context.previousData);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const batchRemoveCardsMutation = useMutation({
        mutationFn: async ({ cardIds, action }) => {
            await api.delete(`/api/decks/${deckId}/cards?action=${action}`, { cardIds });
        },
        onMutate: async ({ cardIds }) => {
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);
            const idsToRemove = new Set(cardIds);

            // Optimistically remove
            if (previousData) {
                queryClient.setQueryData(queryKey, (old) => ({
                    ...old,
                    cards: old.cards.filter(c => !idsToRemove.has(c.managedId) && !idsToRemove.has(c.id))
                }));
            }

            return { previousData };
        },
        onError: (err, vars, context) => {
            queryClient.setQueryData(queryKey, context.previousData);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const removeCard = (cardId) => removeCardMutation.mutateAsync(cardId);
    const batchRemoveCards = (cardIds, action = 'remove') => batchRemoveCardsMutation.mutateAsync({ cardIds, action });

    return {
        deck,
        cards,
        setDeck,
        setCards,
        loading,
        error,
        refresh: refetch,
        removeCard,
        batchRemoveCards
    };
}
