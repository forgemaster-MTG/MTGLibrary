import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { auth } from '../lib/firebase';

import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Sign up
    const signup = (email, password) => {
        return createUserWithEmailAndPassword(auth, email, password);
    };

    // Login
    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    // Sign in with Google
    const loginWithGoogle = () => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
    };

    // Logout
    const logout = () => {
        setUserProfile(null);
        return signOut(auth);
    };

    const refreshUserProfile = async () => {
        if (!auth.currentUser) return;
        try {
            const profile = await api.get('/me'); // Calls /me which returns { id, email, data, settings? }
            // Note: /me in server returns { id, firestore_id, email, data }. 
            // We need to update server/index.js /me to include 'settings'.
            setUserProfile(profile);
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                // Fetch profile
                // We need to wait a bit or ensure token is ready? 
                // api.js handles token retrieval.
                await refreshUserProfile();
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const updateSettings = async (newSettings) => {
        if (!userProfile) return;
        const updatedSettings = { ...(userProfile.settings || {}), ...newSettings };
        try {
            await api.updateUser(userProfile.id, { settings: updatedSettings });
            setUserProfile(prev => ({ ...prev, settings: updatedSettings }));
        } catch (error) {
            console.error('Failed to update settings:', error);
        }
    };

    const value = {
        currentUser,
        user: currentUser, // Alias for convenience
        userProfile,
        refreshUserProfile,
        updateSettings,
        signup,
        login,
        loginWithGoogle,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
