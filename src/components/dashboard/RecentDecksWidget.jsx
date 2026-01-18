import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const DeckItem = ({ deck, navigate }) => {
    const [mainFlipped, setMainFlipped] = useState(false);
    const [partnerFlipped, setPartnerFlipped] = useState(false);

    const getArtCrop = (card, flipped) => {
        if (!card) return null;
        if (flipped && card.card_faces?.length > 1 && card.card_faces[1].image_uris?.art_crop) {
            return card.card_faces[1].image_uris.art_crop;
        }
        if (card.image_uris?.art_crop) return card.image_uris.art_crop;
        if (card.card_faces?.[0]?.image_uris?.art_crop) return card.card_faces[0].image_uris.art_crop;
        return null;
    };

    const hasFaces = (card) => card?.card_faces?.length > 1;

    const mainImage = getArtCrop(deck.commander, mainFlipped);
    const partnerImage = getArtCrop(deck.commander_partner, partnerFlipped);

    return (
        <div
            onClick={() => navigate(`/decks/${deck.id}`)}
            className={`group relative rounded-xl overflow-hidden cursor-pointer shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-1 border border-white/5 bg-gray-900 h-full min-h-[140px]`}
        >
            <div className="absolute inset-0 bg-gray-950">
                {deck.commander_partner ? (
                    <div className="w-full h-full flex">
                        <div className="w-1/2 h-full relative border-r border-black/50 group/main">
                            <img src={mainImage || 'https://placehold.co/400x600?text=?'} alt="" className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700" />
                            {hasFaces(deck.commander) && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setMainFlipped(!mainFlipped); }}
                                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white/70 hover:text-white hover:bg-black/80 transition-colors z-20"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                            )}
                        </div>
                        <div className="w-1/2 h-full relative group/partner">
                            <img src={partnerImage || 'https://placehold.co/400x600?text=?'} alt="" className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700" />
                            {hasFaces(deck.commander_partner) && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setPartnerFlipped(!partnerFlipped); }}
                                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white/70 hover:text-white hover:bg-black/80 transition-colors z-20"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full relative">
                        <img src={mainImage || 'https://placehold.co/400x600?text=?'} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700" />
                        {hasFaces(deck.commander) && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setMainFlipped(!mainFlipped); }}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white/70 hover:text-white hover:bg-black/80 transition-colors z-20"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent opacity-90 pointer-events-none" />
            <div className="absolute inset-0 p-3 flex flex-col justify-end pointer-events-none">
                <h3 className="text-sm font-bold text-white leading-tight mb-0.5 group-hover:text-indigo-400 transition-colors line-clamp-1">{deck.name}</h3>
                <div className="flex gap-0.5">
                    {(() => {
                        const mainColors = deck?.commander?.color_identity || [];
                        const partnerColors = deck?.commander_partner?.color_identity || [];
                        const allColors = [...new Set([...mainColors, ...partnerColors])];
                        if (allColors.length === 0) allColors.push('C');
                        return allColors.map(c => (
                            <img key={c} src={`https://svgs.scryfall.io/card-symbols/${c}.svg`} alt={c} className="w-2.5 h-2.5" />
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};

const RecentDecksWidget = ({ data, size }) => {
    const { decks, decksLoading } = data;
    const navigate = useNavigate();

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isMedium = size === 'medium';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';

    // Determine how many decks to show
    const displayCount = useMemo(() => {
        if (isXS || isSmall) return 1;
        if (isMedium) return 2;
        if (isLarge) return 3;
        if (isXL) return 6; // X-Large: Request was specifically 6
        return 6; // Default/Fallback to XL if larger
    }, [isXS, isSmall, isMedium, isLarge]);

    const recentDecks = useMemo(() => {
        return decks ? [...decks].reverse().slice(0, displayCount) : [];
    }, [decks, displayCount]);

    const gridClass = useMemo(() => {
        if (isXS || isSmall) return 'grid-cols-1';
        if (isMedium) return 'grid-cols-2';
        if (isLarge) return 'grid-cols-3';
        return 'grid-cols-2 lg:grid-cols-4 xl:grid-cols-6';
    }, [isXS, isSmall, isMedium, isLarge]);

    if (isXS) {
        const topDeck = recentDecks[0];
        return (
            <div onClick={() => topDeck && navigate(`/decks/${topDeck.id}`)} className="bg-gray-950/40 border border-white/5 rounded-3xl h-full flex items-center px-4 justify-between cursor-pointer hover:bg-white/5 transition-all group overflow-hidden">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Recent Deck</span>
                    <span className="text-gray-700">—</span>
                    <span className="text-xs font-bold text-white truncate max-w-[120px]">{topDeck?.name || 'No decks'}</span>
                </div>
                <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400 group-hover:scale-110 transition-transform flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-gray-950/40 border border-white/5 rounded-3xl ${isSmall ? 'p-4' : 'p-6'} backdrop-blur-md shadow-xl h-full flex flex-col`}>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3 shrink-0">
                <span className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
                <span className={isSmall ? 'hidden' : 'inline'}>Recent Decks</span>
                {isSmall && <span>Recent</span>}
            </h2>

            <div className={`flex-grow overflow-hidden relative`}>
                {decksLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">Loading...</div>
                ) : recentDecks.length > 0 ? (
                    <div className={`grid ${gridClass} gap-3 md:gap-4 h-full`}>
                        {recentDecks.map(deck => (
                            <DeckItem key={deck.id} deck={deck} navigate={navigate} />
                        ))}

                        {isXL && (
                            <div
                                onClick={() => navigate('/decks/new')}
                                className="border-2 border-dashed border-indigo-500/20 rounded-xl flex flex-col items-center justify-center text-center p-4 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all group cursor-pointer"
                            >
                                <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform mb-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </div>
                                <span className="text-sm font-bold text-indigo-300">New Deck</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 bg-gray-900/30 rounded-2xl border border-dashed border-gray-800">
                        <p className="text-gray-500 text-sm">No decks.</p>
                        <Link to="/decks/new" className="text-indigo-400 text-xs font-bold hover:text-indigo-300 mt-1">Create &rarr;</Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecentDecksWidget;
