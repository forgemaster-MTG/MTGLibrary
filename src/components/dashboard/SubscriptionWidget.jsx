import React from 'react';
import { Link } from 'react-router-dom';
import { TIER_CONFIG } from '../../config/tiers';

const SubscriptionWidget = ({ size, data }) => {
    const { userProfile, stats } = data || {};

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isLargePlus = size === 'large' || size === 'xlarge';

    // Derive data safely
    const tier = TIER_CONFIG[userProfile?.subscription_tier || 'free'];
    const counts = {
        decks: stats?.uniqueDecks || 0,
        collection: stats?.collectionCount || 0,
        wishlist: stats?.wishlistCount || 0
    };

    const getUsageColor = (current, max) => {
        if (max === Infinity) return 'bg-indigo-500';
        const percentage = (current / max) * 100;
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 75) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getUsageWidth = (current, max) => {
        if (max === Infinity) return '100%';
        const percentage = (current / max) * 100;
        return `${Math.min(percentage, 100)}%`;
    };

    const isAnyNearLimit = (
        (tier.limits.decks !== Infinity && counts.decks / tier.limits.decks >= 0.9) ||
        (tier.limits.collection !== Infinity && counts.collection / tier.limits.collection >= 0.9) ||
        (tier.limits.wishlist !== Infinity && counts.wishlist / tier.limits.wishlist >= 0.9)
    );

    if (isXS) {
        return (
            <Link to="/settings/membership" className={`bg-gray-900/60 border ${isAnyNearLimit ? 'border-red-500/40' : 'border-indigo-500/20'} rounded-3xl h-full flex flex-col items-center justify-center group hover:bg-gray-800 transition-all`}>
                <span className={`text-xl font-black ${isAnyNearLimit ? 'text-red-400' : 'text-indigo-400'} group-hover:scale-110 transition-transform`}>
                    {tier.name[0]}
                </span>
                <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-1 h-1 rounded-full ${isAnyNearLimit ? 'bg-red-500/50' : 'bg-indigo-500/50'}`} />
                    ))}
                </div>
            </Link>
        );
    }

    const renderProgressBar = (label, current, max) => {
        const colorClass = getUsageColor(current, max);
        const width = getUsageWidth(current, max);
        return (
            <div className="flex-1">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
                    <span className="text-[9px] font-mono text-gray-400">
                        {current}/{max === Infinity ? '∞' : max}
                    </span>
                </div>
                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <div className={`h-full ${colorClass} transition-all duration-1000`} style={{ width }} />
                </div>
            </div>
        );
    };

    return (
        <div className={`bg-gray-900 border ${isAnyNearLimit ? 'border-red-500/20' : 'border-indigo-500/20'} rounded-3xl ${isSmall ? 'p-4' : 'p-6'} backdrop-blur-md relative overflow-hidden group h-full flex flex-col`}>
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${isAnyNearLimit ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-400'} rounded-xl flex items-center justify-center text-xl shadow-inner border border-white/5`}>
                        {isAnyNearLimit ? '⚠️' : tier.name === 'Wizard' ? '🧙' : '📊'}
                    </div>
                    <div>
                        <h3 className="font-black text-[10px] text-gray-500 uppercase tracking-widest">Plan: <span className="text-white">{tier.name}</span></h3>
                        <p className={`text-[10px] ${isAnyNearLimit ? 'text-red-400' : 'text-indigo-400'} font-black uppercase tracking-widest`}>
                            {isAnyNearLimit ? 'Limit Alert' : 'Active'}
                        </p>
                    </div>
                </div>
                {!isSmall && (
                    <Link to="/settings/membership" className="text-[10px] font-black text-indigo-400 hover:text-white uppercase tracking-widest underline underline-offset-4 decoration-indigo-500/30">
                        Manage
                    </Link>
                )}
            </div>

            <div className={`flex-grow ${isLargePlus ? 'grid grid-cols-3 gap-6' : 'space-y-4'}`}>
                {renderProgressBar('Decks', counts.decks, tier.limits.decks)}
                {renderProgressBar('Collection', counts.collection, tier.limits.collection)}
                {renderProgressBar('Wishlist', counts.wishlist, tier.limits.wishlist)}
            </div>

            {isLargePlus && (
                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-[10px]">
                    <div className="text-gray-500 font-bold uppercase tracking-widest">Pricing tier: {tier.name}</div>
                    <Link to="/pricing" className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-white font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-900/20">
                        Upgrade
                    </Link>
                </div>
            )}

            {isSmall && (
                <Link to="/settings/membership" className="mt-4 w-full py-2 bg-gray-800 text-center text-[10px] font-black uppercase tracking-widest text-gray-400 rounded-xl">
                    Details &rarr;
                </Link>
            )}
        </div>
    );
};

export default SubscriptionWidget;
