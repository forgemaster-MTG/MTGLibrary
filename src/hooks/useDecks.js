import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function useDecks(userId = null) {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const queryKey = ['decks', { userId: userId || currentUser?.uid }];

    const {
        data: decks = [],
        isLoading: loading,
        error,
        refetch
    } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!currentUser) return [];
            return await api.get('/api/decks', userId ? { userId } : {});
        },
        enabled: !!currentUser,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return {
        decks,
        loading,
        error,
        refresh: refetch
    };
}
