import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDecks } from '../hooks/useDecks';
import { deckService } from '../services/deckService';
import { useToast } from '../contexts/ToastContext';

const MTG_IDENTITY_REGISTRY = [
    { badge: "White", colors: ["W"] },
    { badge: "Blue", colors: ["U"] },
    { badge: "Black", colors: ["B"] },
    { badge: "Red", colors: ["R"] },
    { badge: "Green", colors: ["G"] },
    { badge: "Azorius", colors: ["W", "U"] },
    { badge: "Dimir", colors: ["U", "B"] },
    { badge: "Rakdos", colors: ["B", "R"] },
    { badge: "Gruul", colors: ["R", "G"] },
    { badge: "Selesnya", colors: ["G", "W"] },
    { badge: "Orzhov", colors: ["W", "B"] },
    { badge: "Izzet", colors: ["U", "R"] },
    { badge: "Golgari", colors: ["B", "G"] },
    { badge: "Boros", colors: ["R", "W"] },
    { badge: "Simic", colors: ["G", "U"] },
    { badge: "Esper", colors: ["W", "U", "B"] },
    { badge: "Grixis", colors: ["U", "B", "R"] },
    { badge: "Jund", colors: ["B", "R", "G"] },
    { badge: "Naya", colors: ["R", "G", "W"] },
    { badge: "Bant", colors: ["G", "W", "U"] },
    { badge: "Abzan", colors: ["W", "B", "G"] },
    { badge: "Jeskai", colors: ["U", "R", "W"] },
    { badge: "Sultai", colors: ["B", "G", "U"] },
    { badge: "Mardu", colors: ["R", "W", "B"] },
    { badge: "Temur", colors: ["G", "U", "R"] },
    { badge: "Glint-Eye", colors: ["U", "B", "R", "G"] },
    { badge: "Dune-Brood", colors: ["W", "B", "R", "G"] },
    { badge: "Ink-Treader", colors: ["W", "U", "R", "G"] },
    { badge: "Witch-Maw", colors: ["W", "U", "B", "G"] },
    { badge: "Yore-Tiller", colors: ["W", "U", "B", "R"] },
    { badge: "WUBRG", colors: ["W", "U", "B", "R", "G"] },
    { badge: "Colorless", colors: ["C"] }
];

const DecksPage = () => {
    const { decks, loading, error, refresh } = useDecks();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const handleDelete = async (e, deckId) => {
        e.preventDefault();
        if (window.confirm('Are you sure you want to delete this deck? Cards inside will be returned to your collection binder.')) {
            try {
                await deckService.deleteDeck(null, deckId);
                addToast('Deck deleted', 'success');
                window.location.reload();
            } catch (err) {
                console.error(err);
                addToast('Failed to delete deck', 'error');
            }
        }
    };

    // Robust Image Helper (Shared logic with DeckDetailsPage)
    const getArtCrop = (commander) => {
        if (!commander) return null;
        const data = commander.data || commander;

        if (data.image_uris?.art_crop) return data.image_uris.art_crop;
        if (data.card_faces?.[0]?.image_uris?.art_crop) return data.card_faces[0].image_uris.art_crop;
        // Fallback to normal if art_crop missing
        if (data.image_uris?.normal) return data.image_uris.normal;

        return null;
    };

    // Color Helpers
    const getDeckColors = (deck) => {
        const mainColors = deck?.commander?.color_identity || [];
        const partnerColors = deck?.commander_partner?.color_identity || [];
        const unique = [...new Set([...mainColors, ...partnerColors])];
        return unique.length > 0 ? unique : ['C']; // Default to Colorless 'C' if empty
    };

    const getIdentityBadge = (colors) => {
        const match = MTG_IDENTITY_REGISTRY.find(entry => {
            if (entry.badge === 'Colorless' && (colors.length === 0 || (colors.length === 1 && colors[0] === 'C'))) return true;
            if (entry.colors.length !== colors.length) return false;
            return entry.colors.every(c => colors.includes(c));
        });
        return match ? match.badge : 'Commander';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-950">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-6 rounded-2xl backdrop-blur-md">
                    <h3 className="text-xl font-bold mb-2">Error Loading Decks</h3>
                    <p>{error.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
                <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">My Decks</h1>
                        <p className="text-gray-400 font-medium">Manage your collection of strategies</p>
                    </div>
                    <Link
                        to="/decks/new"
                        className="group bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 border border-indigo-400/20 hover:border-indigo-400"
                    >
                        <span className="text-xl leading-none font-light">+</span>
                        Create New Deck
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
                    {decks.map((deck) => {
                        const deckColors = getDeckColors(deck);
                        const identityName = getIdentityBadge(deckColors);
                        const cardCount = Object.keys(deck.cards || {}).length;
                        const mainImage = getArtCrop(deck.commander);
                        const partnerImage = getArtCrop(deck.commander_partner);

                        return (
                            <Link to={`/decks/${deck.id}`} key={deck.id} className="group relative flex flex-col h-[420px] rounded-3xl transition-all duration-300 hover:-translate-y-2">
                                {/* Glass Container */}
                                <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl group-hover:border-indigo-500/50 group-hover:shadow-indigo-500/20 transition-all overflow-hidden">

                                    {/* Image Area */}
                                    <div className="h-[60%] w-full relative overflow-hidden bg-gray-950">
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
                                    <div className="h-[40%] p-5 flex flex-col justify-between relative">
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
                                                {identityName}
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
                    })}

                    {decks.length === 0 && (
                        <div className="col-span-full py-32 flex flex-col items-center justify-center text-center bg-gray-900/20 rounded-3xl border border-dashed border-gray-800">
                            <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-300 mb-2">Start Your Journey</h3>
                            <p className="text-gray-500 mb-8 max-w-md">You haven't built any decks yet. Create your first commander deck to get started.</p>
                            <Link to="/decks/new" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                                Create Deck
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DecksPage;
