import React, { useState, useEffect } from 'react';
import { Swords, Crown } from 'lucide-react';
import { api } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

const SocialFeed = () => {
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFeed = async () => {
            try {
                const res = await api.get('/api/social/feed');
                setFeed(res);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadFeed();
    }, []);

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-gray-800/50 rounded-xl animate-pulse"></div>
                ))}
            </div>
        );
    }

    if (feed.length === 0) {
        return (
            <div className="text-center py-16 max-w-lg mx-auto">
                <div className="inline-flex p-4 rounded-full bg-gray-800 mb-4">
                    <Swords size={48} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-300 mb-2">No recent activity</h3>
                <p className="text-gray-500">
                    Matches played by you and your friends will appear here.
                    <br />Add friends to populate your feed!
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-4">
            {feed.map((match) => (
                <div key={match.id} className="bg-gray-800/40 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2 text-primary-400">
                            <Swords size={20} />
                            <span className="font-bold text-sm uppercase tracking-wide">Commander Match</span>
                        </div>
                        <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(match.date), { addSuffix: true })}
                        </span>
                    </div>

                    {/* Participants Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {match.participants.map(p => (
                            <div
                                key={p.userId}
                                className={`
                    flex items-center justify-between p-3 rounded-lg border 
                    ${p.outcome === 'win'
                                        ? 'bg-amber-500/10 border-amber-500/30'
                                        : 'bg-gray-900/50 border-gray-800'}
                  `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs
                        ${p.outcome === 'win' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-gray-700 text-gray-300'}
                    `}>
                                        {p.username[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${p.outcome === 'win' ? 'text-amber-200' : 'text-gray-300'}`}>
                                            {p.username}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate max-w-[120px]">
                                            {p.deck || 'Unknown Deck'}
                                        </div>
                                    </div>
                                </div>

                                {p.outcome === 'win' && (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 rounded text-amber-400 text-[10px] font-bold uppercase border border-amber-500/30">
                                        <Crown size={12} /> Winner
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SocialFeed;
