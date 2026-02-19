
import React, { useMemo, useState } from 'react';
import { useCollection } from '../hooks/useCollection';
import { Shield, Sparkles, TrendingUp, Gem, Lock, RefreshCw, Share2 } from 'lucide-react';
import SocialShareHub from '../components/Social/SocialShareHub';

// Specialized Card Component with Tilt Effect
const VaultCard = ({ card, rank }) => {
    const [style, setStyle] = useState({});
    const [glareStyle, setGlareStyle] = useState({});
    const [isFlipped, setIsFlipped] = useState(false);

    const isFoil = card.finish === 'foil';
    const isDoubleSided = card.card_faces?.length > 1;

    // Strict Pricing: If foil, prioritize foil price. 
    // If no foil price exists but it is foil, fallback to normal but maybe mark it? 
    // User requested "Use foil / non foil pricing" implying strictness.
    const rawPrice = isFoil
        ? (card.prices?.usd_foil || card.prices?.usd || 0)
        : (card.prices?.usd || 0);

    const price = Number(rawPrice);

    const handleMouseMove = (e) => {
        const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
        const centerX = left + width / 2;
        const centerY = top + height / 2;

        const percentX = (e.clientX - centerX) / (width / 2);
        const percentY = (e.clientY - centerY) / (height / 2);

        // Limit rotation max degrees
        const maxRotate = 12; // degrees

        setStyle({
            transform: `perspective(1000px) rotateY(${percentX * maxRotate}deg) rotateX(${-percentY * maxRotate}deg) scale3d(1.02, 1.02, 1.02)`,
            transition: 'none'
        });

        // Calculate glare position - opposite to mouse
        setGlareStyle({
            opacity: 1,
            background: `radial-gradient(circle at ${50 + (percentX * 50)}% ${50 + (percentY * 50)}%, rgba(255,255,255,0.4) 0%, transparent 50%)`,
            transform: `translateX(${-percentX * 20}px) translateY(${-percentY * 20}px)`
        });
    };

    const handleMouseLeave = () => {
        setStyle({
            transform: 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)',
            transition: 'transform 0.5s ease-out'
        });
        setGlareStyle({ opacity: 0, transition: 'opacity 0.5s ease-out' });
    };

    return (
        <div
            className="relative group w-[300px] h-[480px] select-none cursor-pointer"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchEnd={handleMouseLeave} // Reset tilt on touch release (mobile fix)
            onTouchCancel={handleMouseLeave} // Reset tilt on touch cancel
            onClick={() => isDoubleSided && setIsFlipped(!isFlipped)}
            style={{ zIndex: style.transform?.includes('rotate') ? 50 : 1 }}
        >
            {/* The Slab Container */}
            <div
                className="w-full h-full rounded-[20px] transition-all duration-100 ease-out relative"
                style={{
                    ...style,
                    transformStyle: 'preserve-3d',
                    boxShadow: '0 20px 40px -5px rgba(0,0,0,0.4), 0 10px 20px -5px rgba(0,0,0,0.3)',
                    background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                {/* 1. Outer Frame (Plastic Case Look) */}
                <div className="absolute inset-0 rounded-[20px] ring-1 ring-white/10 ring-inset pointer-events-none" />

                {/* 2. Label Area (PSA Style Header) */}
                <div className="absolute top-2 left-2 right-2 h-14 bg-gray-100 rounded-t-[14px] flex items-center justify-between px-3 shadow-inner border-b border-gray-300 z-20">
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-[8px] font-black uppercase text-gray-400 tracking-wider">MTG Forge Auth</span>
                        <span className="text-xs font-bold text-gray-900 truncate w-40 font-mono tracking-tight">{card.name}</span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{card.range || 'MINT'}</span>
                        <span className="text-lg font-black text-red-600 leading-none">10</span>
                    </div>
                </div>

                {/* 3. Card Well (Inner cutout) */}
                <div className="absolute top-20 left-4 right-4 bottom-4 rounded-[4px] bg-[#111] shadow-[inset_0_0_15px_rgba(0,0,0,1)] flex items-center justify-center p-1 border border-white/5">

                    {/* The Card Image Itself */}
                    <div className="relative w-full h-full rounded-[3.5px] overflow-hidden">
                        <img
                            src={
                                (isDoubleSided && isFlipped
                                    ? (card.card_faces?.[1]?.image_uris?.normal || card.card_faces?.[1]?.image_uris?.large)
                                    : (card.image_uris?.normal || card.image_uris?.large || card.card_faces?.[0]?.image_uris?.normal || card.card_faces?.[0]?.image_uris?.large)
                                )
                            }
                            alt={card.name}
                            className="w-full h-full object-cover"
                        />

                        {/* Foil Overlay */}
                        {isFoil && (
                            <div
                                className="absolute inset-0 z-10 mix-blend-color-dodge opacity-40 pointer-events-none"
                                style={{
                                    background: 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.4) 30%, rgba(255,0,255,0.3) 45%, rgba(0,255,255,0.3) 55%, rgba(255,255,255,0.4) 70%, transparent 80%)',
                                    backgroundSize: '300% 300%',
                                    animation: 'holoShift 5s ease infinite alternate'
                                }}
                            />
                        )}
                        {/* Flip Indicator Overlay (Always visible for clarity) */}
                        {isDoubleSided && (
                            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-lg group-hover:scale-110 transition-transform z-20">
                                <RefreshCw className="w-4 h-4 text-yellow-400" />
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Glass Reflection/Glare Overlay */}
                <div
                    className="absolute inset-0 rounded-[20px] pointer-events-none z-50 mix-blend-overlay"
                    style={{
                        ...glareStyle,
                        transition: 'opacity 0.2s',
                    }}
                />

                {/* 5. Rank Badge (Floating) */}
                <div
                    className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg border-2 border-[#0a0a0a] z-50 text-black font-black text-lg"
                    style={{ transform: 'translateZ(30px)' }}
                >
                    {rank}
                </div>

                {/* 6. Price Tag (Floating) */}
                <div
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-black/90 backdrop-blur-xl rounded-full border border-yellow-500/50 shadow-[0_5px_20px_rgba(0,0,0,0.8)] z-50 flex flex-col items-center"
                    style={{ transform: 'translateZ(40px)' }}
                >
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold leading-none mb-0.5">Market Price</span>
                    <span className="text-lg font-bold text-yellow-500 font-mono tracking-wide leading-none">
                        ${price.toFixed(2)}
                    </span>
                </div>

                {/* Share Button (Floating) */}
                <button
                    onClick={(e) => { e.stopPropagation(); card.onShare && card.onShare(card); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className="absolute -top-3 -right-3 w-12 h-12 md:w-10 md:h-10 bg-gray-900 rounded-full flex items-center justify-center shadow-lg border border-white/20 z-[60] text-primary-400 hover:text-white transition-all hover:scale-110 active:scale-95"
                    title="Share Asset"
                    style={{ transform: 'translateZ(50px)' }}
                >
                    <Share2 className="w-6 h-6 md:w-5 md:h-5" />
                </button>
            </div>

            <style jsx>{`
                @keyframes holoShift {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 100% 50%; }
                }
            `}</style>
        </div>
    );
};

export default function TheVault() {
    const { cards, loading } = useCollection();
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [sharingCard, setSharingCard] = useState(null);

    const stats = useMemo(() => {
        if (!cards) return { topCards: [], totalValue: 0, totalCount: 0, rarityLevel: 'Commoner', percentile: 'Top 100%' };

        const ownedCards = cards.filter(c => !c.is_wishlist && !c.deck_id);
        const totalCount = ownedCards.reduce((acc, c) => acc + (c.count || 1), 0);

        // Calculate total value
        const fullSorted = [...ownedCards].sort((a, b) => {
            const priceA = Number((a.finish === 'foil' ? a.prices?.usd_foil : a.prices?.usd) || 0);
            const priceB = Number((b.finish === 'foil' ? b.prices?.usd_foil : b.prices?.usd) || 0);
            return priceB - priceA;
        });

        const totalVal = ownedCards.reduce((acc, c) => {
            const price = Number((c.finish === 'foil' ? c.prices?.usd_foil : c.prices?.usd) || 0);
            return acc + (price * (c.count || 1));
        }, 0);

        // Top 10 for display
        const top10 = fullSorted.slice(0, 10);

        // Calculate Rarity Level
        const highRarityCount = ownedCards.filter(c => ['rare', 'mythic'].includes(c.rarity?.toLowerCase())).length;
        const rarityPercent = (highRarityCount / ownedCards.length) * 100;
        let rarityLevel = 'Initiate';
        if (rarityPercent > 60) rarityLevel = 'Archivist';
        else if (rarityPercent > 40) rarityLevel = 'Curator';
        else if (rarityPercent > 20) rarityLevel = 'Collector';

        // Calculate Percentile (Simulated MTF-Bench)
        let percentile = 'Top 90%';
        if (totalVal > 50000) percentile = 'Top 0.1%';
        else if (totalVal > 25000) percentile = 'Top 1%';
        else if (totalVal > 10000) percentile = 'Top 5%';
        else if (totalVal > 5000) percentile = 'Top 10%';
        else if (totalVal > 2500) percentile = 'Top 25%';
        else if (totalVal > 1000) percentile = 'Top 50%';

        return {
            topCards: top10,
            totalValue: totalVal,
            totalCount,
            rarityLevel,
            percentile
        };
    }, [cards]);

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-yellow-600 font-mono animate-pulse">ACCESSING VAULT...</div>;

    return (
        <div className="min-h-screen bg-[#050505] overflow-hidden relative font-sans text-gray-200 pb-20">
            {/* Ambient Lighting Background */}
            <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] bg-yellow-600/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary-900/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-[1800px] mx-auto px-8 py-12 relative z-10">
                {/* Header Actions */}
                <div className="flex justify-between items-center mb-16">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)] border border-yellow-400/50">
                            <Lock className="w-8 h-8 text-black" />
                        </div>
                        <div>
                            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                                THE VAULT
                            </h1>
                            <p className="text-yellow-500/60 font-mono tracking-[0.3em] text-sm uppercase mt-1">
                                Secure Storage // Level 5 Clearance
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Vault Asset Value</div>
                            <div className="text-4xl font-black text-white font-mono flex items-center gap-2 justify-end">
                                <span className="text-yellow-500">$</span>
                                {stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>

                        <button
                            onClick={() => setIsShareOpen(true)}
                            className="w-14 h-14 bg-white/5 hover:bg-white/10 text-yellow-500 rounded-2xl flex items-center justify-center border border-white/5 hover:border-yellow-500/50 transition-all group shadow-xl"
                            title="Share Vault"
                        >
                            <Share2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>

                <SocialShareHub
                    isOpen={isShareOpen}
                    onClose={() => setIsShareOpen(false)}
                    type="vault"
                    shareUrl={`${window.location.origin}/share/vault/${cards?.[0]?.user_id || 'player'}`}
                    data={{
                        title: "Asset Vault",
                        win: stats.percentile + " Collector",
                        stats: [
                            { label: "Assets", value: stats.totalCount },
                            { label: "Total Value", value: `$${stats.totalValue.toLocaleString()}`, highlight: true },
                            { label: "Rarity", value: stats.rarityLevel }
                        ]
                    }}
                />

                {/* The Grid - Isometric-ish layout or just a nice grid? Let's do a nice flex wrap with centering */}
                {stats.topCards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 border border-gray-800 rounded-3xl bg-gray-900/30 backdrop-blur">
                        <Gem className="w-16 h-16 text-gray-700 mb-4" />
                        <h3 className="text-2xl font-bold text-gray-500">Vault Empty</h3>
                        <p className="text-gray-600 mt-2">Add cards to your collection to populate the vault.</p>
                    </div>
                ) : (
                    <div className="flex flex-wrap justify-center gap-12 perspective-2000">
                        {stats.topCards.map((card, i) => (
                            <div key={card.id || i} className="transform hover:z-50 transition-all duration-300">
                                <VaultCard
                                    card={{ ...card, onShare: (c) => setSharingCard(c) }}
                                    rank={i + 1}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {sharingCard && (
                <SocialShareHub
                    isOpen={!!sharingCard}
                    onClose={() => setSharingCard(null)}
                    type="card"
                    shareUrl={`${window.location.origin}/card/${sharingCard.id || sharingCard.card_id}`}
                    data={{
                        title: sharingCard.name,
                        win: (sharingCard.rarity || 'Common').toUpperCase() + " Rarity",
                        cardImage: sharingCard.image_uris?.normal || sharingCard.image_uri || sharingCard.data?.image_uris?.normal,
                        stats: [
                            { label: "Type", value: sharingCard.type_line?.split('—')?.[0]?.trim() || 'Spell' },
                            { label: "Cost", value: sharingCard.mana_cost || '0', highlight: true },
                            { label: "Price", value: `$${Number(sharingCard.prices?.usd || 0).toFixed(2)}` }
                        ]
                    }}
                />
            )}

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .perspective-2000 { perspective: 2000px; }
            `}</style>
        </div>
    );
}
