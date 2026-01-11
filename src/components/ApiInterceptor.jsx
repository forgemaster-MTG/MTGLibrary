import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { setGlobalToast } from '../services/api';

/**
 * Validates connection between React Toast Context and non-React API service.
 * Renders nothing.
 */
const ApiInterceptor = () => {
    const { addToast } = useToast();

    useEffect(() => {
        setGlobalToast(addToast);

        // Cleanup not strictly necessary for singleton, but good practice if mounted/unmounted
        return () => setGlobalToast(null);
    }, [addToast]);

    return null;
};

export default ApiInterceptor;
