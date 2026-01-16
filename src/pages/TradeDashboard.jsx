import React, { useState, useEffect } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { tradeService } from '../services/TradeService';
import CardSkeleton from '../components/CardSkeleton';
import { Link } from 'react-router-dom';

const TradeDashboard = () => {
    const { currentUser, userProfile } = useAuth();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!userProfile?.id) return;

        const fetchMatches = async () => {
            setLoading(true);
            try {
                const results = await tradeService.findMatches(userProfile.id);
                setMatches(results);
            } catch (err) {
                console.error("Trade fetch error:", err);
                setError("Failed to load trade matches.");
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
    }, [userProfile]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="p-2 bg-indigo-500/10 rounded-xl">
                            <span className="text-3xl">⚔️</span>
                        </span>
                        The Armory
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">Automated Trade Matches with your Pod</p>
                </div>

                {/* Stats / Controls */}
                <div className="flex gap-4">
                    <div className="bg-gray-800 rounded-xl px-4 py-2 border border-gray-700 text-center">
                        <div className="text-xs text-gray-500 uppercase font-bold">Matches</div>
                        <div className="text-xl font-bold text-white">{matches.length}</div>
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-32 bg-gray-800 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            ) : error ? (
                <div className="bg-red-900/30 border border-red-500/50 p-6 rounded-xl text-center text-red-300">
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-900/50 hover:bg-red-800 rounded-lg text-white text-sm">Retry</button>
                </div>
            ) : matches.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
                    <div className="text-6xl mb-4">🤷‍♂️</div>
                    <h2 className="text-2xl font-bold text-white mb-2">No Matches Found</h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                        We couldn't find anyone in your Pod who has cards from your Wishlist in their Public Binders.
                    </p>
                    <div className="mt-8 flex justify-center gap-4">
                        <Link to="/binders" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold">
                            Update Binders
                        </Link>
                        <Link to="/wishlist" className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">
                            Update Wishlist
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.map((match, idx) => (
                        <div key={`${match.cardId}-${idx}`} className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-indigo-500/50 rounded-xl p-4 flex gap-4 transition-all group relative overflow-hidden">
                            {/* Background accent */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

                            {/* Card Image */}
                            <div className="relative w-24 min-w-[6rem] aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-lg border border-black/50">
                                {match.image ? (
                                    <img src={match.image} alt={match.cardName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-900 flex items-center justify-center text-xs text-gray-500">No Img</div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex flex-col justify-between flex-1 min-w-0 z-10">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-lg font-bold text-white truncate">{match.cardName}</h3>
                                    </div>
                                    <div className="text-xs text-indigo-400 font-mono mt-1">{match.set?.toUpperCase()} • {match.finish}</div>

                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="text-xs text-gray-400">Available from:</div>
                                        <Link
                                            to={`/profile/${match.friendId}`}
                                            className="px-2 py-0.5 bg-indigo-900/30 text-indigo-300 rounded text-xs font-bold border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer"
                                        >
                                            {match.friendName}
                                        </Link>
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">Quantity: {match.quantity}</div>
                                </div>

                                <button
                                    onClick={() => alert(`Requesting ${match.cardName} from ${match.friendName}... (Feature Coming Soon)`)}
                                    className="mt-3 w-full py-2 bg-gray-700 hover:bg-indigo-600 text-white text-xs font-bold uppercase rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    Request Trade
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TradeDashboard;
