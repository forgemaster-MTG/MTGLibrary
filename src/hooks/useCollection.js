import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function useCollection(options = {}) {
    const { wishlist, userId } = options;
    const { currentUser } = useAuth();
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const updateCardMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            await api.put(`/api/collection/${id}`, data);
        },
        onSuccess: () => {
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

    // Maintain API compatibility
    return {
        cards,
        loading,
        error,
        refresh: refetch,
        removeCard,
        updateCard,
        setCards: (newCards) => queryClient.setQueryData(queryKey, newCards) // Allow manual optimistic updates if needed
    };
}
