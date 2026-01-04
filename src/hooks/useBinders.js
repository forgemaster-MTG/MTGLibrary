import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function useBinders() {
    const [binders, setBinders] = useState([]);
    const [loading, setLoading] = useState(true);
    const { currentUser } = useAuth();

    const fetchBinders = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const data = await api.getBinders();
            setBinders(data);
        } catch (err) {
            console.error('[useBinders] Failed to fetch', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBinders();
    }, [currentUser]);

    return { binders, loading, refreshBinders: fetchBinders };
}
