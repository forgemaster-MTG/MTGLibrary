import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';
import { useDecks } from '../hooks/useDecks';
import MultiSelect from '../components/MultiSelect';
import CardSkeleton from '../components/CardSkeleton';
import CardGridItem from '../components/common/CardGridItem';
import AddFromCollectionModal from '../components/modals/AddFromCollectionModal';

const CollectionPage = () => {
    // Parse query params for wishlist mode
    const location = useLocation();
    const isWishlistMode = new URLSearchParams(location.search).get('wishlist') === 'true';

    const { cards, loading, error } = useCollection({ wishlist: isWishlistMode });
    const { decks } = useDecks();
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Modals
    const [isAddCardOpen, setIsAddCardOpen] = useState(false);

    // Filter State
    const [filters, setFilters] = useState({
        colors: [], // ['W', 'U', 'B', 'R', 'G', 'C', 'M']
        rarity: [], // ['common', 'uncommon', 'rare', 'mythic']
        types: [], // ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land']
        sets: [], // set codes
        decks: [] // deck IDs
    });

    // Derived Options
    const setOptions = useMemo(() => {
        const sets = new Set();
        cards.forEach(c => {
            if (c.set && c.set_name) {
                sets.add(JSON.stringify({ value: c.set, label: c.set_name }));
            }
        });
        return Array.from(sets).map(s => JSON.parse(s)).sort((a, b) => a.label.localeCompare(b.label));
    }, [cards]);

    const deckOptions = useMemo(() => {
        return decks.map(d => ({ value: d.id, label: d.name }));
    }, [decks]);

    // Filtering Logic
    const filteredCards = useMemo(() => {
        return cards.filter(card => {
            // Search Term
            const name = card.name || '';
            if (searchTerm && !name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            // Colors (OR logic: show if card matches ANY selected color identity)
            if (filters.colors.length > 0) {
                const cardColors = card.color_identity || [];
                const isMulti = cardColors.length > 1;
                const isColorless = cardColors.length === 0;

                const matchesColor = filters.colors.some(filterColor => {
                    if (filterColor === 'C') return isColorless;
                    if (filterColor === 'M') return isMulti; // 'M' only matches if card is actually multicolor
                    return cardColors.includes(filterColor);
                });

                if (!matchesColor) return false;
            }

            // Rarity
            if (filters.rarity.length > 0) {
                if (!filters.rarity.includes(card.rarity)) return false;
            }

            // Types
            if (filters.types.length > 0) {
                const typeLine = (card.type_line || '').toLowerCase();
                const matchesType = filters.types.some(t => typeLine.includes(t.toLowerCase()));
                if (!matchesType) return false;
            }

            // Sets
            if (filters.sets.length > 0) {
                if (!filters.sets.includes(card.set)) return false;
            }

            // Decks
            if (filters.decks.length > 0) {
                if (!filters.decks.includes(card.deckId)) return false;
            }

            return true;
        });
    }, [cards, searchTerm, filters, decks]);

    // Helpers
    const toggleFilter = (category, value) => {
        setFilters(prev => {
            const current = prev[category];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];
            return { ...prev, [category]: updated };
        });
    };

    return (
        <div className="relative min-h-screen">
            {/* Immersive Background */}
            <div
                className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000"
                style={{ backgroundImage: 'url(/MTG-Forge_Logo_Background.png)' }}
            >
                <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" />
            </div>

            <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-8 space-y-8 animate-fade-in pb-24">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gray-950/40 p-6 rounded-3xl backdrop-blur-md border border-white/5 shadow-xl">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                            {isWishlistMode ? 'My Wishlist' : 'My Collection'}
                        </h1>
                        <p className="text-gray-400 font-medium">
                            {filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'} found • <span className="text-indigo-400">${filteredCards.reduce((acc, c) => acc + (parseFloat(c.prices?.usd || 0) * (c.count || 1)), 0).toFixed(2)}</span> total value
                        </p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={() => setIsAddCardOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Add Cards
                        </button>
                    </div>
                </div>

                {/* Filters & Grid Container */}
                <div className="bg-gray-950/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-2xl">

                    {/* Search & Toggle Filters */}
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Search cards..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-700 text-white px-5 py-3 pl-12 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-500 font-medium"
                            />
                            <svg className="w-5 h-5 text-gray-500 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-5 py-3 rounded-xl border font-bold text-sm flex items-center gap-2 transition-all ${showFilters
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Filters
                        </button>
                    </div>

                    {/* Expandable Filter Panel */}
                    {showFilters && (
                        <div className="mb-8 p-6 bg-gray-900/50 rounded-2xl border border-gray-800 space-y-6 animate-fade-in-down">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                {/* Colors */}
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Colors</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['W', 'U', 'B', 'R', 'G', 'C', 'M'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => toggleFilter('colors', color)}
                                                className={`
                                                    w-8 h-8 rounded-full border flex items-center justify-center transition-all transform hover:scale-110
                                                    ${filters.colors.includes(color) ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900 shadow-lg scale-110' : 'opacity-60 hover:opacity-100'}
                                                    ${color === 'W' ? 'bg-[#F9FAFB] text-gray-900 border-gray-300' : ''}
                                                    ${color === 'U' ? 'bg-[#3B82F6] text-white border-blue-600' : ''}
                                                    ${color === 'B' ? 'bg-[#1F2937] text-white border-gray-600' : ''}
                                                    ${color === 'R' ? 'bg-[#EF4444] text-white border-red-600' : ''}
                                                    ${color === 'G' ? 'bg-[#10B981] text-white border-green-600' : ''}
                                                    ${color === 'C' ? 'bg-gray-400 text-gray-900 border-gray-500' : ''}
                                                    ${color === 'M' ? 'bg-gradient-to-br from-yellow-400 via-red-500 to-purple-600 text-white border-purple-500' : ''}
                                                `}
                                                title={color === 'C' ? 'Colorless' : color === 'M' ? 'Multicolor' : color}
                                            >
                                                {color !== 'M' && color !== 'C' && (
                                                    <img src={`https://svgs.scryfall.io/card-symbols/${color}.svg`} alt={color} className="w-4 h-4" />
                                                )}
                                                {color === 'M' && <span className="font-bold text-xs">M</span>}
                                                {color === 'C' && <span className="font-bold text-xs">C</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Rarity */}
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Rarity</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['common', 'uncommon', 'rare', 'mythic'].map(rarity => (
                                            <button
                                                key={rarity}
                                                onClick={() => toggleFilter('rarity', rarity)}
                                                className={`
                                                    px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all hover:-translate-y-0.5
                                                    ${filters.rarity.includes(rarity)
                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}
                                                `}
                                            >
                                                {rarity}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Types */}
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Types</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => toggleFilter('types', type)}
                                                className={`
                                                     px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all hover:-translate-y-0.5
                                                     ${filters.types.includes(type)
                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}
                                                 `}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Sets & Decks (MultiSelects) */}
                                <div className="col-span-1 space-y-4">
                                    <MultiSelect
                                        label="Filter by Set"
                                        options={setOptions}
                                        selected={filters.sets}
                                        onChange={(val) => setFilters(prev => ({ ...prev, sets: val }))}
                                        placeholder="All Sets"
                                    />
                                    <MultiSelect
                                        label="Filter by Deck"
                                        options={deckOptions}
                                        selected={filters.decks}
                                        onChange={(val) => setFilters(prev => ({ ...prev, decks: val }))}
                                        placeholder="All Decks"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <CardSkeleton key={i} />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-8 rounded-2xl text-center">
                            <h3 className="text-xl font-bold mb-2">Error Loading Collection</h3>
                            <p>{error.message}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {filteredCards.map((card) => (
                                <div key={card.firestoreId || card.id} className="h-full">
                                    <CardGridItem card={card} />
                                </div>
                            ))}

                            {filteredCards.length === 0 && (
                                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                                    <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
                                        <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">No cards found</h3>
                                    <p className="text-gray-400">Try adjusting your search or filters to find what you're looking for.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <AddFromCollectionModal
                isOpen={isAddCardOpen}
                onClose={() => setIsAddCardOpen(false)}
            />
        </div>
    );
};

export default CollectionPage;
