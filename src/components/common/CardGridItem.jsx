import React, { useState } from 'react';
import { useCardModal } from '../../contexts/CardModalContext';

const CardGridItem = ({ card, availableFoils, onRemove, showQuantity = true }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const { openCardModal } = useCardModal();

    // Helpers to get images
    const getCardImage = (c, faceIndex = 0) => {
        if (!c) return 'https://placehold.co/250x350?text=No+Image';
        const data = c.data || c;
        // Check faces
        if (data.card_faces && data.card_faces.length > 1) {
            return data.card_faces[faceIndex]?.image_uris?.normal || 'https://placehold.co/250x350?text=No+Image';
        }
        // Normal
        return data.image_uris?.normal || c.image_uri || 'https://placehold.co/250x350?text=No+Image';
    };

    const hasBackFace = (card.data?.card_faces?.length > 1) || (card.card_faces?.length > 1);
    const frontImage = getCardImage(card, 0);
    const backImage = hasBackFace ? getCardImage(card, 1) : null;

    // Normalize quantity
    const quantity = card.countInDeck || card.quantity || card.count || 1;

    const handleClick = (e) => {
        e.stopPropagation();
        openCardModal(card);
    };

    return (
        <div
            className={`relative group perspective-1000 h-full w-full aspect-[2.5/3.5] min-h-[200px] cursor-pointer`}
            onClick={handleClick}
        >
            <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>

                {/* Front Face */}
                <div className="absolute inset-0 w-full h-full backface-hidden rounded-lg overflow-hidden shadow-md bg-gray-900 border border-gray-700 bg-cover bg-center" style={{ backgroundImage: `url('/card-back.jpg')` }}>
                    <img
                        src={frontImage}
                        alt={card.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />

                    {/* Badges (Front only) */}
                    {showQuantity && quantity > 1 && (
                        <div className="absolute top-1.5 right-1.5 bg-black/80 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-gray-600 shadow-sm z-20">
                            x{quantity}
                        </div>
                    )}
                    {card.finish === 'foil' ? (
                        <div className="absolute top-1.5 left-1.5 bg-yellow-500/80 text-yellow-100 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-20 backdrop-blur-sm border border-yellow-300/50">★</div>
                    ) : availableFoils?.has(card.name) && (
                        <div className="absolute top-1.5 left-1.5 bg-gray-700/90 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-20 backdrop-blur-sm border border-yellow-500/30 cursor-help" title="Foil copy available in collection">☆</div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col justify-center items-center gap-2 p-2 backdrop-blur-sm z-30">
                        <div className="text-center">
                            <p className="font-bold text-xs text-white line-clamp-2">{card.name}</p>
                            <p className="text-green-400 text-xs font-mono mt-1">${(parseFloat(card.prices?.usd) || 0).toFixed(2)}</p>
                        </div>

                        <div className="flex gap-2">
                            <div className="text-indigo-300 text-xs font-bold uppercase tracking-wider bg-indigo-900/50 px-2 py-1 rounded border border-indigo-500/30">
                                View Details
                            </div>
                            {hasBackFace && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
                                    className="text-indigo-300 hover:text-white bg-indigo-900/50 hover:bg-indigo-700 p-1 rounded-full border border-indigo-500/30 transition-colors"
                                    title="Quick Flip"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                            )}
                            {onRemove && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove(card.firestoreId || card.id, card.name); }}
                                    className="text-red-400 hover:text-white hover:bg-red-600 p-2 rounded-full transition-colors"
                                    title="Remove card"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Back Face */}
                {hasBackFace && (
                    <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-lg overflow-hidden shadow-md bg-gray-900 border border-gray-700 bg-cover bg-center" style={{ backgroundImage: `url('/card-back.jpg')` }}>
                        <img
                            src={backImage}
                            alt={`${card.name} (Back)`}
                            className="w-full h-full object-cover"
                            loading="lazy"
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
};

export default CardGridItem;
