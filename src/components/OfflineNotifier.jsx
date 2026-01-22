import React, { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

const OfflineNotifier = () => {
    const { addToast } = useToast();

    useEffect(() => {
        const handleOnline = () => addToast('You are back online!', 'success');
        const handleOffline = () => addToast('You are offline. Accessing cached data.', 'warning');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [addToast]);

    return null; // Logic only
};

export default OfflineNotifier;
