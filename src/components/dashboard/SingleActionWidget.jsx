import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { getTierConfig } from '../../config/tiers';

const ACTIONS = {
    'new_deck': {
        title: 'New Deck',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
        gradient: 'from-indigo-600 to-purple-600',
        action: ({ navigate, addToast, userProfile, stats }) => {
            const limit = getTierConfig(userProfile?.subscription_tier).limits.decks;
            const current = stats?.uniqueDecks || 0;
            if (limit !== Infinity && current >= limit) {
                addToast(`Deck limit reached (${current}/${limit}).`, 'error');
                return;
            }
            navigate('/decks/new');
        }
    },
    'add_cards': {
        title: 'Add Cards',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
        gradient: 'from-blue-600 to-cyan-600',
        action: ({ navigate }) => navigate('/collection')
    },
    'browse_sets': {
        title: 'Browse Sets',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
        gradient: 'from-green-600 to-emerald-600',
        action: ({ navigate }) => navigate('/sets')
    },
    'wishlist': {
        title: 'Wishlist',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
        gradient: 'from-pink-600 to-rose-600',
        action: ({ navigate }) => navigate('/collection?wishlist=true')
    },
    'tournaments': {
        title: 'Tournaments',
        icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
        gradient: 'from-yellow-600 to-orange-600',
        action: ({ navigate }) => navigate('/tournaments')
    }
};

const SingleActionWidget = ({ actionType, data, size }) => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { userProfile, stats, decks } = data || {};

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isLargePlus = size === 'large' || size === 'xlarge';

    const config = ACTIONS[actionType];

    if (!config) return null;

    const handleClick = () => {
        if (config.action) {
            config.action({ navigate, addToast, userProfile, stats });
        }
    };

    if (isXS) {
        return (
            <button
                onClick={handleClick}
                className={`group relative overflow-hidden rounded-3xl w-full h-full flex items-center justify-between px-4 transition-all active:scale-95 border border-white/5 bg-gray-900/40`}
                title={config.title}
            >
                <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-20 transition-opacity`} />
                <div className="flex items-center gap-2 relative z-10">
                    <div className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/5 text-gray-400 group-hover:text-white uppercase tracking-tighter whitespace-nowrap border border-white/10">
                        {config.title}
                    </div>
                </div>
                <div className={`p-1.5 rounded-lg bg-gray-950/50 text-white group-hover:scale-110 transition-transform relative z-10`}>
                    {React.cloneElement(config.icon, { className: "w-4 h-4" })}
                </div>
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            className={`group relative overflow-hidden rounded-3xl ${isSmall ? 'p-4' : 'p-6'} text-left transition-all hover:-translate-y-1 hover:shadow-xl border border-white/5 w-full h-full flex flex-col justify-center items-center bg-gray-900/40`}
        >
            <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

            <div className={`relative z-10 flex flex-col items-center justify-center gap-2 text-gray-300 group-hover:text-white transition-colors`}>
                <div className={`${isSmall ? 'p-2' : 'p-4'} bg-gray-950/50 rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-all group-hover:bg-white/10 ring-1 ring-white/5 shadow-inner`}>
                    {config.icon}
                </div>
                <div className="text-center">
                    <span className={`${isSmall ? 'text-[10px]' : 'text-sm'} font-black uppercase tracking-widest`}>{config.title}</span>
                    {isLargePlus && (
                        <p className="text-[10px] text-gray-500 font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-1">
                            {actionType === 'new_deck' ? "Start your next brew" :
                                actionType === 'add_cards' ? "Grow your collection" :
                                    "Quick Access"}
                        </p>
                    )}
                </div>
            </div>
        </button>
    );
};

export default SingleActionWidget;
