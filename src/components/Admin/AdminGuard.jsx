import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AdminGuard = ({ children }) => {
    const { currentUser, userProfile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-indigo-500">Loading...</div>;
    }

    // TODO: rigorous role check. For now, email list or role 'admin'
    console.log('[AdminGuard] Checking access for:', currentUser?.email, 'Role:', userProfile?.role, 'isAdmin:', userProfile?.settings?.isAdmin);
    const isAdmin = userProfile?.role === 'admin' ||
        userProfile?.isAdmin === true ||
        userProfile?.settings?.isAdmin === true ||
        ['gidgiddings@gmail.com', 'test@test.com', 'forge_test@gmail.com'].includes(currentUser?.email);

    if (!isAdmin) {
        console.warn('Access denied: Admin only');
        return <Navigate to="/dashboard" state={{ from: location }} replace />;
    }

    return children;
};

export default AdminGuard;
