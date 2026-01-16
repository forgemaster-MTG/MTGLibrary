import React, { useMemo } from 'react';
import { useCollection } from '../../hooks/useCollection';
import { useMarketData } from '../../hooks/useMarketData';

const MarketTicker = () => {
    const { cards: collection, loading } = useCollection();
    const { value } = useMarketData(collection);

    const topCards = useMemo(() => {
        if (!collection) return [];
        return [...collection]
            .sort((a, b) => (b.currPrice || 0) * (b.quantity || 1) - (a.currPrice || 0) * (a.quantity || 1))
            .slice(0, 5);
    }, [collection]);

    if (loading) return <div className="animate-pulse h-12 bg-gray-900 rounded-xl" />;

    // Calculate daily movement (mocked for now as we don't have historical data yet)
    // In a real app, we'd compare vs yesterday's cached price.
    const marketTrend = Math.random() > 0.5 ? 'up' : 'down';
    const trendPercent = (Math.random() * 5).toFixed(1);

    return (
        <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

            {/* Total Value */}
            <div className="flex-shrink-0 flex items-center gap-4 z-10">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <span className="text-xl">💰</span>
                </div>
                <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Collection Value</div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-bold text-white">
                            ${value?.total?.toFixed(2) || '0.00'}
                        </span>
                        <span className={`text-xs font-bold ${marketTrend === 'up' ? 'text-green-500' : 'text-red-500'} flex items-center`}>
                            {marketTrend === 'up' ? '▲' : '▼'} {trendPercent}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Separator */}
            <div className="hidden md:block w-px h-10 bg-white/10" />

            {/* Ticker Items */}
            <div className="flex-grow overflow-hidden w-full relative z-10">
                <div className="flex gap-6 animate-scroll-subtle hover:pause-scroll">
                    {topCards.map(card => (
                        <div key={card.id || card.firestoreId} className="flex items-center gap-2 group flex-shrink-0 cursor-pointer">
                            <div className="w-8 h-8 rounded overflow-hidden relative border border-white/10 group-hover:border-indigo-500 transition-colors">
                                <img src={card.image_uris?.small || card.image_uri} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-gray-300 group-hover:text-white truncate flex-grow min-w-0">{card.name}</div>
                                <div className="text-[10px] font-mono text-emerald-400">
                                    ${((card.currPrice || 0) * (card.quantity || 1)).toFixed(2)}
                                </div>
                            </div>
                        </div>
                    ))}
                    {topCards.length === 0 && (
                        <div className="text-xs text-gray-500 italic">Add cards to see market analysis</div>
                    )}
                </div>
            </div>

            <style>{`
                .pause-scroll:hover {
                     animation-play-state: paused;
                }
            `}</style>
        </div>
    );
};

export default MarketTicker;
