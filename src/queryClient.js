import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

// 1. Create the QueryClient instance
// 1. Create the QueryClient instance
export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error) => {
            console.warn('[QueryCache] Error:', error);
        }
    }),
    mutationCache: new MutationCache({
        onError: (error) => {
            console.error('[MutationCache] Operation Failed:', error);
            const message = error?.response?.data?.message || error?.message || 'Operation failed';

            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { type: 'error', message: `Error: ${message}` }
            }));
        }
    }),
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            retry: (failureCount, error) => {
                // Don't retry on 4xx client errors (400, 401, 403, 404, etc.)
                if (error?.response?.status >= 400 && error?.response?.status < 500) return false;
                if (!navigator.onLine) return false;
                return failureCount < 2;
            },
            refetchOnWindowFocus: false,
            networkMode: 'offlineFirst',
        },
    },
});

// 2. Create an IDB-based persister
export const persister = createAsyncStoragePersister({
    storage: {
        getItem: async (key) => await get(key),
        setItem: async (key, value) => await set(key, value),
        removeItem: async (key) => await del(key),
    },
    key: 'REACT_QUERY_OFFLINE_CACHE',
    throttleTime: 1000,
});

