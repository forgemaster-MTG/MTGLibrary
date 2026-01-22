import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tradeService } from '../../services/TradeService';
import { useAuth } from '../../contexts/AuthContext';

const TradeMatchWidget = ({ size = 'medium' }) => {
    const { currentUser, userProfile } = useAuth();
    const [matchCount, setMatchCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState(false);

    useEffect(() => {
        if (!currentUser || !userProfile?.id || error) return;

        let isMounted = true;

        const checkMatches = async () => {
            try {
                // For the widget, we might want a lightweight 'count' endpoint later.
                // For now, fetch all matches (client-side filter)
                const matches = await tradeService.findMatches(userProfile.id);
                if (isMounted) setMatchCount(matches?.length || 0);
            } catch (err) {
                // Determine if it's an offline/network error to avoid scary warnings
                const isOffline = !navigator.onLine || err.message?.includes('HTML') || err.message?.includes('403');
                if (!isOffline) {
                    console.warn("Widget trade check failed", err);
                }
                if (isMounted) setError(true); // Stop retrying on error
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        checkMatches();

        return () => { isMounted = false; };
    }, [currentUser, userProfile?.id, error]);

    if (loading) return (
        <div className="h-full w-full bg-gray-800 rounded-2xl animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-gray-700"></div>
        </div>
    );

    return (
        <Link to="/armory" className="block h-full w-full group">
            <div className="h-full w-full bg-gradient-to-br from-indigo-900/50 to-gray-900 border border-indigo-500/30 hover:border-indigo-400 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]">

                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-600/20"></div>

                <div className="flex justify-between items-start z-10">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 group-hover:text-white group-hover:bg-indigo-500 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </div>
                </div>

                <div className="z-10">
                    <div className="text-3xl font-bold text-white mb-1 group-hover:scale-105 transition-transform origin-left">
                        {matchCount > 0 ? matchCount : 'No'}
                    </div>
                    <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                        {matchCount === 1 ? 'Trade Match' : 'Trade Matches'}
                    </div>
                    {matchCount > 0 && (
                        <div className="text-[10px] text-gray-400 mt-1">
                            Cards available in your Pod
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default TradeMatchWidget;
