import React, { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getArtCrop, getDeckColors } from '../../utils/deckUtils';
import { getIdentity } from '../../utils/identityRegistry';
import { isCommanderFormat } from '../../utils/formatUtils';

const DeckCard = memo(function DeckCard({ deck }) {
    const navigate = useNavigate();
    const deckColors = getDeckColors(deck);
    const identity = getIdentity(deckColors);
    const cardCount = parseInt(deck.card_count || 0);
    const mainImage = getArtCrop(deck.commander);
    const partnerImage = getArtCrop(deck.commander_partner);

    return (
        <div onClick={() => navigate(`/decks/${deck.id}`)} className="group relative flex flex-col h-[420px] rounded-3xl transition-all duration-300 hover:-translate-y-2 cursor-pointer">
            {/* Glass Container */}
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl group-hover:border-primary-500/50 group-hover:shadow-primary-500/20 transition-all overflow-hidden flex flex-col">

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

                    {/* Badges (Mockup, Precon) */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                        {deck.tags && deck.tags.includes('Precon') && (
                            <div className="px-2 py-1 bg-teal-500/20 text-teal-400 border border-teal-500/30 backdrop-blur-md rounded text-[10px] font-black uppercase tracking-widest shadow-lg text-center">
                                Precon
                            </div>
                        )}
                        {deck.is_mockup && (
                            <div className="px-2 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 backdrop-blur-md rounded text-[10px] font-black uppercase tracking-widest shadow-lg text-center">
                                Mockup
                            </div>
                        )}
                    </div>

                    {/* Quick Play Action (Hover Only) */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none group-hover:pointer-events-auto">
                        <Link
                            to={`/solitaire/${deck.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 bg-amber-600/90 hover:bg-amber-500 text-white p-4 rounded-full shadow-2xl backdrop-blur-sm border 2 border-white/20 flex flex-col items-center gap-1"
                            title="Play Solitaire"
                        >
                            <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </Link>
                    </div>
                </div>


                {/* Content Area */}
                <div className="h-[40%] p-5 flex flex-col justify-between relative grow">
                    {/* Color Pips */}
                    <div className="absolute -top-3 left-5 flex gap-1 bg-gray-900/80 backdrop-blur-md rounded-full px-2 py-1 border border-white/10 shadow-xl">
                        {(deck.format?.toLowerCase() === 'standard' ? (deck.colors || []) : deckColors).map(c => {
                            const symbol = c.replace(/[{}]/g, '').replace('/', '');
                            const pipUrl = `/assets/mana/${symbol}.svg`;
                            return (
                                <img
                                    key={c}
                                    src={pipUrl}
                                    alt={symbol}
                                    className="w-4 h-4 shadow-sm"
                                />
                            );
                        })}
                    </div>

                    {/* Deck Grade Badge */}
                    {(deck.ai_blueprint?.grade?.powerLevel > 0 || deck.aiBlueprint?.grade?.powerLevel > 0) && (
                        <div className="absolute -top-3 right-5 flex items-center gap-1.5 bg-gray-900 backdrop-blur-md rounded-full px-3 py-1 border border-white/10 shadow-xl group-hover:border-primary-500/50 transition-colors">
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] font-black uppercase text-primary-400 tracking-wider">B</span>
                                <span className="text-xs font-mono font-bold text-white">
                                    {(deck.ai_blueprint?.grade?.commanderBracket || deck.aiBlueprint?.grade?.commanderBracket) || '?'}
                                </span>
                            </div>
                            <div className="w-px h-2.5 bg-white/10" />
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] font-black uppercase text-teal-400 tracking-wider">PWR</span>
                                <span className="text-xs font-mono font-bold text-white">
                                    {Number(deck.ai_blueprint?.grade?.powerLevel || deck.aiBlueprint?.grade?.powerLevel).toFixed(1)}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="mt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 opacity-80">
                                {identity.badge}
                            </div>

                            {(Number(deck.is_thematic) === 1 || deck.is_thematic === true) && (
                                <div className="flex items-center gap-1 bg-amber-900/40 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                                    <svg className="w-2.5 h-2.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                    <span className="text-[8px] font-bold text-amber-200 uppercase tracking-widest">Thematic</span>
                                </div>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-white leading-tight line-clamp-2 mb-1 group-hover:text-primary-300 transition-colors">
                            {deck.name || 'Untitled Deck'}
                        </h3>
                        <p className="text-xs text-gray-500 font-medium line-clamp-1">
                            {deck.commander_partner
                                ? `${deck.commander?.name} & ${deck.commander_partner?.name}`
                                : (deck.commander?.name || (isCommanderFormat(deck.format) ? 'No Commander' : 'No Spotlight'))}
                        </p>
                    </div>

                    <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Format</span>
                            <span className="text-xs text-gray-300 font-medium">{deck.format || 'Commander'}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Cards</span>
                            <span className={`text-sm font-mono font-bold ${cardCount >= (isCommanderFormat(deck.format) ? 100 : 60) ? 'text-green-500' : 'text-primary-400'}`}>
                                {cardCount}<span className="text-gray-600 text-[10px]">/{isCommanderFormat(deck.format) ? '100' : '60'}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default DeckCard;
