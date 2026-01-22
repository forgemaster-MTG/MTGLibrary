import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function useCollectionQuery(options = {}) {
    const { wishlist, userId } = options;
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const queryKey = ['collection', { userId: userId || currentUser?.uid, wishlist }];

    const {
        data: cards = [],
        isLoading: loading,
        error,
        isFetching
    } = useQuery({
        queryKey,
        queryFn: async () => {
            const params = {};
            if (wishlist !== undefined) params.wishlist = wishlist;
            if (userId) params.userId = userId;

            // Note: api.get implementation currently constructs query string manually for some routes,
            // but we can pass params object if modified api.js supports it, or manual string here.
            // Based on api.js view: request(method, endpoint, body, params) supports params object.

            const fetchedCards = await api.get('/api/collection', params);

            // Map items to frontend shape
            return fetchedCards.map(c => ({
                ...c.data,
                ...c,
                deckId: c.deck_id,
                quantity: c.count,
                firestoreId: c.firestore_id,
                id: c.id,
                scryfall_id: c.scryfall_id
            }));
        },
        enabled: !!currentUser, // Only fetch if logged in
        staleTime: 1000 * 60 * 5, // 5 minutes fresh
        gcTime: 1000 * 60 * 15, // 15 minutes cache
    });

    // Mutations
    const addCardMutation = useMutation({
        mutationFn: (cards) => api.batchAddToCollection(cards),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collection'] });
        }
    });

    const removeCardMutation = useMutation({
        mutationFn: (id) => api.delete(`/api/collection/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collection'] });
        }
    });

    const updateCardMutation = useMutation({
        mutationFn: ({ id, data }) => api.put(`/api/collection/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collection'] });
        }
    });

    // Wrapper functions to match old hook signature where possible
    const removeCard = (id) => removeCardMutation.mutateAsync(id);
    const updateCard = (id, data) => updateCardMutation.mutateAsync({ id, data });

    // For manual refresh, we just invalidate
    const refresh = () => queryClient.invalidateQueries({ queryKey });

    return {
        cards,
        loading,
        error,
        refresh,
        removeCard,
        updateCard,
        isFetching,
        addCard: addCardMutation.mutateAsync
    };
}
