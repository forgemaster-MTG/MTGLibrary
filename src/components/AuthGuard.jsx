import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AuthGuard = ({ children }) => {
    const { currentUser, userProfile, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        // Reset check state if logged out
        if (!currentUser && !loading) {
            setHasChecked(false);
            return;
        }

        if (loading || hasChecked) return;

        // Perform the check once per session/mount
        if (currentUser && userProfile) {
            const publicPaths = ['/', '/login', '/about'];
            const isPublicPath = publicPaths.includes(location.pathname) || location.pathname.startsWith('/share/');
            const isOnboarding = location.pathname === '/onboarding';

            const isComplete = userProfile.settings?.onboarding_complete;

            // If not complete, and not on an allowed path, redirect
            if (!isComplete && !isOnboarding && !isPublicPath) {
                navigate('/onboarding');
            }

            // Mark as checked so we don't interfere with subsequent navigation
            setHasChecked(true);
        }

    }, [currentUser, userProfile, loading, location, navigate, hasChecked]);

    if (loading) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-indigo-500">Loading...</div>;
    }

    return children;
};

export default AuthGuard;
