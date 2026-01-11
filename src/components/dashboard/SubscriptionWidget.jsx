import React from 'react';
import { Link } from 'react-router-dom';

const SubscriptionWidget = ({ tier, counts }) => {
    const getUsageColor = (current, max) => {
        if (max === Infinity) return 'bg-blue-500';
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

    const renderProgressBar = (label, current, max) => {
        const colorClass = getUsageColor(current, max);
        const width = getUsageWidth(current, max);
        const isNearLimit = max !== Infinity && (current / max) >= 0.9;

        return (
            <div className="mb-4 last:mb-0">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{label}</span>
                    <span className={`text-xs font-mono ${isNearLimit ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                        {current} <span className="text-gray-600">/</span> {max === Infinity ? '∞' : max}
                    </span>
                </div>
                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                    <div
                        className={`h-full ${colorClass} transition-all duration-1000 ease-out`}
                        style={{ width }}
                    />
                </div>
            </div>
        );
    };

    const isAnyNearLimit = (
        (tier.limits.decks !== Infinity && counts.decks / tier.limits.decks >= 0.9) ||
        (tier.limits.collection !== Infinity && counts.collection / tier.limits.collection >= 0.9) ||
        (tier.limits.wishlist !== Infinity && counts.wishlist / tier.limits.wishlist >= 0.9)
    );

    return (
        <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/60 border border-indigo-500/20 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden group h-full flex flex-col justify-between">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>

            <div className="relative z-10 w-full flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-xl shadow-inner border border-indigo-500/30">
                            📊
                        </div>
                        <div>
                            <h3 className="font-bold text-white leading-tight">Allocations</h3>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{tier.name} Plan</p>
                        </div>
                    </div>

                    <Link to="/settings/membership" className="text-xs text-gray-400 hover:text-white underline decoration-gray-600 hover:decoration-white transition-all">
                        Manage
                    </Link>
                </div>

                <div className="flex-grow space-y-4">
                    {renderProgressBar('Decks', counts.decks, tier.limits.decks)}
                    {renderProgressBar('Collection', counts.collection, tier.limits.collection)}
                    {renderProgressBar('Wishlist', counts.wishlist, tier.limits.wishlist)}
                </div>

                {isAnyNearLimit && (
                    <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-xs text-red-200 mb-2 font-medium flex items-center gap-2">
                            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Storage limits reached!
                        </p>
                        <Link
                            to="/pricing"
                            className="block w-full py-2 text-center bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-red-900/20"
                        >
                            Upgrade Plan
                        </Link>
                    </div>
                )}

                {!isAnyNearLimit && tier.name === 'Initiate' && (
                    <div className="mt-6">
                        <Link
                            to="/pricing"
                            className="block w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/20 text-center"
                        >
                            Upgrade for More
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubscriptionWidget;
