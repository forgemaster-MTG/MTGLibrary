import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { communityService } from '../../services/communityService';
import { useToast } from '../../contexts/ToastContext';

const CommunityWidget = ({ size }) => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [friends, setFriends] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isMedium = size === 'medium';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';
    const isLargePlus = isLarge || isXL;

    useEffect(() => {
        const load = async () => {
            try {
                const data = await communityService.fetchRelationships();
                const accepted = data.filter(r => r.status === 'accepted');
                setFriends(accepted);
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

    const handleManage = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        navigate('/settings/community');
    };

    if (isXS) {
        return (
            <div onClick={handleManage} className="bg-indigo-900/10 border border-indigo-500/20 rounded-3xl h-full flex items-center justify-between px-4 cursor-pointer hover:bg-indigo-500/20 transition-all group overflow-hidden">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Pod Members</span>
                    <span className="text-gray-700">—</span>
                    <span className="text-sm font-black text-white">{friends.length}</span>
                </div>
                <div className="relative flex-shrink-0">
                    <svg className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full border border-gray-950 animate-pulse" />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-gray-900/50 rounded-3xl ${isSmall ? 'p-4' : 'p-6'} border border-gray-800 hover:border-indigo-500/30 transition-all group relative overflow-hidden flex flex-col h-full`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        My Pod
                        {pendingCount > 0 && <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse tracking-normal">{pendingCount} New</span>}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">{friends.length}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Members</span>
                    </div>
                </div>
                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
            </div>

            <div className="flex-grow space-y-3 relative z-10 overflow-hidden">
                {loading ? (
                    <div className="space-y-2">
                        <div className="h-10 bg-gray-800 rounded-xl animate-pulse" />
                    </div>
                ) : isXL ? (
                    <div className="flex gap-8 h-full">
                        {/* Status/Post Area */}
                        <div className="flex-grow flex flex-col justify-center gap-4">
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Post to Pod</div>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="What's brewing?"
                                    className="w-full bg-gray-950/80 border border-white/5 rounded-2xl p-4 pr-12 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                                />
                                <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 rounded-xl text-white hover:bg-indigo-500 transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Avatars Feed */}
                        <div className="flex gap-4 items-center">
                            {friends.slice(0, 5).map((rel, i) => (
                                <div key={rel.id} className="flex flex-col items-center gap-2 group/u cursor-pointer">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-900 border border-indigo-500/30 flex items-center justify-center text-lg font-black text-indigo-200 uppercase group-hover/u:scale-110 group-hover/u:border-indigo-400 transition-all shadow-lg overflow-hidden">
                                            {rel.friend.username?.[0]}
                                            <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/50 to-transparent opacity-0 group-hover/u:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-950" />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 group-hover/u:text-white transition-colors">{rel.friend.username}</span>
                                </div>
                            ))}
                            <div onClick={handleManage} className="w-12 h-12 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center text-gray-600 hover:text-white hover:border-white/20 transition-all cursor-pointer">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </div>
                        </div>
                    </div>
                ) : isLarge ? (
                    <div className="space-y-3">
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Pod Activity</div>
                        {[
                            { user: "Tristin", act: "updated Ghave Deck", time: "1h" },
                            { user: "Sarah", act: "added 3 Rare cards", time: "4h" },
                            { user: "Mike", act: "ranked #1 in Draft", time: "12h" },
                        ].map((a, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-gray-950/50 rounded-xl border border-white/5 text-[11px] group/item hover:bg-gray-800 transition-colors">
                                <div className="w-7 h-7 rounded-lg bg-indigo-900 flex items-center justify-center font-bold text-indigo-300 text-[10px] uppercase shadow-sm">{a.user[0]}</div>
                                <div className="flex-grow">
                                    <span className="font-bold text-gray-200">{a.user}</span> <span className="text-gray-400">{a.act}</span>
                                </div>
                                <span className="text-gray-600 font-mono text-[9px]">{a.time}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {friends.slice(0, isMedium ? 3 : 2).map((rel) => (
                            <div key={rel.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                                <div className="w-7 h-7 rounded-lg bg-indigo-900 flex items-center justify-center text-[10px] font-bold text-indigo-200 uppercase">{rel.friend.username?.[0]}</div>
                                <div className="text-xs font-bold text-gray-300 truncate">{rel.friend.username}</div>
                            </div>
                        ))}
                        {friends.length === 0 && (
                            <p className="text-[10px] text-gray-600 italic text-center py-4">No members in your pod yet.</p>
                        )}
                    </div>
                )}
            </div>

            {!isXL && (
                <button
                    onClick={handleManage}
                    className={`w-full ${isSmall ? 'py-2 text-[10px]' : 'py-3 text-xs'} bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all mt-4`}
                >
                    Manage Pod
                </button>
            )}
        </div>
    );
};

export default CommunityWidget;
