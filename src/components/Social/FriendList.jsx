import React, { useState, useEffect } from 'react';
import {
    Search,
    UserPlus,
    Check,
    X,
    User
} from 'lucide-react';
import { api } from '../../services/api';

const FriendList = () => {
    const [data, setData] = useState({ friends: [], pending_sent: [], pending_received: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        try {
            const res = await api.get('/api/friends');
            setData(res);
        } catch (err) {
            console.error(err);
            setError('Failed to load friends');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (searchQuery.length < 3) return;
        try {
            const res = await api.get(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`);
            const existingIds = new Set([
                ...data.friends.map(f => f.id),
                ...data.pending_sent.map(f => f.id),
                ...data.pending_received.map(f => f.id)
            ]);

            setSearchResults(res.filter(u => !existingIds.has(u.id)));
        } catch (err) {
            console.error(err);
        }
    };

    const sendRequest = async (targetId) => {
        try {
            await api.post('/api/friends/request', { target_id: targetId });
            setSearchResults(prev => prev.filter(u => u.id !== targetId));
            fetchFriends();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to send request');
        }
    };

    const respondRequest = async (friendshipId, action) => {
        try {
            await api.post('/api/friends/respond', { friendship_id: friendshipId, action });
            fetchFriends();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Search Section */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">Find Friends</h3>
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search by username..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
                    >
                        Search
                    </button>
                </div>

                {searchResults.length > 0 && (
                    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                        {searchResults.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold">
                                        {user.username[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">{user.username}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => sendRequest(user.id)}
                                    className="flex items-center gap-2 px-3 py-1.5 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 rounded-lg text-sm transition-colors"
                                >
                                    <UserPlus size={16} />
                                    Add
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pending Requests */}
            {(data.pending_received.length > 0 || data.pending_sent.length > 0) && (
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-bold text-white mb-4">Pending Requests</h3>
                    <div className="space-y-2">
                        {data.pending_received.map(req => (
                            <div key={req.id} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold border border-indigo-500/30">
                                        {req.username[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">{req.username}</div>
                                        <div className="text-xs text-gray-400">wants to be your friend</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => respondRequest(req.friendship_id, 'accept')}
                                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors"
                                    >
                                        <Check size={16} /> Accept
                                    </button>
                                    <button
                                        onClick={() => respondRequest(req.friendship_id, 'reject')}
                                        className="bg-gray-700 hover:bg-red-600/80 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors"
                                    >
                                        <X size={16} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}

                        {data.pending_sent.map(req => (
                            <div key={req.id} className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg border border-gray-800 opacity-75">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 font-bold">
                                        {req.username[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-gray-300 font-medium">{req.username}</div>
                                        <div className="text-xs text-gray-500">Request sent</div>
                                    </div>
                                </div>
                                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-500 font-medium border border-gray-700">
                                    Pending
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Friend List */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">My Friends ({data.friends.length})</h3>
                {data.friends.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-900/50 rounded-lg border border-dashed border-gray-700">
                        <UserPlus size={48} className="mx-auto mb-4 opacity-20" />
                        <p>You haven't added any friends yet.</p>
                        <p className="text-sm">Search above to connect!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {data.friends.map(friend => (
                            <div key={friend.id} className="flex items-center p-3 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors group">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 mr-4">
                                    {friend.username[0].toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-bold">{friend.username}</span>
                                        {friend.lfg_status && (
                                            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold uppercase rounded border border-green-500/30">
                                                LFG
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500">{friend.email}</div>
                                </div>

                                {/* Actions could go here */}
                                <button className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-red-400 transition-all">
                                    {/* Unfriend/Block icons */}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FriendList;
