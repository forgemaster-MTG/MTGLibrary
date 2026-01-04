import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { communityService } from '../../services/communityService';
import { useToast } from '../../contexts/ToastContext';

const CommunityWidget = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [friends, setFriends] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await communityService.fetchRelationships();
                // Get accepted friends
                const accepted = data.filter(r => r.status === 'accepted');
                setFriends(accepted);

                // Get pending
                const pending = data.filter(r => r.status === 'pending' && r.direction === 'incoming');
                setPendingCount(pending.length);
            } catch (err) {
                console.error("Widget fetch failed", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleManage = (e, friendId) => {
        e.preventDefault(); // Prevent widget click
        e.stopPropagation();
        // Navigate to settings with query param to open manage modal if possible, or just to the list
        // Since we don't have deep linking to a specific modal open state easily without complex routing, 
        // we'll go to the tab. The user said "jump out to settings".
        navigate('/settings/community');
    };

    const handleDocs = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // For now, trigger a toast or open a new window if we had a doc URL
        // User asked to "view the documentation created in it". 
        // We'll simulate opening the Key Concepts modal or just alert for now as valid "documentation" isn't a URL yet.
        // Actually, let's make it a small collapsible or tooltip? 
        // The user said "view the documentation created in it", implying the modal I just made has the docs.
        // So clicking this should open the settings > community > manage > modal? 
        // That's hard to target.
        // Let's simplified: Link to settings and say "See Guide in Manage Access"
        addToast("Go to Settings > Community > Manage to view the guide.", "info");
        navigate('/settings/community');
    };

    return (
        <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 hover:border-indigo-500/30 transition-all group relative overflow-hidden flex flex-col h-full">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h3 className="text-gray-400 text-sm font-medium flex items-center gap-2">
                        My Pod
                        {pendingCount > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                                {pendingCount} New
                            </span>
                        )}
                    </h3>
                    <div className="mt-1">
                        <span className="text-3xl font-bold text-white">{friends.length}</span>
                        <span className="text-xs text-gray-500 ml-1">connections</span>
                    </div>
                </div>
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
            </div>

            {/* Friend List (Top 3) */}
            <div className="flex-1 space-y-3 relative z-10">
                {loading ? (
                    <div className="space-y-2">
                        <div className="h-10 bg-gray-800 rounded-xl animate-pulse" />
                        <div className="h-10 bg-gray-800 rounded-xl animate-pulse delay-75" />
                    </div>
                ) : friends.length > 0 ? (
                    <>
                        <div className="space-y-2">
                            {friends.slice(0, 3).map((rel) => (
                                <div key={rel.id} className="group/item flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-200 ring-2 ring-gray-900">
                                            {rel.friend.username?.[0]?.toUpperCase()}
                                        </div>
                                        <div className="text-sm font-bold text-gray-300 truncate max-w-[80px]">
                                            {rel.friend.username}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleManage(e, rel.id)}
                                        className="opacity-0 group-hover/item:opacity-100 p-1.5 text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-all"
                                    >
                                        Manage
                                    </button>
                                </div>
                            ))}
                        </div>

                        {friends.length > 3 && (
                            <Link to="/settings/community" className="block text-center text-xs text-gray-500 hover:text-indigo-400 mt-2 font-medium transition-colors">
                                + {friends.length - 3} others
                            </Link>
                        )}
                    </>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-xs text-gray-500 mb-2">No friends yet.</p>
                        <Link to="/settings/community" className="text-xs font-bold text-indigo-400 hover:text-indigo-300">
                            Add Friends &rarr;
                        </Link>
                    </div>
                )}
            </div>

            {/* Footer / Docs Link */}
            <div className="mt-4 pt-3 border-t border-gray-800 relative z-10 flex justify-between items-center">
                <button
                    onClick={handleDocs}
                    className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-500 hover:text-indigo-400 transition-colors"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    Setup Guide
                </button>

                <Link to="/settings/community" className="text-[10px] uppercase font-bold text-indigo-500 hover:text-indigo-400 transition-colors">
                    All Settings &rarr;
                </Link>
            </div>
        </div>
    );
};

export default CommunityWidget;
