import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

const DashboardKPI = ({ title, value, icon, color, to, children, size }) => {
    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isMedium = size === 'medium';
    const isLargePlus = size === 'large' || size === 'xlarge';

    const content = (
        <div className={`bg-gray-900/60 border border-gray-800 rounded-2xl ${isXS ? 'px-4 py-2' : 'p-4 md:p-5'} backdrop-blur-sm hover:border-gray-700 transition-all group relative h-full flex flex-col justify-center`}>
            {children}
            <div className={`relative z-20 ${isXS ? 'flex items-center justify-between w-full' : ''}`}>
                {!isXS && (
                    <div className="flex justify-between items-start mb-2 md:mb-4">
                        <div className={`p-2 rounded-xl bg-gray-950 text-${color}-400 group-hover:scale-110 transition-transform shadow-inner`}>
                            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} /></svg>
                        </div>
                    </div>
                )}
                <div className={isXS ? 'flex items-center gap-2' : 'flex flex-col'}>
                    {isXS && (
                        <div className={`text-[9px] font-black px-2 py-0.5 rounded-full bg-${color}-500/10 text-${color}-400/80 uppercase tracking-tighter whitespace-nowrap border border-${color}-500/20`}>
                            {title}
                        </div>
                    )}
                    <div className={`${isXS ? 'text-base' : 'text-3xl'} font-black text-white tracking-tight`}>
                        {value}
                    </div>
                </div>
                {isXS && !children && (
                    <div className={`text-${color}-400 opacity-50`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} /></svg>
                    </div>
                )}
                {!isXS && (
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{title}</div>
                )}
            </div>
        </div>
    );

    if (to && !children) { // Don't wrap in Link if we have interactive children like buttons or lists that handle their own clicks
        return <Link to={to} className="block h-full transition-transform active:scale-[0.98]">{content}</Link>;
    }

    return content;
};

export const TotalCardsWidget = ({ data, size }) => {
    const { stats, collection } = data;
    if (!stats) return null;

    const isXS = size === 'xs';
    const isMedium = size === 'medium';
    const isLargePlus = size === 'large' || size === 'xlarge';

    return (
        <div className="h-full relative overflow-hidden rounded-2xl">
            <DashboardKPI
                to={isLargePlus ? null : "/collection"}
                title="Total Cards"
                value={stats.totalCards}
                icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                color="blue"
                size={size}
            >
                {/* M Tier: Split metrics (Distinct Count) */}
                {isMedium && (
                    <div className="absolute top-4 right-4 text-right">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Distinct</div>
                        <div className="text-xl font-bold text-indigo-400">{collection?.length || 0}</div>
                    </div>
                )}

                {/* L Tier: Recently Added Side Panel */}
                {size === 'large' && collection && (
                    <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-gray-900 to-transparent p-4 overflow-y-auto pl-12 border-l border-white/5">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 text-right">Recently Added</div>
                        <div className="space-y-1.5">
                            {collection.slice(-5).reverse().map((card, i) => (
                                <div key={i} className="flex items-center gap-2 text-right justify-end group/card">
                                    <div className="text-xs font-bold text-gray-300 group-hover:text-white truncate flex-grow min-w-0">{card.name}</div>
                                    {card.image_uris?.art_crop && (
                                        <img src={card.image_uris.art_crop} alt={card.name} className="w-8 h-6 object-cover rounded border border-white/10" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* XL Tier: Comprehensive Horizontal Spread */}
                {size === 'xlarge' && (
                    <div className="absolute inset-y-0 right-0 w-[70%] flex items-center justify-around border-l border-white/5 bg-gray-950/20 px-8">
                        <div className="flex flex-col items-center">
                            <span className="text-xl font-black text-indigo-400">{collection?.length || 0}</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Distinct</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xl font-black text-yellow-400">{collection?.filter(c => c.val_foil).length || 0}</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Foils</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xl font-black text-green-400">{collection?.filter(c => c.val_signed).length || 0}</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Signed</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xl font-black text-gray-400">{collection?.filter(c => c.val_alt_art).length || 0}</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Alt Art</span>
                        </div>
                    </div>
                )}
            </DashboardKPI>
        </div>
    );
};

export const UniqueDecksWidget = ({ data, size }) => {
    const { stats } = data;
    if (!stats) return null;
    return <DashboardKPI to="/decks" title="Unique Decks" value={stats.uniqueDecks} icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" color="purple" size={size} />;
};

const FlippableAsset = ({ card }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const hasFaces = card.card_faces?.length > 1;

    const currentImage = useMemo(() => {
        if (!hasFaces) {
            return card.image_uris?.normal || card.image_uris?.art_crop;
        }
        if (isFlipped && card.card_faces[1].image_uris) {
            return card.card_faces[1].image_uris.normal || card.card_faces[1].image_uris.art_crop;
        }
        return card.card_faces[0].image_uris?.normal || card.card_faces[0].image_uris?.art_crop || card.image_uris?.normal;
    }, [card, isFlipped, hasFaces]);

    return (
        <div
            className="group/card flex flex-col cursor-pointer"
            onClick={() => hasFaces && setIsFlipped(!isFlipped)}
        >
            <div className="aspect-[2.5/3.5] rounded-lg overflow-hidden border border-white/10 mb-2 relative bg-gray-900 shadow-lg group-hover/card:shadow-indigo-500/20 transition-all">
                {currentImage ? (
                    <img src={currentImage} alt={card.name} className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-800">
                        <span className="text-[10px]">No Image</span>
                    </div>
                )}

                {hasFaces && (
                    <div className="absolute top-1 right-1 p-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white/70">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                )}

                <div className="absolute bottom-0 inset-x-0 bg-gray-950/90 py-1 px-2 text-center border-t border-white/10 backdrop-blur-sm">
                    <span className="text-xs font-mono font-bold text-green-400 block">${card.prices?.usd}</span>
                </div>
            </div>
            <div className="text-[10px] font-bold text-gray-400 line-clamp-1 text-center group-hover/card:text-white transition-colors">{card.name}</div>
        </div>
    );
};

export const CollectionValueWidget = ({ data, actions, size }) => {
    const { stats, syncLoading, collection } = data;
    const { handleSyncPrices } = actions;
    if (!stats) return null;

    const isXS = size === 'xs';
    const isMedium = size === 'medium';
    const isLargePlus = size === 'large' || size === 'xlarge';

    // Find top mover (placeholder logic)
    const topMover = collection ? [...collection].sort((a, b) => (parseFloat(b.prices?.usd) || 0) - (parseFloat(a.prices?.usd) || 0))[0] : null;

    return (
        <div className="h-full relative overflow-hidden rounded-2xl">
            <DashboardKPI title="Collection Value" value={stats.value} icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" color="green" size={size}>
                {!isXS && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            handleSyncPrices();
                        }}
                        disabled={syncLoading}
                        className={`absolute bottom-4 right-4 p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all ${syncLoading ? 'animate-spin' : ''} z-20`}
                        title="Update Prices from Scryfall"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                )}

                {/* M Tier: Top Mover */}
                {isMedium && topMover && (
                    <div className="absolute top-4 right-4 text-right max-w-[100px]">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 truncate">Top Value</div>
                        <div className="text-xs font-bold text-green-400 truncate">{topMover.name}</div>
                    </div>
                )}

                {/* L Tier: Top Value List */}
                {size === 'large' && collection && (
                    <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-gray-900 to-transparent p-4 overflow-y-auto pl-12 border-l border-white/5 z-10">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 text-right">Top Value Cards</div>
                        <div className="space-y-1.5">
                            {collection
                                .filter(c => parseFloat(c.prices?.usd) > 0)
                                .sort((a, b) => parseFloat(b.prices?.usd) - parseFloat(a.prices?.usd))
                                .slice(0, 5)
                                .map((card, i) => (
                                    <div key={i} className="flex items-center gap-2 text-right justify-end group/card">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-gray-300 group-hover/card:text-white truncate flex-grow min-w-0">{card.name}</span>
                                            <span className="text-[10px] text-green-400 font-mono">${card.prices?.usd}</span>
                                        </div>
                                        {card.image_uris?.art_crop && (
                                            <img src={card.image_uris.art_crop} alt={card.name} className="w-8 h-6 object-cover rounded border border-white/10" />
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* XL Tier: Grid View of Top Assets */}
                {size === 'xlarge' && collection && (
                    <div className="absolute inset-y-0 right-0 w-[75%] border-l border-white/5 bg-gray-950/20 px-6 py-4 flex flex-col">
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex-shrink-0">Highest Collection Assets</div>
                        <div className="grid grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                            {collection
                                .filter(c => parseFloat(c.prices?.usd) > 0)
                                .sort((a, b) => parseFloat(b.prices?.usd) - parseFloat(a.prices?.usd))
                                .slice(0, 12)
                                .map((card, i) => (
                                    <FlippableAsset key={i} card={card} />
                                ))}
                        </div>
                    </div>
                )}
            </DashboardKPI>
        </div>
    );
};
