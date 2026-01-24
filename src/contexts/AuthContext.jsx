import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    sendEmailVerification
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [firebaseLoading, setFirebaseLoading] = useState(true);
    const queryClient = useQueryClient();

    // Query for User Profile
    const { data: userProfile = null, refetch: refetchProfile, isLoading: profileLoading } = useQuery({
        queryKey: ['userProfile', currentUser?.uid],
        queryFn: async () => {
            if (!currentUser) return null;
            console.log('[AuthContext] Fetching user profile...');
            return await api.get('/api/users/me');
        },
        enabled: !!currentUser,
        staleTime: 1000 * 10, // 10 seconds (Shortened for achievement consistency)
    });

    // Sign up
    const signup = async (email, password, profileData = {}) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Profile creation logic is usually handled by backend triggers, 
        // but we can optimistic update or wait.
        // For now preventing caching issues by initial refetch delay or manual set?
        // Let's stick to existing logic but invalidating queries.
        if (Object.keys(profileData).length > 0) {
            try {
                // wait for trigger ???
                // Or call API to update if it exists.
                // Existing logic had complex checks. 
                // For simplicity in this caching refactor, we retain core flow but use invalidation.
                // We might need to manually ensure profile exists first.
                await refetchProfile();
                const fresh = await api.get('/api/users/me'); // Direct call to avoid cache delay if critical
                if (fresh?.id) {
                    await api.updateUser(fresh.id, profileData);
                    queryClient.invalidateQueries(['userProfile', userCredential.user.uid]);
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
    const logout = async () => {
        queryClient.setQueryData(['userProfile', currentUser?.uid], null);
        queryClient.removeQueries(['userProfile']);
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

    // Mutations/Updates
    const updateProfileMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            return await api.updateUser(id, data);
        },
        onSuccess: (newData) => {
            queryClient.invalidateQueries(['userProfile', currentUser?.uid]);
            // Optionally optimistic update via setQueryData if API returns the full object
            // queryClient.setQueryData(['userProfile', currentUser?.uid], (old) => ({ ...old, ...data }));
        }
    });

    const updateProfileFields = async (fields) => {
        if (!userProfile?.id) throw new Error("User profile not ready");
        await updateProfileMutation.mutateAsync({ id: userProfile.id, data: fields });
    };

    const updateSettings = async (newSettings) => {
        if (!userProfile?.id) return;
        const updatedSettings = { ...(userProfile.settings || {}), ...newSettings };

        // Optimistic Update
        queryClient.setQueryData(['userProfile', currentUser?.uid], (old) => {
            if (!old) return old;
            return {
                ...old,
                settings: updatedSettings
            };
        });

        try {
            await updateProfileMutation.mutateAsync({ id: userProfile.id, data: { settings: updatedSettings } });
        } catch (error) {
            console.error('Failed to update settings:', error);
            queryClient.invalidateQueries(['userProfile', currentUser?.uid]); // Revert on error
        }
    };

    const uploadProfilePicture = async (file) => {
        if (!currentUser) throw new Error("No user logged in");

        // ... (Existing validation logic) ...
        if (!file.type.startsWith('image/')) throw new Error("File must be an image.");
        if (file.size > 10 * 1024 * 1024) throw new Error("File size must be under 10MB.");

        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const photoDataURL = await base64Promise;

        if (!userProfile?.id) throw new Error("User profile not ready");

        await updateProfileMutation.mutateAsync({ id: userProfile.id, data: { photo_url: photoDataURL } });
        return photoDataURL;
    };


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setFirebaseLoading(false);
        });
        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        user: currentUser,
        userProfile,
        loading: firebaseLoading || (!!currentUser && profileLoading),
        refreshUserProfile: refetchProfile,
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
            {!firebaseLoading && (!currentUser || !profileLoading) && children}
        </AuthContext.Provider>
    );
};
