import React from 'react';
import { Link } from 'react-router-dom';
import { getArtCrop, getDeckColors } from '../../utils/deckUtils';
import { getIdentity } from '../../utils/identityRegistry';

const DeckCard = ({ deck }) => {
    const deckColors = getDeckColors(deck);
    const identity = getIdentity(deckColors);
    const cardCount = parseInt(deck.card_count || 0);
    const mainImage = getArtCrop(deck.commander);
    const partnerImage = getArtCrop(deck.commander_partner);

    return (
        <Link to={`/decks/${deck.id}`} className="group relative flex flex-col h-[420px] rounded-3xl transition-all duration-300 hover:-translate-y-2">
            {/* Glass Container */}
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl group-hover:border-indigo-500/50 group-hover:shadow-indigo-500/20 transition-all overflow-hidden flex flex-col">

                {/* Image Area */}
                <div className="h-[60%] w-full relative overflow-hidden bg-gray-950 shrink-0">
                    {deck.commander_partner ? (
                        // Partner Layout: Split View
                        <div className="w-full h-full flex">
                            <div className="w-1/2 h-full relative border-r border-black/50">
                                <img
                                    src={mainImage || 'https://placehold.co/400x600?text=?'}
                                    alt={deck.commander?.name}
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-80" />
                            </div>
                            <div className="w-1/2 h-full relative">
                                <img
                                    src={partnerImage || 'https://placehold.co/400x600?text=?'}
                                    alt={deck.commander_partner?.name}
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-80" />
                            </div>
                        </div>
                    ) : mainImage ? (
                        // Solo Layout
                        <>
                            <img
                                src={mainImage}
                                alt={deck.name}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90" />
                        </>
                    ) : (
                        // No Image
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                            <svg className="w-16 h-16 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                    )}

                    {/* Mockup Badge */}
                    {deck.is_mockup && (
                        <div className="absolute top-3 left-3 px-2 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 backdrop-blur-md rounded text-[10px] font-black uppercase tracking-widest shadow-lg">
                            Mockup
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="h-[40%] p-5 flex flex-col justify-between relative grow">
                    {/* Color Pips */}
                    <div className="absolute -top-3 left-5 flex gap-1 bg-gray-900/80 backdrop-blur-md rounded-full px-2 py-1 border border-white/10 shadow-xl">
                        {(deck.format?.toLowerCase() === 'standard' ? (deck.colors || []) : deckColors).map(c => {
                            const pipUrl = `https://svgs.scryfall.io/card-symbols/${c}.svg`;
                            return (
                                <img
                                    key={c}
                                    src={pipUrl}
                                    alt={c}
                                    className="w-4 h-4 shadow-sm"
                                />
                            );
                        })}
                    </div>

                    <div className="mt-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1 opacity-80">
                            {identity.badge}
                        </div>
                        <h3 className="text-xl font-bold text-white leading-tight line-clamp-2 mb-1 group-hover:text-indigo-300 transition-colors">
                            {deck.name || 'Untitled Deck'}
                        </h3>
                        <p className="text-xs text-gray-500 font-medium line-clamp-1">
                            {deck.commander_partner
                                ? `${deck.commander?.name} & ${deck.commander_partner?.name}`
                                : (deck.commander?.name || 'No Commander')}
                        </p>
                    </div>

                    <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Format</span>
                            <span className="text-xs text-gray-300 font-medium">{deck.format || 'Commander'}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Cards</span>
                            <span className={`text-sm font-mono font-bold ${cardCount >= (deck.format?.toLowerCase() === 'standard' ? 60 : 100) ? 'text-green-500' : 'text-indigo-400'}`}>
                                {cardCount}<span className="text-gray-600 text-[10px]">/{deck.format?.toLowerCase() === 'standard' ? '60' : '100'}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default DeckCard;
