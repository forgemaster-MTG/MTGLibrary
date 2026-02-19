import React from 'react';
import { Link } from 'react-router-dom';
import { getTierConfig } from '../../config/tiers';
import { Check } from 'lucide-react';

const SubscriptionWidget = ({ size, data }) => {
    const { userProfile, stats, pricingConfig } = data || {};

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isLargePlus = size === 'large' || size === 'xlarge';

    // Derive data safely
    const staticTier = getTierConfig(userProfile?.subscription_tier);

    // Resolve Dynamic Tier Name & Limits
    let dynamicTier = null;
    let creditLimit = 0;

    if (pricingConfig && pricingConfig.tiers) {
        // Map ID to Name if needed, or find by name matching static config
        // The static config 'name' matches the dynamic config 'name' (e.g. "Apprentice")
        const tierName = staticTier.name === 'Trial' ? 'Trial' : staticTier.name;

        if (tierName === 'Trial' && pricingConfig.trial) {
            creditLimit = pricingConfig.trial.creditLimit;
        } else {
            const found = pricingConfig.tiers.find(t => t.name === tierName);
            if (found) {
                dynamicTier = found;
                creditLimit = found.creditLimit;
            }
        }
    } else {
        // Fallback to static limit if dynamic not loaded (though likely 0 now in default if we didn't update unlimited logic for credits)
        creditLimit = 750000; // Safe default for display if unknown
        if (staticTier.name !== 'Initiate' && staticTier.name !== 'Trial') creditLimit = 8000000; // Apprentice baseline
    }

    const counts = {
        decks: stats?.uniqueDecks || 0,
        collection: stats?.collectionCount || 0,
        wishlist: stats?.wishlistCount || 0,
        credits_monthly: Number(userProfile?.credits_monthly || 0),
        credits_topup: Number(userProfile?.credits_topup || 0)
    };

    const getUsageColor = (current, max) => {
        // Credits are "Remaining". Green = High % remaining.
        if (max === Infinity) return 'bg-blue-500';
        const percentage = max > 0 ? (current / max) * 100 : 0;
        if (percentage < 10) return 'bg-red-500 animate-pulse';
        if (percentage < 30) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getUsageWidth = (current, max) => {
        // Credits: Width = % Remaining
        if (max === Infinity) return '100%';
        const percentage = max > 0 ? (current / max) * 100 : 0;
        return `${Math.min(percentage, 100)}%`;
    };

    // Alert if credits are low (< 10%)
    const isLowCredits = creditLimit > 0 && (counts.credits_monthly / creditLimit) < 0.1;
    const isAnyNearLimit = isLowCredits;

    if (isXS) {
        return (
            <Link to="/settings/membership" className={`bg-gray-900/60 border ${isAnyNearLimit ? 'border-red-500/40' : 'border-primary-500/20'} rounded-3xl h-full flex flex-col items-center justify-center group hover:bg-gray-800 transition-all`}>
                <span className={`text-xl font-black ${isAnyNearLimit ? 'text-red-400' : 'text-primary-400'} group-hover:scale-110 transition-transform`}>
                    {staticTier.name[0]}
                </span>
                <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-1 h-1 rounded-full ${isAnyNearLimit ? 'bg-red-500/50' : 'bg-primary-500/50'}`} />
                    ))}
                </div>
            </Link>
        );
    }

    const renderProgressBar = (label, current, max, formatFn) => {
        const colorClass = getUsageColor(current, max);
        const width = getUsageWidth(current, max);
        const displayMax = max === Infinity ? '∞' : (formatFn ? formatFn(max) : max);
        const displayCurrent = formatFn ? formatFn(current) : current;

        return (
            <div className="flex-1">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
                    <span className="text-[9px] font-mono text-gray-400">
                        {displayCurrent} / {displayMax}
                    </span>
                </div>
                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <div className={`h-full ${colorClass} transition-all duration-1000`} style={{ width }} />
                </div>
            </div>
        );
    };

    const formatK = (n) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
        return n;
    };

    return (
        <div className={`bg-gray-900 border ${isAnyNearLimit ? 'border-red-500/20' : 'border-primary-500/20'} rounded-3xl ${isSmall ? 'p-4' : 'p-6'} backdrop-blur-md relative overflow-hidden group h-full flex flex-col`}>
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${isAnyNearLimit ? 'bg-red-500/10 text-red-400' : 'bg-primary-500/10 text-primary-400'} rounded-xl flex items-center justify-center text-xl shadow-inner border border-white/5`}>
                        {isAnyNearLimit ? '⚠️' : staticTier.name === 'Wizard' ? '🧙' : '📊'}
                    </div>
                    <div>
                        <h3 className="font-black text-[10px] text-gray-500 uppercase tracking-widest">Plan: <span className="text-white">{staticTier.name}</span></h3>
                        <p className={`text-[10px] ${isAnyNearLimit ? 'text-red-400' : 'text-primary-400'} font-black uppercase tracking-widest`}>
                            {isAnyNearLimit ? 'Low Credits' : 'Active'}
                        </p>
                    </div>
                </div>
                {!isSmall && (
                    <Link to="/settings/membership" className="text-[10px] font-black text-primary-400 hover:text-white uppercase tracking-widest underline underline-offset-4 decoration-primary-500/30">
                        Manage
                    </Link>
                )}
            </div>

            <div className={`flex-grow ${isLargePlus ? 'grid grid-cols-2 gap-6' : 'space-y-4'}`}>
                <div className="space-y-3">
                    {renderProgressBar('Monthly Credits', counts.credits_monthly, creditLimit, formatK)}
                    {counts.credits_topup > 0 && renderProgressBar('Top-up Credits', counts.credits_topup, Infinity, formatK)}

                    <div className="flex items-center gap-2 pt-1">
                        <Check className="w-3 h-3 text-green-500" />
                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider leading-none">Unlimited Storage Active</span>
                    </div>
                </div>

                {isLargePlus && (
                    <div className="text-xs text-gray-500 space-y-2 border-l border-white/5 pl-4">
                        <div className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-2">My Stats</div>
                        <div className="flex justify-between"><span>Decks:</span> <span className="text-white font-mono">{counts.decks}</span></div>
                        <div className="flex justify-between"><span>Collection:</span> <span className="text-white font-mono">{formatK(counts.collection)}</span></div>
                        <div className="flex justify-between"><span>Wishlist:</span> <span className="text-white font-mono">{formatK(counts.wishlist)}</span></div>
                    </div>
                )}
            </div>
            {isLargePlus && (
                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-[10px]">
                    <div className="text-gray-500 font-bold uppercase tracking-widest">Pricing tier: {staticTier.name}</div>
                    <Link to="/pricing" className="bg-primary-600 hover:bg-primary-500 px-4 py-2 rounded-xl text-white font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-primary-900/20">
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
