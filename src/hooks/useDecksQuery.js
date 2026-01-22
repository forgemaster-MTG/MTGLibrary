import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export function useDecksQuery(userId = null) {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const queryKey = ['decks', userId || currentUser?.uid];

    const {
        data: decks = [],
        isLoading: loading,
        error,
        isFetching
    } = useQuery({
        queryKey,
        queryFn: () => api.get('/api/decks', userId ? { userId } : {}),
        enabled: !!currentUser,
        staleTime: 1000 * 60 * 5,
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey });

    return { decks, loading, error, refresh, isFetching };
}
