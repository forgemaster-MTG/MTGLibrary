import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import Membership from '../Settings/Membership';

const AccountSettings = () => {
    const { user, userProfile, updateProfileFields, resetPassword, sendVerification } = useAuth();

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [avatar, setAvatar] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    const [saving, setSaving] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);

    useEffect(() => {
        if (userProfile) {
            setFirstName(userProfile.first_name || '');
            setLastName(userProfile.last_name || '');
            setUsername(userProfile.username || '');
            setBio(userProfile.data?.bio || '');
            setAvatar(userProfile.data?.avatar || '');
            setIsPublic(userProfile.is_public_library || userProfile.settings?.is_public_library || false);
        }
    }, [userProfile]);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await updateProfileFields({
                username,
                first_name: firstName,
                last_name: lastName,
                is_public_library: isPublic,
                data: {
                    ...(userProfile?.data || {}),
                    bio,
                    avatar
                }
            });
            alert('Profile saved successfully!');
        } catch (error) {
            console.error('Failed to save profile:', error);
            alert('Error saving profile: ' + (error.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        setResetLoading(true);
        try {
            await resetPassword(user.email);
            alert('Password reset email sent!');
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setResetLoading(false);
        }
    };

    const handleVerifyEmail = async () => {
        setVerifyLoading(true);
        try {
            await sendVerification();
            alert('Verification email sent!');
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setVerifyLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-6">
                Account Settings
            </h1>

            {/* Profile Section */}
            <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-white">Profile Information</h2>
                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className={`bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-primary-500/20 transition-all ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">First Name</label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">Last Name</label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm text-gray-400 block">Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username..."
                        className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                </div>

                <div className="pt-6 border-t border-gray-700 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Public Appearance</h3>

                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div>
                            <p className="font-medium text-gray-200">Public Library Access</p>
                            <p className="text-sm text-gray-400">Allow others to view your collection and decks via your profile.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPublic}
                                onChange={(e) => setIsPublic(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">Avatar URL</label>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={avatar}
                                    onChange={(e) => setAvatar(e.target.value)}
                                    placeholder="https://example.com/avatar.jpg"
                                    className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 border border-gray-600">
                                {avatar ? (
                                    <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">?</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Tell us about yourself..."
                            rows={3}
                            className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                        />
                    </div>
                </div>
            </section>

            {/* Membership Section */}
            <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                <Membership />
            </section>

            {/* Security Section */}
            <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg space-y-6">
                <h2 className="text-xl font-semibold text-white">Security & Login</h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div>
                            <p className="font-medium text-gray-200">Email Address</p>
                            <p className="text-sm text-gray-400">{user?.email}</p>
                            {user && !user.emailVerified && (
                                <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-full border border-yellow-500/30 mt-1 inline-block">
                                    Unverified
                                </span>
                            )}
                            {user && user.emailVerified && (
                                <span className="text-[10px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded-full border border-green-500/30 mt-1 inline-block">
                                    Verified
                                </span>
                            )}
                        </div>
                        {!user?.emailVerified && (
                            <button
                                onClick={handleVerifyEmail}
                                disabled={verifyLoading}
                                className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
                            >
                                {verifyLoading ? 'Sending...' : 'Send Verification'}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div>
                            <p className="font-medium text-gray-200">Password</p>
                            <p className="text-sm text-gray-400">Change your account password</p>
                        </div>
                        <button
                            onClick={handlePasswordReset}
                            disabled={resetLoading}
                            className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium disabled:opacity-50"
                        >
                            {resetLoading ? 'Sending...' : 'Reset Password'}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AccountSettings;
