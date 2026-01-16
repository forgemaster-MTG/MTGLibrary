
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api'; // Standard axios wrapper
import { AlertCircle, User, Shield, Share2 } from 'lucide-react';
import { communityService } from '../services/communityService';

const ProfilePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [decks, setDecks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchProfileData = async () => {
        try {
            setLoading(true);
            // 1. Fetch Profile
            const profileRes = await api.get(`/users/public/${id}`);
            setProfile(profileRes.data);

            // 2. Fetch Public Decks if allowed
            if (profileRes.data.is_public_library || profileRes.data.relationship?.status === 'accepted') {
                const decksRes = await api.get(`/api/decks?userId=${id}`);
                setDecks(decksRes.data);
            }
        } catch (err) {
            console.error("Failed to fetch profile", err);
            if (err.response?.status === 403) {
                setError("This profile is private.");
            } else if (err.response?.status === 404) {
                setError("User not found.");
            } else {
                setError("Failed to load profile.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchProfileData();
    }, [id]);

    const handleFriendAction = async (action) => {
        if (!profile) return;
        setActionLoading(true);
        try {
            if (action === 'request') {
                await communityService.sendRequest({ targetId: profile.id }, 'friend');
            } else if (action === 'cancel' || action === 'unfriend') {
                if (profile.relationship?.id) {
                    await communityService.deleteRelationship(profile.relationship.id);
                }
            } else if (action === 'accept') {
                if (profile.relationship?.id) {
                    await communityService.respondToRequest(profile.relationship.id, 'accepted');
                }
            }
            // Refresh
            await fetchProfileData();
        } catch (err) {
            console.error("Friend action failed", err);
            alert("Action failed: " + (err.response?.data?.error || "Unknown error"));
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500 mr-3"></div>
                Loading Profile...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center px-4">
                <div className="bg-red-500/10 p-4 rounded-full mb-4">
                    <Shield className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-slate-400 mb-6 max-w-md">{error}</p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header / Banner */}
            <div className="relative bg-slate-800 rounded-2xl p-8 border border-slate-700/50 overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-500 via-slate-900 to-slate-900 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start md:space-x-8">
                    {/* Avatar */}
                    <div className="w-32 h-32 rounded-full bg-slate-700 flex items-center justify-center border-4 border-slate-800 shadow-xl mb-4 md:mb-0">
                        {profile.avatar ? (
                            <img src={profile.avatar} alt={profile.username} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <User className="w-16 h-16 text-slate-500" />
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="flex items-center justify-center md:justify-start space-x-3">
                            <h1 className="text-3xl font-bold text-white tracking-tight">{profile.username}</h1>
                            {profile.is_friend && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    Friend
                                </span>
                            )}
                            {userProfile?.id === profile.id && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    You
                                </span>
                            )}
                        </div>

                        {profile.bio && (
                            <p className="text-slate-300 max-w-2xl">{profile.bio}</p>
                        )}

                        <div className="flex items-center justify-center md:justify-start space-x-6 text-sm text-slate-400 pt-2">
                            <span>Joined {new Date(profile.joined_at).toLocaleDateString()}</span>
                            {profile.is_public_library && (
                                <span className="flex items-center text-amber-400">
                                    <Share2 className="w-3 h-3 mr-1.5" />
                                    Public Library
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 md:mt-0 flex flex-wrap gap-3 justify-center md:justify-end">
                        {userProfile?.id !== profile.id && (
                            <>
                                {(!profile.relationship || !profile.relationship.status) && (
                                    <button
                                        onClick={() => handleFriendAction('request')}
                                        disabled={actionLoading}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-indigo-900/20 transition-all flex items-center disabled:opacity-50"
                                    >
                                        <User className="w-4 h-4 mr-2" />
                                        Add Friend
                                    </button>
                                )}
                                {profile.relationship?.status === 'pending' && profile.relationship.direction === 'outgoing' && (
                                    <button
                                        onClick={() => handleFriendAction('cancel')}
                                        disabled={actionLoading}
                                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-5 py-2.5 rounded-lg font-medium transition-all flex items-center disabled:opacity-50"
                                    >
                                        Cancel Request
                                    </button>
                                )}
                                {profile.relationship?.status === 'pending' && profile.relationship.direction === 'incoming' && (
                                    <button
                                        onClick={() => handleFriendAction('accept')}
                                        disabled={actionLoading}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-emerald-900/20 transition-all flex items-center disabled:opacity-50"
                                    >
                                        Accept Request
                                    </button>
                                )}
                                {profile.relationship?.status === 'accepted' && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Unfriend ${profile.username}?`)) handleFriendAction('unfriend');
                                        }}
                                        disabled={actionLoading}
                                        className="bg-slate-700 hover:bg-red-900/40 hover:text-red-400 text-slate-300 px-5 py-2.5 rounded-lg font-medium transition-all flex items-center disabled:opacity-50 border border-transparent hover:border-red-900/50"
                                    >
                                        Unfriend
                                    </button>
                                )}
                            </>
                        )}

                        <button
                            onClick={() => navigate(`/collection?userId=${profile.id}&public=true`)}
                            className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-primary-900/20 transition-all flex items-center"
                        >
                            View Collection
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Tabs (Decks vs Binders) could go here later */}
            <div className="space-y-6">
                <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-bold text-white">Public Library</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div
                        onClick={() => navigate(`/collection?userId=${profile.id}&public=true`)}
                        className="group cursor-pointer bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-primary-500/50 rounded-xl p-6 transition-all h-full flex flex-col justify-center"
                    >
                        <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-primary-400 transition-colors uppercase tracking-tight">Browse Collection</h3>
                        <p className="text-slate-400 text-sm">View all cards available for trade or display.</p>
                    </div>

                    {decks.map(deck => (
                        <div
                            key={deck.id}
                            onClick={() => navigate(`/decks/${deck.id}`)}
                            className="group cursor-pointer bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-xl p-6 transition-all"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors truncate pr-2">{deck.name}</h3>
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider border border-indigo-500/30">
                                    {deck.format}
                                </span>
                            </div>
                            <p className="text-slate-400 text-sm">{deck.card_count} Cards</p>
                        </div>
                    ))}

                    {decks.length === 0 && (
                        <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-6 flex items-center justify-center">
                            <p className="text-slate-600 text-sm italic">No public decks shared.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
