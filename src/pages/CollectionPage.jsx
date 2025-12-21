import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';
import { useDecks } from '../hooks/useDecks';
import MultiSelect from '../components/MultiSelect';
import CardSkeleton from '../components/CardSkeleton';
import CardGridItem from '../components/common/CardGridItem';

const CollectionPage = () => {
    const { cards, loading, error } = useCollection();
    const { decks } = useDecks();
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

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
            // Note: Scryfall 'color_identity' is array ['W', 'U']. 
            // 'C' checks for empty array. 'M' checks for length > 1.
            if (filters.colors.length > 0) {
                const cardColors = card.color_identity || [];
                const isMulti = cardColors.length > 1;
                const isColorless = cardColors.length === 0;

                const matchesColor = filters.colors.some(filterColor => {
                    if (filterColor === 'C') return isColorless;
                    if (filterColor === 'M') return isMulti; // 'M' only matches if card is actually multicolor
                    return cardColors.includes(filterColor);
                });

                // If user selected 'M' but not specific colors, we show all multicolor.
                // If user selected 'R', we show all Red cards (including multicolor red).
                // The above 'some' works well for this.
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
                // If filtering by Decks, we check if this card instance belongs to one of the selected decks.
                // Since we use strict "Split Stack", this is easy: card.deckId must match.
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-white">My Collection</h1>

                {/* Search Bar & Filter Toggle */}
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-80">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-md leading-5 bg-gray-800 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-700 focus:border-indigo-500 transition duration-150 ease-in-out sm:text-sm"
                            placeholder="Search cards..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-3 py-2 rounded-md border transition-colors flex items-center gap-2 ${showFilters ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        Filters
                    </button>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700 gap-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in-down">

                    {/* Colors */}
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-400 mb-2">Colors</label>
                        <div className="flex flex-wrap gap-2">
                            {['W', 'U', 'B', 'R', 'G', 'C', 'M'].map(color => (
                                <button
                                    key={color}
                                    onClick={() => toggleFilter('colors', color)}
                                    className={`
                                        w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm transition-transform hover:scale-105
                                        ${filters.colors.includes(color) ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-800' : 'opacity-70 hover:opacity-100'}
                                        ${color === 'W' ? 'bg-[#F9FAFB] text-gray-900 border-gray-300' : ''}
                                        ${color === 'U' ? 'bg-[#3B82F6] text-white border-blue-600' : ''}
                                        ${color === 'B' ? 'bg-[#1F2937] text-white border-gray-900' : ''}
                                        ${color === 'R' ? 'bg-[#EF4444] text-white border-red-600' : ''}
                                        ${color === 'G' ? 'bg-[#10B981] text-white border-green-600' : ''}
                                        ${color === 'C' ? 'bg-gray-400 text-gray-900 border-gray-500' : ''}
                                        ${color === 'M' ? 'bg-gradient-to-br from-yellow-400 via-red-500 to-purple-600 text-white border-purple-500' : ''}
                                    `}
                                    title={color === 'C' ? 'Colorless' : color === 'M' ? 'Multicolor' : color}
                                >
                                    {color}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rarity */}
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-400 mb-2">Rarity</label>
                        <div className="flex flex-wrap gap-2">
                            {['common', 'uncommon', 'rare', 'mythic'].map(rarity => (
                                <button
                                    key={rarity}
                                    onClick={() => toggleFilter('rarity', rarity)}
                                    className={`
                                        px-3 py-1 rounded text-xs font-bold uppercase border transition-colors
                                        ${filters.rarity.includes(rarity)
                                            ? 'bg-indigo-600 border-indigo-500 text-white'
                                            : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}
                                    `}
                                >
                                    {rarity}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Types */}
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-400 mb-2">Types</label>
                        <div className="flex flex-wrap gap-2">
                            {['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => toggleFilter('types', type)}
                                    className={`
                                         px-2 py-1 rounded text-xs border transition-colors
                                         ${filters.types.includes(type)
                                            ? 'bg-indigo-600 border-indigo-500 text-white'
                                            : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}
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
            )}

            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : error ? (
                <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg">
                    Error loading collection: {error.message}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredCards.map((card) => (
                        <div key={card.firestoreId || card.id} className="h-full">
                            <CardGridItem card={card} />
                        </div>
                    ))}

                    {filteredCards.length === 0 && (
                        <div className="col-span-full text-center text-gray-500 py-12">
                            No cards found matching "{searchTerm}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CollectionPage;
