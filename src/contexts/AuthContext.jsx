import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile,
    sendPasswordResetEmail,
    sendEmailVerification
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../lib/firebase';

import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Sign up
    const signup = async (email, password, profileData = {}) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // If we have profile data, update it in our DB immediately
        if (Object.keys(profileData).length > 0) {
            try {
                // We need to wait a moment for the user to be created in DB via middleware if it's the first time
                // Or we can manually trigger a creation/update here.
                // The middleware handles creation on the next request.
                // Let's call refreshUserProfile to ensure the user exists in DB.
                await refreshUserProfile();
                // Then update with profile data
                // We need the numeric ID from the profile
                const freshProfile = await api.get('/api/me');
                if (freshProfile?.id) {
                    await api.updateUser(freshProfile.id, profileData);
                    await refreshUserProfile();
                }
            } catch (err) {
                console.error("Failed to save profile data during signup", err);
            }
        }
        return userCredential;
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

    // Password Reset
    const resetPassword = (email) => {
        return sendPasswordResetEmail(auth, email);
    };

    // Send Verification Email
    const sendVerification = () => {
        if (!auth.currentUser) throw new Error("No user logged in");
        return sendEmailVerification(auth.currentUser);
    };

    // Update Profile Fields
    const updateProfileFields = async (fields) => {
        if (!userProfile?.id) throw new Error("User profile not ready");
        try {
            await api.updateUser(userProfile.id, fields);
            await refreshUserProfile();
        } catch (error) {
            console.error("Failed to update profile fields:", error);
            throw error;
        }
    };

    // Upload Profile Picture
    const uploadProfilePicture = async (file) => {
        console.log('[AuthContext] uploadProfilePicture called', { file: file.name, currentUser: !!currentUser });

        if (!currentUser) {
            console.error('[AuthContext] No user logged in');
            throw new Error("No user logged in");
        }

        // 1. Safety Checks
        if (!file.type.startsWith('image/')) {
            console.error('[AuthContext] Invalid file type:', file.type);
            throw new Error("File must be an image.");
        }
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            console.error('[AuthContext] File too large:', file.size);
            throw new Error("File size must be under 10MB.");
        }

        try {
            console.log('[AuthContext] Converting image to base64...');

            // 2. Convert image to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const photoDataURL = await base64Promise;
            console.log('[AuthContext] Image converted to base64, size:', photoDataURL.length);

            // 3. Save to database
            console.log('[AuthContext] Saving to database...');

            if (!userProfile?.id) {
                throw new Error("User profile not ready");
            }
            await api.updateUser(userProfile.id, { photo_url: photoDataURL });
            console.log('[AuthContext] Saved to database');

            await refreshUserProfile();
            console.log('[AuthContext] Profile refreshed');

            return photoDataURL;

        } catch (error) {
            console.error("[AuthContext] Error uploading profile picture:", error);
            console.error("[AuthContext] Error code:", error.code);
            console.error("[AuthContext] Error message:", error.message);
            throw error;
        }
    };

    const refreshUserProfile = async () => {
        if (!auth.currentUser) return;
        try {
            const profile = await api.get('/api/me'); // Calls /api/me which returns { id, email, data, settings? }
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
        console.log('[AuthContext] Updating settings:', updatedSettings);
        try {
            const resp = await api.updateUser(userProfile.id, { settings: updatedSettings });
            if (resp) {
                setUserProfile(prev => ({ ...prev, settings: updatedSettings }));
            }
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
        logout,
        resetPassword,
        sendVerification,
        updateProfileFields,
        uploadProfilePicture
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
