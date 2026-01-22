import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

// 1. Create the QueryClient instance
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            cacheTime: 1000 * 60 * 60 * 24, // 24 hours
            retry: (failureCount, error) => {
                // Don't retry on 403/404 or if offline
                if (error?.response?.status === 403 || error?.response?.status === 404) return false;
                if (!navigator.onLine) return false;
                return failureCount < 2;
            },
            refetchOnWindowFocus: false, // Prevent storms when alt-tabbing
            networkMode: 'offlineFirst', // Allow cached data usage even if "offline"
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

