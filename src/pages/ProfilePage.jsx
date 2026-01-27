
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api'; // Standard axios wrapper
import { AlertCircle, User, Shield, Share2 } from 'lucide-react';
import { communityService } from '../services/communityService';
import { archetypeService } from '../services/ArchetypeService';
import ArchetypeBadge from '../components/profile/ArchetypeBadge';
import PlaystyleWidget from '../components/profile/PlaystyleWidget';
import { getTierConfig } from '../config/tiers';

const ProfilePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [decks, setDecks] = useState([]);
    const [archetype, setArchetype] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchProfileData = async () => {
        try {
            setLoading(true);
            // 1. Fetch Profile
            const profileData = await api.get(`/api/users/public/${id}`);
            // Service returns data directly, not axios response
            setProfile(profileData);

            const isAllowed = profileData.is_public_library || profileData.relationship?.status === 'accepted' || userProfile?.id === profileData.id;

            // 2. Fetch Public Decks if allowed
            if (isAllowed) {
                // Fetch Decks
                const decksData = await api.get(`/api/decks?userId=${id}`);
                setDecks(decksData);

                // 3. Fetch Collection Sample for Archetype (New)
                // We don't want to download 10k cards. 
                // Either backend provides stats, or we fetch a simplified list.
                // Assuming we can fetch "all" for now OR backend endpoint for analysis.
                // For this prototype, let's fetch the collection if it's not massive, or rely on locally cached if own profile.
                // Or better: Let's fetch the collection via the API we use for the dashboard.
                const colRes = await api.get(`/api/collection?userId=${id}`);
                const analyzed = archetypeService.analyze(colRes.data || colRes); // Handle various response shapes
                setArchetype(analyzed);
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
        <div className="min-h-screen pb-20">
            {/* 1. Cover Banner */}
            <div className="relative h-64 w-full bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-black animate-gradient-slow"></div>
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

                {/* Decorative Circles */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
            </div>

            <div className="max-w-7xl mx-auto px-6 sm:px-8">
                <div className="relative -mt-20 mb-8 flex flex-col md:flex-row items-end md:items-end gap-6">
                    {/* Avatar with Ring */}
                    <div className="relative group">
                        <div className="w-40 h-40 rounded-full p-1 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl z-10 relative">
                            <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-4 border-slate-900">
                                {profile.avatar ? (
                                    <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                ) : (
                                    <User className="w-20 h-20 text-slate-500" />
                                )}
                            </div>
                        </div>
                        {/* Online/Status Indicator (Optional) */}
                        <div className="absolute bottom-4 right-4 w-6 h-6 bg-green-500 border-4 border-slate-900 rounded-full z-20" title="Online"></div>
                    </div>

                    {/* Name & Bio */}
                    <div className="flex-1 pb-4 text-center md:text-left">
                        <div className="flex flex-col md:flex-row items-center md:items-baseline gap-3 mb-2">
                            <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-lg filter">{profile.username}</h1>
                            {profile.is_friend && (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
                                    Friend
                                </span>
                            )}
                            {userProfile?.id === profile.id && (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 backdrop-blur-sm">
                                    You
                                </span>
                            )}
                        </div>

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-slate-400 font-medium">
                            <span className="flex items-center">
                                <Shield className="w-4 h-4 mr-1.5 text-slate-500" />
                                Joined {new Date(profile.joined_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </span>
                            {profile.is_public_library && (
                                <span className="flex items-center text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                                    <Share2 className="w-3.5 h-3.5 mr-1.5" />
                                    Public Library
                                </span>
                            )}
                        </div>

                        {/* Bio */}
                        {profile.bio && (
                            <p className="mt-4 text-slate-300 max-w-2xl text-lg leading-relaxed font-light border-l-2 border-indigo-500/50 pl-4">{profile.bio}</p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 pb-4 justify-center md:justify-end min-w-[200px]">
                        {userProfile?.id === profile.id ? (
                            <button
                                onClick={() => navigate('/settings')}
                                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold border border-slate-600 transition-all hover:shadow-lg flex items-center"
                            >
                                Edit Profile
                            </button>
                        ) : (
                            // Friend Actions
                            <>
                                {(!profile.relationship || !profile.relationship.status) && (
                                    <button
                                        onClick={() => handleFriendAction('request')}
                                        disabled={actionLoading}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <User className="w-4 h-4" /> Add Friend
                                    </button>
                                )}
                                {/* ... (Other friend status buttons typically here, keeping simple for brevity/reuse existing logic if needed in detailed implementation) */}
                            </>
                        )}

                        <button
                            onClick={() => navigate(`/collection?userId=${profile.id}&public=true`)}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                        >
                            View Collection
                        </button>
                    </div>
                </div>

                {/* 2. Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">

                    {/* LEFT COLUMN (Widgets) */}
                    <div className="space-y-8">
                        {/* Archetype Badge */}
                        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-white/5 shadow-xl hover:border-white/10 transition-colors">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Archetype</h3>
                            <div className="flex justify-center py-4">
                                <ArchetypeBadge archetype={archetype} />
                            </div>
                        </div>

                        {/* Playstyle Widget (Sidebar Mode) */}
                        {/* We pass a specific prop or use strictly vertical layout if needed */}
                        {/* For now, just render it. It adapts to width. */}
                    </div>

                    {/* RIGHT COLUMN (Content: Playstyle + Decks) */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Playstyle Widget Focus */}
                        <PlaystyleWidget
                            playstyle={profile.playstyle}
                            isOwnProfile={userProfile?.id === profile.id}
                            onRetake={() => navigate('/onboarding?step=5')}
                            canRegenerate={getTierConfig(userProfile?.subscription_tier).features.customAiPersona}
                        />

                        {/* Public Decks */}
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <span className="w-1 h-8 bg-indigo-500 rounded-full"></span>
                                    Public Decks
                                </h2>
                                <span className="text-slate-400 text-sm font-medium">{decks.length} Decks Shared</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {decks.length > 0 ? decks.map(deck => (
                                    <div
                                        key={deck.id}
                                        onClick={() => navigate(`/decks/${deck.id}`)}
                                        className="group cursor-pointer relative bg-slate-800/80 hover:bg-slate-800 border-2 border-transparent hover:border-indigo-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-2xl overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>

                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">{deck.name}</h3>
                                            </div>

                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="px-2.5 py-1 rounded text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wide">
                                                    {deck.format}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                                                    {deck.card_count} Cards
                                                </span>
                                            </div>

                                            <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-2/3"></div>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-2 py-12 text-center rounded-2xl border-2 border-dashed border-slate-700/50 bg-slate-800/20">
                                        <p className="text-slate-500 italic">No public decks to display.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
