import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function useBinders() {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const queryKey = ['binders', { userId: currentUser?.uid }];

    const {
        data: binders = [],
        isLoading: loading,
        refetch
    } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!currentUser) return [];
            return await api.getBinders();
        },
        enabled: !!currentUser,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return {
        binders,
        loading,
        refreshBinders: refetch
    };
}
