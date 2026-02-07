import React from 'react';

const IdentityWidget = ({ data, size }) => {
    const { stats, decks } = data;

    // Safety check
    if (!stats || !stats.topColor) return null;

    const isXS = size === 'xs';
    const isMedium = size === 'medium';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';
    const isLargePlus = isLarge || isXL;

    // Derived Analysis for XL: Top Commanders in this identity
    const topCommanders = isXL ? (decks || [])
        .filter(deck => {
            const mainColors = deck?.commander?.color_identity || [];
            const partnerColors = deck?.commander_partner?.color_identity || [];
            const allColors = [...new Set([...mainColors, ...partnerColors])].sort().join('');
            const targetColors = stats.topColor.pips?.sort().join('') || 'C';
            return allColors === targetColors;
        })
        .slice(0, 3) : [];

    return (
        <div className={`bg-gray-900/60 border border-gray-800 rounded-3xl ${isXS ? 'p-3' : 'p-3 md:p-5'} backdrop-blur-sm hover:border-gray-700 transition-all group relative overflow-hidden h-full flex flex-col justify-center`}>
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-bl-full ${stats.topColor.bg} z-0`} />

            <div className={`flex relative z-10 h-full ${isLargePlus ? 'flex-col md:flex-row items-start md:items-center gap-4 md:gap-8' : 'flex-col justify-between'}`}>
                {isXS ? (
                    <div className="flex items-center justify-between w-full px-4">
                        <div className="flex items-center gap-3">
                            <div className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/5 text-gray-400 uppercase tracking-tighter whitespace-nowrap border border-white/10">
                                Top Identity
                            </div>
                            <div className={`text-sm font-black tracking-tight ${stats.topColor.color || 'text-white'}`}>
                                {stats.topColor.name}
                            </div>
                        </div>
                        <div className="flex -space-x-2">
                            {stats.topColor.pips?.map((pip, i) => (
                                <img
                                    key={i}
                                    src={`https://svgs.scryfall.io/card-symbols/${pip}.svg`}
                                    alt={pip}
                                    className="w-6 h-6 rounded-full shadow-lg transform group-hover:scale-110 transition-transform"
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Visual Identity Section */}
                        <div className={`flex flex-col`}>
                            <div className={`flex gap-1.5 mb-3`}>
                                {stats.topColor.pips?.map((pip, i) => (
                                    <img
                                        key={i}
                                        src={`https://svgs.scryfall.io/card-symbols/${pip}.svg`}
                                        alt={pip}
                                        className="w-5 h-5 md:w-7 md:h-7 shadow-lg transform group-hover:scale-110 transition-transform"
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Text Analysis Section */}
                        <div className={`flex-grow ${isLargePlus ? '' : 'mt-2 md:mt-4'}`}>
                            <div className={`text-xl md:text-2xl font-black tracking-tighter mb-0.5 md:mb-1 ${stats.topColor.color || 'text-white'}`}>{stats.topColor.name}</div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Top Color Identity</div>

                            {(isMedium || isLargePlus) && (
                                <div className={`text-xs text-gray-400 italic mt-3 opacity-80 leading-relaxed border-l-2 border-white/5 pl-3 py-1`}>
                                    "{stats.topColor.flavor}"
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* XL Analysis: Commanders & Assets */}
                {isXL && (
                    <div className="flex-grow flex flex-col md:flex-row gap-4 md:gap-8 items-start md:items-center md:border-l border-t md:border-t-0 border-white/5 pt-4 md:pt-0 md:pl-8 w-full md:w-auto h-auto md:h-full">
                        {/* Commanders Column */}
                        <div className="flex flex-col gap-2 w-full md:w-auto md:min-w-[160px]">
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 text-left md:text-center">Top Commanders</div>
                            <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                                {(topCommanders.length > 0 ? topCommanders : decks.slice(0, 3)).map(deck => (
                                    <div key={deck.id} className="flex items-center gap-2 group/cmd p-1 rounded-lg hover:bg-white/5 transition-colors min-w-[140px] md:min-w-0">
                                        {deck.commander?.image_uris?.art_crop && (
                                            <img src={deck.commander.image_uris.art_crop} className="w-8 h-6 object-cover rounded border border-white/10" alt="" />
                                        )}
                                        <span className="text-[11px] text-gray-300 group-hover/cmd:text-indigo-400 truncate">{deck.commander?.name || deck.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Signature Asset Spotlight */}
                        <div className="w-full md:flex-grow bg-gray-950/40 rounded-2xl p-4 border border-white/5 flex items-center gap-4 group/asset relative overflow-hidden mt-2 md:mt-0">
                            <div className="flex-grow">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Signature Asset</span>
                                <div className="text-sm font-black text-white group-hover/asset:text-indigo-300 transition-colors line-clamp-1">Ragavan, Nimble Pilferer</div>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-xs text-green-400 font-mono">$64.20</span>
                                    <span className="text-[9px] text-gray-500 uppercase font-black">Market Value</span>
                                </div>
                            </div>
                            <div className="w-16 h-12 rounded-lg overflow-hidden border border-white/10 relative">
                                <img src="https://cards.scryfall.io/art_crop/front/a/1/a134a6df-d264-44b2-a42e-9dcc914a1a38.jpg" className="w-full h-full object-cover group-hover/asset:scale-110 transition-transform duration-500" alt="" />
                                <div className="absolute inset-0 bg-indigo-500/10 mix-blend-overlay" />
                            </div>

                            {/* Distribution Stat */}
                            <div className="absolute bottom-0 right-0 p-2 opacity-20 text-[20px] font-black italic">64%</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IdentityWidget;
