import React, { useState } from 'react';
import { useCardModal } from '../../contexts/CardModalContext';

const InteractiveCard = ({ card, normalCount = 0, foilCount = 0, wishlistCount = 0, onUpdateCount, onUpdateWishlistCount }) => {
    const { openCardModal } = useCardModal();
    const [isFlipped, setIsFlipped] = useState(false);

    // Image Helpers
    const getCardImage = (c, faceIndex = 0) => {
        if (!c) return 'https://placehold.co/250x350?text=No+Image';
        const data = c.data || c;
        if (data.card_faces && data.card_faces.length > 1) {
            return data.card_faces[faceIndex]?.image_uris?.normal || 'https://placehold.co/250x350?text=No+Image';
        }
        return data.image_uris?.normal || c.image_uri || 'https://placehold.co/250x350?text=No+Image';
    };

    const hasBackFace = (card.data?.card_faces?.length > 1) || (card.card_faces?.length > 1);
    const frontImage = getCardImage(card, 0);
    const backImage = hasBackFace ? getCardImage(card, 1) : null;

    const handleViewDetails = (e) => {
        e.stopPropagation();
        openCardModal(card);
    };

    const handleUpdate = (e, type, delta) => {
        e.stopPropagation();
        if (onUpdateCount) {
            onUpdateCount(card, type, delta);
        }
    };

    return (
        <div className="group relative flex bg-gray-900/60 backdrop-blur-md rounded-xl overflow-hidden shadow-2xl border border-white/5 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(79,70,229,0.15)] aspect-[3.2/3.5]">
            {/* Aspect ratio [3.2/3.5] means Image (2.5) + Controls (0.7) = 3.2 Width, 3.5 Height.
                This ensures the image side is a perfect 2.5/3.5 MTG ratio. */}

            {/* Left Side: Card Image (Perfect 2.5:3.5 Ratio) */}
            <div
                className="relative aspect-[2.5/3.5] h-full cursor-pointer overflow-hidden bg-gray-950 shrink-0"
                onClick={handleViewDetails}
            >
                <div className={`relative w-full h-full transition-all duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                    {/* Front Face */}
                    <div className="absolute inset-0 backface-hidden">
                        <img
                            src={frontImage}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        {/* Hover Glow Effect */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-indigo-500/20 to-transparent transition-opacity duration-500" />
                    </div>

                    {/* Back Face */}
                    {hasBackFace && (
                        <div className="absolute inset-0 backface-hidden rotate-y-180">
                            <img
                                src={backImage || frontImage}
                                alt={`${card.name} Back`}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                </div>

                {/* Flip Button Overlay */}
                {hasBackFace && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
                        className="absolute bottom-2 left-2 p-2 bg-black/60 hover:bg-indigo-600 text-white rounded-full backdrop-blur-md transition-all z-10 opacity-0 group-hover:opacity-100 shadow-lg border border-white/10"
                        title="Flip Card"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                )}
            </div>

            {/* Right Side: Integrated Controls Panel */}
            <div className="flex-1 bg-black/40 flex flex-col justify-between py-1 border-l border-white/5 relative">
                {/* Each section is high-density */}

                {/* Normal Section */}
                <div className="flex flex-col items-center flex-1 justify-center relative hover:bg-white/5 transition-colors group/sec">
                    <button
                        onClick={(e) => handleUpdate(e, 'normal', 1)}
                        className="p-1.5 text-gray-500 hover:text-white transition-all transform hover:scale-125"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-lg font-black text-white tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">{normalCount}</span>
                        <span className="text-[8px] font-black uppercase text-gray-600 tracking-[0.2em] -mt-1">Normal</span>
                    </div>
                    <button
                        onClick={(e) => handleUpdate(e, 'normal', -1)}
                        className="p-1.5 text-gray-500 hover:text-white transition-all transform hover:scale-125 disabled:opacity-0"
                        disabled={normalCount <= 0}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>

                <div className="h-[1px] bg-white/5 mx-2" />

                {/* Foil Section */}
                <div className="flex flex-col items-center flex-1 justify-center relative hover:bg-indigo-500/5 transition-colors group/sec">
                    <button
                        onClick={(e) => handleUpdate(e, 'foil', 1)}
                        className="p-1.5 text-indigo-400/60 hover:text-indigo-300 transition-all transform hover:scale-125"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-lg font-black text-indigo-400 tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">{foilCount}</span>
                        <span className="text-[8px] font-black uppercase text-indigo-600 tracking-[0.2em] -mt-1">Foil</span>
                    </div>
                    <button
                        onClick={(e) => handleUpdate(e, 'foil', -1)}
                        className="p-1.5 text-indigo-400/60 hover:text-indigo-300 transition-all transform hover:scale-125 disabled:opacity-0"
                        disabled={foilCount <= 0}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>

                <div className="h-[1px] bg-white/5 mx-2" />

                {/* Wishlist Section */}
                <div className="flex flex-col items-center flex-1 justify-center relative hover:bg-orange-500/5 transition-colors group/sec">
                    <button
                        onClick={(e) => { e.stopPropagation(); if (onUpdateWishlistCount) onUpdateWishlistCount(card, 1); }}
                        className="p-1.5 text-orange-400/60 hover:text-orange-300 transition-all transform hover:scale-125"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-lg font-black text-orange-400 tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">{wishlistCount}</span>
                        <span className="text-[8px] font-black uppercase text-orange-600 tracking-[0.2em] -mt-1">Wish</span>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); if (onUpdateWishlistCount) onUpdateWishlistCount(card, -1); }}
                        className="p-1.5 text-orange-400/60 hover:text-orange-300 transition-all transform hover:scale-125 disabled:opacity-0"
                        disabled={wishlistCount <= 0}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InteractiveCard;
