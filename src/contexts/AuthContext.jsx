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
import { getTierConfig } from '../config/tiers';

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
        staleTime: 1000 * 10,
    });

    // Valid only for public pricing (no auth needed)
    const { data: pricingConfig = null, isLoading: pricingLoading } = useQuery({
        queryKey: ['pricingConfig'],
        queryFn: async () => {
            try {
                const res = await api.get('/api/pricing');
                return res.config || res.data?.config || null;
            } catch (err) {
                console.warn('Failed to fetch pricing config', err);
                return null;
            }
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
    });

    // Sign up
    const signup = async (email, password, profileData = {}) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Profile creation logic is usually handled by backend triggers, 
        // but we can optimistic update or wait.
        // For now preventing caching issues by initial refetch delay or manual set?
        // Let's stick to existing logic but invalidating queries.
        // Merge profileData with referral code if present
        const referralCode = localStorage.getItem('mtg_forge_ref');
        const finalProfileData = { ...profileData };
        if (referralCode) {
            console.log('[AuthContext] Applying referral code:', referralCode);
            finalProfileData.referral_code = referralCode;
        }

        if (Object.keys(finalProfileData).length > 0) {
            try {
                // wait for trigger ???
                // Or call API to update if it exists.
                // Existing logic had complex checks. 
                // For simplicity in this caching refactor, we retain core flow but use invalidation.
                // We might need to manually ensure profile exists first.
                const { data: fresh } = await refetchProfile();
                if (fresh?.id) {
                    await api.updateUser(fresh.id, finalProfileData);
                    queryClient.invalidateQueries(['userProfile', userCredential.user.uid]);

                    // Clear referral after successful use
                    if (referralCode) localStorage.removeItem('mtg_forge_ref');
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

    // Listen for Credit Updates from AI Service
    useEffect(() => {
        const handleCreditUpdate = (e) => {
            if (!currentUser?.uid) return;
            const { credits_monthly, credits_topup } = e.detail;

            queryClient.setQueryData(['userProfile', currentUser.uid], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    credits_monthly: credits_monthly !== undefined ? credits_monthly : old.credits_monthly,
                    credits_topup: credits_topup !== undefined ? credits_topup : old.credits_topup,
                    ai_credits: ((credits_monthly !== undefined ? credits_monthly : (old.credits_monthly || 0)) +
                        (credits_topup !== undefined ? credits_topup : (old.credits_topup || 0)))
                };
            });
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('auth:update-credits', handleCreditUpdate);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('auth:update-credits', handleCreditUpdate);
            }
        };
    }, [currentUser, queryClient]);

    // Compute Effective Profile (Handle Trial Expiration & Feature Bypass)
    const effectiveUserProfile = React.useMemo(() => {
        if (!userProfile) return null;
        const profile = { ...userProfile };

        // Trial Expiration Logic
        if (profile.subscription_status === 'trial' && profile.trial_end_date) {
            const endDate = new Date(profile.trial_end_date);
            const now = new Date();
            // Calculate distinct days left (ceiling to round up partial days)
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

            if (daysLeft <= 0) {
                profile.subscription_tier = 'free'; // Downgrade to free
                profile.is_trial_expired = true;
            }
        }

        // Attach Tier Config with Override Support
        profile.tierConfig = getTierConfig(
            profile.subscription_tier,
            profile.settings?.permissions || []
        );

        return profile;
    }, [userProfile]);

    const value = {
        currentUser,
        user: currentUser,
        userProfile: effectiveUserProfile,
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
        updateProfileFields,
        uploadProfilePicture,
        pricingConfig
    };

    return (
        <AuthContext.Provider value={value}>
            {(firebaseLoading || (!!currentUser && profileLoading)) ? (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    background: 'radial-gradient(circle at center, #2b0505 0%, #000000 100%)',
                    color: '#ff4d00',
                    fontFamily: 'system-ui, sans-serif',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    textShadow: '0 0 20px rgba(255, 77, 0, 0.5)'
                }}>
                    Igniting The Forge...
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
