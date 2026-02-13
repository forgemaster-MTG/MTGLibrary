import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function useCollection(options = {}) {
    const { wishlist, userId } = options;
    const auth = useAuth();
    const currentUser = auth?.currentUser;
    const queryClient = useQueryClient();

    const queryKey = ['collection', { wishlist, userId: userId || currentUser?.uid }];

    const {
        data: cards = [],
        isLoading: loading,
        error,
        refetch
    } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!currentUser) return [];
            const params = new URLSearchParams();
            if (wishlist !== undefined) params.append('wishlist', wishlist);
            if (userId) params.append('userId', userId);

            const fetchedCards = await api.get(`/api/collection?${params.toString()}`);
            // Map items (user_cards rows) to frontend expected shape
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
        enabled: !!currentUser,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const removeCardMutation = useMutation({
        mutationFn: async (id) => {
            await api.delete(`/api/collection/${id}`);
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey });
            const previousCards = queryClient.getQueryData(queryKey);

            // Optimistically remove
            queryClient.setQueryData(queryKey, (old) => old.filter(c => c.id !== id));

            return { previousCards };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(queryKey, context.previousCards);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const updateCardMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            await api.put(`/api/collection/${id}`, data);
        },
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey });
            const previousCards = queryClient.getQueryData(queryKey);

            // Optimistically update
            queryClient.setQueryData(queryKey, (old) => {
                return old.map(c => {
                    if (c.id === id) {
                        return { ...c, ...data };
                    }
                    return c;
                });
            });

            return { previousCards };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(queryKey, context.previousCards);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const removeCard = async (id) => {
        try {
            await removeCardMutation.mutateAsync(id);
        } catch (err) {
            console.error("Error removing card:", err);
            throw err;
        }
    };

    const updateCard = async (id, data) => {
        try {
            await updateCardMutation.mutateAsync({ id, data });
        } catch (err) {
            console.error("Error updating card:", err);
            throw err;
        }
    };

    const batchRemoveCardsMutation = useMutation({
        mutationFn: async (ids) => {
            await api.batchDeleteCollection(ids);
        },
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey });
            const previousCards = queryClient.getQueryData(queryKey);
            const idsToRemove = new Set(ids);

            // Optimistically remove
            if (previousCards) {
                queryClient.setQueryData(queryKey, (old) => old.filter(c => !idsToRemove.has(c.id)));
            }

            return { previousCards };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(queryKey, context.previousCards);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const batchRemoveCards = async (ids) => {
        try {
            await batchRemoveCardsMutation.mutateAsync(ids);
        } catch (err) {
            console.error("Error removing cards:", err);
            throw err;
        }
    };

    // Maintain API compatibility
    return {
        cards,
        loading,
        error,
        refresh: refetch,
        removeCard,
        updateCard,
        batchRemoveCards,
        setCards: (newCards) => queryClient.setQueryData(queryKey, newCards) // Allow manual optimistic updates if needed
    };
}
