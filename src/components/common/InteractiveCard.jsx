import React, { useState, memo } from 'react';
import { useCardModal } from '../../contexts/CardModalContext';

const InteractiveCard = memo(function InteractiveCard({ card, normalCount = 0, foilCount = 0, wishlistCount = 0, onUpdateCount, onUpdateWishlistCount, ownerName, currentUser, showOwnerTag = false }) {
    const { openCardModal } = useCardModal();
    const [isFlipped, setIsFlipped] = useState(false);

    const resolvedOwnerName = ownerName || card.owner_username || (currentUser && (card.owner_id === currentUser.id || card.user_id === currentUser.id) ? (currentUser.username || 'ME') : null);

    // Image Helpers
    const getCardImage = (c, faceIndex = 0) => {
        if (!c) return 'https://placehold.co/250x350?text=No+Image';
        const data = c.data || c;
        if (data.card_faces && data.card_faces.length > 1) {
            return data.card_faces[faceIndex]?.image_uris?.normal || c.image_uri || 'https://placehold.co/250x350?text=No+Image';
        }
        return data.image_uris?.normal || c.image_uri || 'https://placehold.co/250x350?text=No+Image';
    };

    const faces = card.data?.card_faces || card.card_faces;
    const hasBackFace = faces?.length > 1 && !!faces[1].image_uris;
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

    const isOwned = (normalCount + foilCount) > 0;
    const isMissingWishlist = !isOwned && wishlistCount > 0;

    // Choose the price mostly likely to be relevant for a single display if needed, 
    // but we use the dual display below.
    const price = card.finish === 'foil' ? (card.prices?.usd_foil || card.prices?.usd) : (card.prices?.usd || card.prices?.usd_foil) || '---';

    return (
        <div className={`group relative flex bg-gray-900/60 backdrop-blur-md rounded-xl overflow-hidden shadow-2xl border transition-all duration-300 hover:shadow-[0_0_30px_rgba(79,70,229,0.15)] aspect-[3.2/3.5] perspective-1000 ${isOwned ? 'border-indigo-500/30' : 'border-white/5 grayscale-[0.8] opacity-70 hover:grayscale-0 hover:opacity-100'}`}>
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

                {/* Flip Button - Top Left (Always Available) */}
                {hasBackFace && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
                        className="absolute top-2 left-2 p-2 bg-black/60 hover:bg-indigo-600 text-white rounded-full backdrop-blur-md transition-all z-30 shadow-lg border border-white/10"
                        title="Flip Card"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                )}

                {/* Wishlist Badge - Top Left (Offset if flip button is present) */}
                {isMissingWishlist && (
                    <div className={`absolute top-2 ${hasBackFace ? 'left-12' : 'left-2'} z-20 bg-orange-500 text-white p-1 rounded-md shadow-lg animate-pulse`}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </div>
                )}

                {/* Owner Tag (Left side, moved down to avoid name) */}
                {showOwnerTag && resolvedOwnerName && isOwned && (
                    <div className={`absolute ${hasBackFace || isMissingWishlist ? 'top-16' : 'top-12'} left-2 bg-gray-950/90 text-white text-[11px] font-black px-2 py-0.5 rounded border border-white/20 shadow-xl z-30 backdrop-blur-md uppercase tracking-wider`}>
                        👤 {resolvedOwnerName}
                    </div>
                )}

                {/* Price Display - Bottom Center */}
                <div className="absolute bottom-2 right-2 left-2 z-10 font-mono">
                    <div className="bg-black/80 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden">
                        {/* Metadata Header */}
                        <div className="flex items-center justify-between px-3 py-1 bg-white/5 border-b border-white/5 text-xs font-black tracking-wider text-gray-300">
                            <span>{card.set?.toUpperCase()}</span>
                            <span>#{card.collector_number}</span>
                        </div>
                        {/* Pricing Row */}
                        <div className="flex items-center justify-around px-2 py-1.5 text-[11px]">
                            <span className="text-gray-300">${(parseFloat(card.prices?.usd) || 0).toFixed(2)}</span>
                            <div className="h-3 w-[1px] bg-white/20" />
                            <span className="text-yellow-400 font-bold">${(parseFloat(card.prices?.usd_foil) || 0).toFixed(2)} ★</span>
                        </div>
                    </div>
                </div>
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
});

export default InteractiveCard;
