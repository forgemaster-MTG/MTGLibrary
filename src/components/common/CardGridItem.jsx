import React, { useState, memo } from 'react';
import { Share2 } from 'lucide-react';
import { useCardModal } from '../../contexts/CardModalContext';
import LazyImage from './LazyImage';

const CardGridItem = memo(function CardGridItem({ card, availableFoils, onRemove, onShare, showQuantity = true, onClick, decks = [], ownerName, currentUser, showOwnerTag = false, hideDeckTag = false, hideOwnerTag = false, selectMode = false, isSelected = false, onToggleSelect }) {
    const [isFlipped, setIsFlipped] = useState(false);
    const { openCardModal } = useCardModal();

    const deckName = decks?.find(d => d.id === card.deck_id)?.name;
    const resolvedOwnerName = ownerName || card.owner_username || (currentUser && (card.owner_id === currentUser.id || card.user_id === currentUser.id) ? (currentUser.username || 'ME') : null);

    // Helper to get price from card or nested data
    const getPrice = (priceKey) => {
        return parseFloat(card.prices?.[priceKey] || card.data?.prices?.[priceKey]) || 0;
    };

    // Helpers to get images
    const getCardImage = (c, faceIndex = 0) => {
        if (!c) return 'https://placehold.co/250x350?text=No+Image';
        const data = c.data || c;

        // Check face specific image first (Transform/MDFC)
        if (data.card_faces && data.card_faces.length > 1 && data.card_faces[faceIndex]?.image_uris?.normal) {
            return data.card_faces[faceIndex].image_uris.normal;
        }

        // Fallback to top-level image (Split cards, Adventures, or Face 0 of simple cards)
        return data.image_uris?.normal || c.image_uri || 'https://placehold.co/250x350?text=No+Image';
    };

    const hasBackFace = (card.data?.card_faces?.length > 1 && card.data?.card_faces?.[1]?.image_uris) ||
        (card.card_faces?.length > 1 && card.card_faces?.[1]?.image_uris);
    const frontImage = getCardImage(card, 0);
    const backImage = hasBackFace ? getCardImage(card, 1) : null;

    // Normalize quantity
    const quantity = card.countInDeck || card.quantity || card.count || 1;

    const handleClick = (e) => {
        e.stopPropagation();
        if (selectMode && onToggleSelect) {
            onToggleSelect(card.id);
            return;
        }
        if (onClick) {
            onClick(card);
        } else {
            openCardModal(card);
        }
    };

    return (
        <div
            className={`relative group perspective-1000 h-full w-full aspect-[2.5/3.5] min-h-[200px] cursor-pointer ${isSelected ? 'ring-4 ring-indigo-500 rounded-xl' : ''}`}
            onClick={handleClick}
        >
            <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>

                {/* Front Face */}
                <div className="absolute inset-0 w-full h-full backface-hidden rounded-lg overflow-hidden shadow-md bg-gray-950/40 backdrop-blur-md border border-white/5 bg-cover bg-center" style={{ backgroundImage: `url('/card-back.jpg')` }}>
                    <LazyImage
                        src={frontImage}
                        alt={card.name}
                        className="w-full h-full rounded-lg"
                    />

                    {/* Badges (Front only) */}
                    {showQuantity && quantity > 1 && (
                        <div className="absolute top-1.5 right-1.5 bg-black/80 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-gray-600 shadow-sm z-20">
                            x{quantity}
                        </div>
                    )}

                    {/* Deck Tag - Moved down to not cover name */}
                    {!hideDeckTag && deckName && (
                        <div className="absolute top-[3.75rem] left-1.5 max-w-[80%] bg-indigo-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg z-20 backdrop-blur-md border border-indigo-400/50 truncate uppercase tracking-tight" title={`In deck: ${deckName}`}>
                            ♟️ {deckName}
                        </div>
                    )}

                    {/* Owner Tag - Moved below deck tag or top left area */}
                    {!hideOwnerTag && showOwnerTag && resolvedOwnerName && (
                        <div className={`absolute ${deckName ? 'top-[5.25rem]' : 'top-[3.75rem]'} left-1.5 bg-gray-950/90 text-white text-[11px] font-black px-2 py-0.5 rounded border border-white/20 shadow-xl z-20 backdrop-blur-md uppercase tracking-wider`}>
                            👤 {resolvedOwnerName}
                        </div>
                    )}
                    {card.finish === 'foil' ? (
                        <div className="absolute top-1.5 left-1.5 bg-yellow-500/80 text-yellow-100 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-20 backdrop-blur-sm border border-yellow-300/50">★</div>
                    ) : card.is_wishlist ? (
                        <div className="absolute top-1.5 left-1.5 bg-orange-600/90 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md z-20 backdrop-blur-sm border border-orange-400/50 flex items-center gap-1">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                            WISH
                        </div>
                    ) : availableFoils?.has(card.name) && (
                        <div className="absolute top-1.5 left-1.5 bg-gray-700/90 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-20 backdrop-blur-sm border border-yellow-500/30 cursor-help" title="Foil copy available in collection">☆</div>
                    )}

                    {/* Price Bar (Bottom) */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-white/10 z-20 text-[9px] font-mono flex items-center justify-center">
                        <span className={card.finish === 'foil' ? 'text-yellow-400' : 'text-green-400'}>
                            ${(card.finish === 'foil' ? getPrice('usd_foil') || getPrice('usd') : getPrice('usd') || getPrice('usd_foil')).toFixed(2)}
                        </span>
                    </div>

                    {/* Selection Overlay */}
                    {selectMode && (
                        <div className={`absolute inset-0 z-40 transition-all duration-200 flex items-center justify-center ${isSelected ? 'bg-indigo-500/20' : 'bg-black/40 hover:bg-black/20'}`}>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all scale-110 ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-white/50 bg-black/40'}`}>
                                {isSelected && (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Hover Overlay - Hide in select mode */}
                    {!selectMode && (
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30">
                            {/* Top subtle gradient to darken card slightly */}
                            <div className="absolute inset-0 bg-black/20"></div>

                            {/* Bottom info bar */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-3 pt-6">
                                {/* Card Name */}
                                <p className="font-black text-sm text-white leading-tight line-clamp-1 drop-shadow-lg mb-2">{card.name}</p>

                                {/* Price */}
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1 backdrop-blur-md ${card.finish === 'foil' ? 'bg-yellow-500/20 border-yellow-500/40' : 'bg-green-500/20 border-green-500/40'}`}>
                                        <svg className={`w-3 h-3 ${card.finish === 'foil' ? 'text-yellow-400' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className={`text-xs font-bold font-mono ${card.finish === 'foil' ? 'text-yellow-400' : 'text-green-400'}`}>
                                            ${(card.finish === 'foil' ? getPrice('usd_foil') || getPrice('usd') : getPrice('usd') || getPrice('usd_foil')).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={handleClick}
                                        className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 shadow-lg hover:shadow-indigo-500/50 active:scale-95"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        <span className="text-[10px] uppercase tracking-wider font-black">View</span>
                                    </button>

                                    {hasBackFace && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
                                            className="bg-gray-700/90 hover:bg-gray-600 text-white p-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-gray-500/30 active:scale-95"
                                            title="Flip"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>
                                    )}

                                    {onRemove && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRemove(card.managedId || card.id, card.name); }}
                                            className="bg-red-600/90 hover:bg-red-500 text-white p-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-500/50 active:scale-95"
                                            title="Remove"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onShare && onShare(card); }}
                                        className="bg-purple-600/90 hover:bg-purple-500 text-white p-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/50 active:scale-95"
                                        title="Share Card"
                                    >
                                        <Share2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Back Face */}
                {hasBackFace && (
                    <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-lg overflow-hidden shadow-md bg-gray-950/40 backdrop-blur-md border border-white/5 bg-cover bg-center" style={{ backgroundImage: `url('/card-back.jpg')` }}>
                        <LazyImage
                            src={backImage}
                            alt={`${card.name} (Back)`}
                            className="w-full h-full rounded-lg"
                        />
                        {/* Hover Overlay Back */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-center items-center gap-2 p-2 backdrop-blur-sm z-30">
                            <div className="text-center">
                                <p className="font-bold text-xs text-white line-clamp-2">{card.name}</p>
                            </div>
                            <div className="text-indigo-300 text-xs font-bold uppercase tracking-wider bg-indigo-900/50 px-2 py-1 rounded border border-indigo-500/30">
                                Click to Flip
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default CardGridItem;
