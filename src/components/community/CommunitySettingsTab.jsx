import React, { useState, useEffect } from 'react';
import { communityService } from '../../services/communityService';
import { useAuth } from '../../contexts/AuthContext';
import ConnectionPermissionsModal from '../modals/ConnectionPermissionsModal';
import UsernameRequiredModal from '../modals/UsernameRequiredModal';
import AccessControlGuideModal from '../modals/AccessControlGuideModal';
import SiteQRModal from './SiteQRModal';

const CommunitySettingsTab = () => {
    const { user, userProfile } = useAuth();
    const [relationships, setRelationships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [addEmail, setAddEmail] = useState('');
    const [addType, setAddType] = useState('pod'); // 'pod' or 'friend'
    const [addLoading, setAddLoading] = useState(false);
    const [addMessage, setAddMessage] = useState(null);
    const [qrOpen, setQrOpen] = useState(false);

    const referralUrl = `https://mtg-forge.com/?ref=${userProfile?.username || user.uid}`;

    // Permission Modal State
    const [selectedConnection, setSelectedConnection] = useState(null);
    const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);

    // Guide Modal State
    const [isGuideOpen, setIsGuideOpen] = useState(false);

    // Username Modal State
    const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await communityService.fetchRelationships();
            setRelationships(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load connections.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSendRequest = async (e) => {
        e.preventDefault();

        // Enforce Username
        if (!userProfile?.username) {
            setIsUsernameModalOpen(true);
            return;
        }

        setAddLoading(true);
        setAddMessage(null);
        try {
            await communityService.sendRequest(addEmail, addType);
            setAddMessage({ type: 'success', text: `Invite sent to ${addEmail}!` });
            setAddEmail('');
            fetchData();
        } catch (err) {
            setAddMessage({ type: 'error', text: err.response?.data?.error || 'Failed to send request.' });
        } finally {
            setAddLoading(false);
        }
    };

    const handleRespond = async (id, status) => {
        // Enforce Username for accepting too
        if (!userProfile?.username) {
            setIsUsernameModalOpen(true);
            return;
        }

        try {
            await communityService.respondToRequest(id, status);
            fetchData();
        } catch (err) {
            console.error(err);
            setError('Failed to update request.');
        }
    };

    const pendingRequests = relationships.filter(r => r.status === 'pending');
    const incomingRequests = pendingRequests.filter(r => r.direction === 'incoming');
    const outgoingRequests = pendingRequests.filter(r => r.direction === 'outgoing');
    const friends = relationships.filter(r => r.status === 'accepted');

    return (
        <div className="space-y-8 animate-fade-in relative z-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-800 pb-6 relative">
                <div>
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2">My Pod</h2>
                    <p className="text-gray-400 text-sm max-w-xl leading-relaxed">
                        Connect with trusted friends to view their decks, share collections, and collaborate on brews.
                    </p>
                </div>
                <button
                    onClick={() => setIsGuideOpen(true)}
                    className="flex items-center gap-2 text-indigo-400 hover:text-white transition-colors text-sm font-bold bg-indigo-900/20 hover:bg-indigo-900/40 px-4 py-2 rounded-lg border border-indigo-500/30"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    How it Works
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
            ) : friends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                /* Hero Empty State */
                <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-3xl border border-gray-800 p-8 md:p-12 text-center animate-fade-in-up shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    <div className="max-w-md mx-auto relative z-10">
                        <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl ring-1 ring-inset ring-indigo-500/20">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <h2 className="text-2xl font-black text-white mb-3">Start Your Pod</h2>
                        <p className="text-gray-400 mb-8 leading-relaxed">
                            Magic is better with friends. Invite someone to your Pod to start sharing decks and combining collections.
                        </p>

                        <form onSubmit={handleSendRequest} className="space-y-6">
                            <div className="flex p-1 bg-black/40 border border-gray-700 rounded-xl max-w-xs mx-auto">
                                <button
                                    type="button"
                                    onClick={() => setAddType('pod')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${addType === 'pod' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Pod Invite
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddType('friend')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${addType === 'friend' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Social Friend
                                </button>
                            </div>

                            <div className="space-y-4">
                                <input
                                    type="email"
                                    required
                                    placeholder="Enter friend's email address..."
                                    value={addEmail}
                                    onChange={(e) => setAddEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 text-white px-5 py-4 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-center placeholder-gray-600 shadow-inner"
                                />
                                <button
                                    type="submit"
                                    disabled={addLoading}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-indigo-900/20 transform hover:-translate-y-1"
                                >
                                    {addLoading ? 'Sending Invite...' : addType === 'pod' ? 'Send Pod Invitation' : 'Send Friend Invite'}
                                </button>
                            </div>

                            {addMessage && (
                                <div className={`text-sm font-medium mt-2 ${addMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                    {addMessage.text}
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            ) : (
                /* Connected State with Sidebar */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Friends Grid */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-gray-900/30 rounded-3xl border border-gray-800 p-8 shadow-xl">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                                <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-2 rounded-lg shadow-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                </span>
                                Active Connections
                            </h3>

                            {friends.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {friends.map(friend => (
                                        <div key={friend.id} className="relative group bg-gray-800/40 p-5 rounded-2xl border border-gray-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:bg-gray-800/60 hover:shadow-xl hover:shadow-indigo-900/10">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white font-black text-2xl shadow-lg ring-2 ring-gray-900">
                                                    {friend.friend.username?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-white text-lg truncate group-hover:text-indigo-300 transition-colors uppercase">{friend.friend.username}</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded ${friend.type === 'friend' ? 'bg-purple-900/30 text-purple-400 border border-purple-800/50' : 'bg-indigo-900/30 text-indigo-400 border border-indigo-800/50'}`}>
                                                            {friend.type === 'friend' ? 'Friend' : 'Pod'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                                            {friend.type === 'friend' ? 'Social Connect' : 'Full Access'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedConnection(friend);
                                                        setIsPermissionsOpen(true);
                                                    }}
                                                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white py-2 rounded-lg text-xs font-bold transition-colors uppercase tracking-wider border border-white/5"
                                                >
                                                    Manage
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (window.confirm(`Are you sure you want to remove ${friend.friend.username} from your Pod?`)) {
                                                            try {
                                                                await communityService.deleteRelationship(friend.id);
                                                                setRelationships(prev => prev.filter(r => r.id !== friend.id));
                                                            } catch (e) {
                                                                console.error(e);
                                                                alert("Failed to remove");
                                                            }
                                                        }
                                                    }}
                                                    className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors border border-red-500/10"
                                                    title="Remove Connection"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500 italic opacity-50">
                                    No active connections. Check your pending requests!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="space-y-6">
                        {/* Smaller Add Friend for Sidebar */}
                        <div className="bg-gray-900/30 rounded-2xl border border-gray-800 p-6">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Add to Pod</h3>
                            <div className="flex p-1 bg-black/40 border border-gray-700 rounded-xl mb-4">
                                <button
                                    type="button"
                                    onClick={() => setAddType('pod')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${addType === 'pod' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Pod
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddType('friend')}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${addType === 'friend' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Friend
                                </button>
                            </div>
                            <form onSubmit={handleSendRequest} className="space-y-3">
                                <input
                                    type="email"
                                    required
                                    placeholder="friend@example.com"
                                    value={addEmail}
                                    onChange={(e) => setAddEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 text-sm transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={addLoading}
                                    className={`w-full ${addType === 'friend' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg text-sm flex items-center justify-center gap-2`}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Invite {addType === 'pod' ? 'to Pod' : 'as Friend'}
                                </button>
                                {addMessage && (
                                    <div className={`text-xs text-center ${addMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                        {addMessage.text}
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Referral Link & Social Sharing */}
                        <div className="bg-gradient-to-br from-indigo-900/10 to-purple-900/10 rounded-2xl border border-indigo-500/20 p-6 space-y-4">
                            <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 uppercase tracking-wider mb-2">Referral & Sharing</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Spread the word about MTG Forge. Anyone who joins using your unique link will be automatically connected as a Social Friend.
                            </p>

                            <div className="space-y-2">
                                <div className="bg-black/40 border border-gray-700/50 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-[10px] text-indigo-400 font-mono truncate flex-1 leading-none select-all pt-1">https://mtg-forge.com/?ref=${userProfile?.username || user.uid}</span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`https://mtg-forge.com/?ref=${userProfile?.username || user.uid}`);
                                            alert('Referral link copied!');
                                        }}
                                        className="p-1.5 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => window.open(`mailto:?subject=Join me on MTG Forge&body=Hey, I've been using this awesome MTG collection manager and deck builder. Check it out: https://mtg-forge.com/?ref=${userProfile?.username || user.uid}`)}
                                        className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-bold transition-all border border-gray-700"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        Email
                                    </button>
                                    <button
                                        onClick={() => setQrOpen(true)}
                                        className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-bold transition-all border border-gray-700"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1l-3 3h2v5h2V8h2l-3-3V4h-2zm-6 8v1h12v-1H6zm0 3v1h12v-1H6z" /></svg>
                                        QR Code
                                    </button>
                                </div>
                            </div>
                        </div>

                        <SiteQRModal
                            isOpen={qrOpen}
                            onClose={() => setQrOpen(false)}
                            referralUrl={referralUrl}
                            username={userProfile?.username || 'Hunter'}
                        />

                        {/* Incoming Requests */}
                        {incomingRequests.length > 0 && (
                            <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-2xl border border-indigo-500/30 p-6 animate-pulse-border">
                                <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                                    </span>
                                    Pending Requests
                                </h3>
                                <div className="space-y-3">
                                    {incomingRequests.map(req => (
                                        <div key={req.id} className="bg-gray-900/80 p-3 rounded-xl border border-indigo-500/20 shadow-lg">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                                    {req.friend.username?.[0]?.toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-white text-sm truncate">{req.friend.username}</div>
                                                    <div className="text-xs text-indigo-300 truncate">wants to join your Pod</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleRespond(req.id, 'accepted')}
                                                    className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-md"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => handleRespond(req.id, 'blocked')}
                                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-bold py-2 rounded-lg transition-colors border border-gray-700"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Outgoing Requests */}
                        {outgoingRequests.length > 0 && (
                            <div className="bg-gray-900/30 rounded-2xl border border-gray-800 p-6 opacity-60 hover:opacity-100 transition-opacity">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Pending Invites</h3>
                                <div className="space-y-3">
                                    {outgoingRequests.map(req => (
                                        <div key={req.id} className="flex items-center gap-3 text-sm bg-gray-900 p-3 rounded-lg border border-gray-800">
                                            <div className="w-2 h-2 rounded-full bg-yellow-500/50 animate-pulse" />
                                            <span className="text-gray-300 truncate flex-1">{req.friend.email}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <ConnectionPermissionsModal
                isOpen={isPermissionsOpen}
                onClose={() => setIsPermissionsOpen(false)}
                connection={selectedConnection}
                currentUser={user}
            />

            <UsernameRequiredModal
                isOpen={isUsernameModalOpen}
                onClose={() => setIsUsernameModalOpen(false)}
                onSuccess={() => {/* Maybe trigger request again? For now just stay on page */ }}
            />

            <AccessControlGuideModal
                isOpen={isGuideOpen}
                onClose={() => setIsGuideOpen(false)}
            />
        </div>
    );
};

export default CommunitySettingsTab;
