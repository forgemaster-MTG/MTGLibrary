import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const UsernamePrompt = () => {
    const { userProfile, updateProfileFields } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Only show if the profile is loaded and the username is exactly "Anonymous" (or null/empty)
        if (userProfile && (userProfile.username === 'Anonymous' || !userProfile.username)) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [userProfile]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await updateProfileFields({ username });
            setIsOpen(false);
        } catch (err) {
            console.error('Failed to update username:', err);
            setError(err.response?.data?.error || 'Failed to update username. It might be taken.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-gray-900 border border-primary-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
                {/* Background Glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary-600/20 rounded-full blur-3xl group-hover:bg-primary-600/30 transition-colors" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-600/10 rounded-full blur-3xl group-hover:bg-orange-600/20 transition-colors" />

                <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center text-2xl border border-primary-500/40">
                            🎭
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Claim Your Legend</h2>
                            <p className="text-gray-400 text-sm">Choose a username to replace 'Anonymous'</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-primary-400 mb-2 ml-1">
                                New Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                                placeholder="Ancient_Wizard_99"
                                className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                                autoFocus
                                disabled={loading}
                            />
                            {error && (
                                <p className="text-red-400 text-xs mt-2 ml-1 animate-pulse">
                                    ⚠️ {error}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !username}
                            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:hover:bg-primary-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary-500/20 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Set Username'
                            )}
                        </button>
                    </form>

                    <p className="text-center text-[10px] text-gray-500 mt-6 uppercase tracking-widest">
                        Forge Your Identity
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UsernamePrompt;
