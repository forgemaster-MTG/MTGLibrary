import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function useBinders(userId = null) {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();
    const targetUserId = userId || currentUser?.uid;

    const queryKey = ['binders', { userId: targetUserId }];

    const {
        data: binders = [],
        isLoading: loading,
        refetch
    } = useQuery({
        queryKey,
        queryFn: async () => {
            if (!currentUser) return [];
            return await api.getBinders({ userId: targetUserId });
        },
        enabled: !!currentUser && !!targetUserId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return {
        binders,
        loading,
        refreshBinders: refetch
    };
}
