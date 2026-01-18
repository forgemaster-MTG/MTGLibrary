import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCollection } from '../../hooks/useCollection';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { deckService } from '../../services/deckService';
import { useCardModal } from '../../contexts/CardModalContext';

// Helper for color identity check
const isColorIdentityValid = (cardColors, commanderColors) => {
    if (!cardColors || cardColors.length === 0) return true; // Colorless is always allowed
    const commanderColorSet = new Set(commanderColors || []);
    return cardColors.every(c => commanderColorSet.has(c));
};

const AddFromCollectionModal = ({ isOpen, onClose, deck, deckCards = [], onCardAdded }) => {
    const { cards: collection, loading } = useCollection();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { openCardModal } = useCardModal();
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [filters, setFilters] = useState({
        colors: [],
        rarity: [],
        set: '',
        manaValue: ''
    });
    const [sortBy, setSortBy] = useState('name'); // 'name' | 'price-asc' | 'price-desc' | 'rarity'

    // Filter & Sort Logic
    const availableCards = useMemo(() => {
        if (!collection || !deck) return [];

        const isStandard = deck.format?.toLowerCase() === 'standard';
        const commanderColors = deck.commander?.color_identity || [];
        const partnerColors = deck.commander_partner?.color_identity || [];
        const identity = new Set([...commanderColors, ...partnerColors]);

        let filtered = collection.filter(card => {
            // 1. Must be unassigned (no deckId)
            if (card.deckId) return false;

            const isBasic = card.type_line?.toLowerCase().includes('basic land');

            // 2. Color Identity (Deck Legal Check - Commander Only)
            if (!isStandard) {
                if (!isColorIdentityValid(card.color_identity, [...identity])) return false;
            }

            // 3. User Color Filter
            if (filters.colors.length > 0) {
                const cardColors = card.color_identity || [];
                const matchesColor = filters.colors.some(c => {
                    if (c === 'C') return cardColors.length === 0;
                    return cardColors.includes(c);
                });
                if (!matchesColor) return false;
            }

            // 4. Rarity Filter
            if (filters.rarity.length > 0) {
                if (!filters.rarity.includes(card.rarity?.toLowerCase())) return false;
            }

            // 4b. Set Filter (Code or Name)
            if (filters.set) {
                const s = filters.set.toLowerCase();
                if (!card.set?.toLowerCase().includes(s) && !card.set_name?.toLowerCase().includes(s)) return false;
            }

            // 4c. Mana Value Filter
            if (filters.manaValue !== '') {
                const mv = parseFloat(filters.manaValue);
                if (card.cmc !== mv) return false;
            }

            // 5. Deck Limits (Singleton vs 4-of)
            const currentCount = deckCards
                .filter(c => c.name === card.name)
                .reduce((acc, c) => acc + (c.countInDeck || 1), 0);

            // Commander/Singleton: Hide if already in deck (count >= 1)
            // Standard: Limit is 4
            const limit = isStandard ? 4 : 1;

            // User Request: "not show cards already in the deck when in commander view"
            // If not standard (Commander) and count > 0, hide it.
            if (!isBasic && currentCount >= limit) return false;

            // 6. Search Filter
            const term = searchTerm.toLowerCase();
            if (term && !card.name.toLowerCase().includes(term) && !card.type_line?.toLowerCase().includes(term)) return false;

            // 7. Type Filter
            if (typeFilter !== 'All' && !card.type_line?.toLowerCase().includes(typeFilter.toLowerCase())) return false;

            return true;
        });

        // Sorting
        return filtered.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);

            if (sortBy.startsWith('price')) {
                const priceA = parseFloat(a.prices?.usd || a.data?.prices?.usd || 0);
                const priceB = parseFloat(b.prices?.usd || b.data?.prices?.usd || 0);
                return sortBy === 'price-asc' ? priceA - priceB : priceB - priceA;
            }

            if (sortBy === 'rarity') {
                const rarityScore = { mythic: 4, rare: 3, uncommon: 2, common: 1 };
                const scoreA = rarityScore[a.rarity?.toLowerCase()] || 0;
                const scoreB = rarityScore[b.rarity?.toLowerCase()] || 0;
                return scoreB - scoreA;
            }

            return 0;
        });
    }, [collection, deck, deckCards, searchTerm, typeFilter, filters, sortBy]);

    const handleAddCard = async (card, targetBoard = 'mainboard') => {
        try {
            // Clone card with board property for the service
            const cardWithBoard = { ...card, board: targetBoard };
            await deckService.addCardToDeck(currentUser.uid, deck.id, cardWithBoard);

            const boardLabel = targetBoard === 'mainboard' ? 'Mainboard' : targetBoard === 'sideboard' ? 'Sideboard' : 'Maybeboard';
            addToast(`Added ${card.name} to ${boardLabel}`, 'success');

            if (onCardAdded) onCardAdded();
        } catch (err) {
            console.error(err);
            addToast('Failed to add card', 'error');
        }
    };

    if (!isOpen) return null;

    const cardTypes = ['All', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col border border-gray-700">

                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <span className="text-indigo-400">Add from Collection</span>
                            <span className="text-sm font-normal text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
                                {availableCards.length} Available
                            </span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 p-2 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-gray-800 border-b border-gray-700 space-y-4 shrink-0">
                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by name, type, or text..."
                            className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg py-3 px-4 pl-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                        <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>

                    {/* Type Tabs & Advanced Toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-2">
                            {cardTypes.map(type => (
                                <button
                                    key={type}
                                    onClick={() => setTypeFilter(type)}
                                    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors border ${typeFilter === type
                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg border transition-all ${showAdvanced
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg'
                                : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            {showAdvanced ? 'Hide Filters' : 'Advanced Filters'}
                        </button>
                    </div>

                    {/* Advanced Filter Panel */}
                    {showAdvanced && (
                        <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-down shadow-inner">
                            {/* Color Filter */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Color Identity</label>
                                <div className="flex flex-wrap gap-2">
                                    {['W', 'U', 'B', 'R', 'G'].filter(color => {
                                        if (deck?.format?.toLowerCase() === 'standard') return true;
                                        const identity = new Set([...(deck?.commander?.color_identity || []), ...(deck?.commander_partner?.color_identity || [])]);
                                        return identity.has(color);
                                    }).map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setFilters(prev => ({
                                                ...prev,
                                                colors: prev.colors.includes(color) ? prev.colors.filter(c => c !== color) : [...prev.colors, color]
                                            }))}
                                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${filters.colors.includes(color)
                                                ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900 border-white bg-gray-700'
                                                : 'opacity-40 grayscale hover:grayscale-0 hover:opacity-100 border-gray-600 bg-gray-800'
                                                }`}
                                        >
                                            <img src={`https://svgs.scryfall.io/card-symbols/${color}.svg`} alt={color} className="w-5 h-5 shadow-sm" />
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setFilters(prev => ({
                                            ...prev,
                                            colors: prev.colors.includes('C') ? prev.colors.filter(c => c !== 'C') : [...prev.colors, 'C']
                                        }))}
                                        className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-black transition-all ${filters.colors.includes('C')
                                            ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900 border-white bg-indigo-600 text-white'
                                            : 'opacity-40 border-gray-600 bg-gray-800 text-gray-500 hover:opacity-100'
                                            }`}
                                    >
                                        C
                                    </button>
                                </div>
                            </div>

                            {/* Rarity Filter */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Rarity</label>
                                <div className="flex flex-wrap gap-2">
                                    {['common', 'uncommon', 'rare', 'mythic'].map(rarity => (
                                        <button
                                            key={rarity}
                                            onClick={() => setFilters(prev => ({
                                                ...prev,
                                                rarity: prev.rarity.includes(rarity) ? prev.rarity.filter(r => r !== rarity) : [...prev.rarity, rarity]
                                            }))}
                                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg border transition-all ${filters.rarity.includes(rarity)
                                                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                                                : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                                                }`}
                                        >
                                            {rarity.charAt(0)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Set Filter */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Set (Name/Code)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. MH3 or Modern Horizons 3"
                                    value={filters.set}
                                    onChange={(e) => setFilters(prev => ({ ...prev, set: e.target.value }))}
                                    className="w-full bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            {/* Mana Value Filter */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Mana Value</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="CMC"
                                    value={filters.manaValue}
                                    onChange={(e) => setFilters(prev => ({ ...prev, manaValue: e.target.value }))}
                                    className="w-full bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            {/* Sorting */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Sort By</label>
                                <div className="flex flex-wrap gap-2">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 w-full"
                                    >
                                        <option value="name">Name (A-Z)</option>
                                        <option value="price-desc">Price (Highest)</option>
                                        <option value="price-asc">Price (Lowest)</option>
                                        <option value="rarity">Rarity</option>
                                    </select>
                                    <button
                                        onClick={() => {
                                            setFilters({ colors: [], rarity: [], set: '', manaValue: '' });
                                            setSortBy('name');
                                            setSearchTerm('');
                                            setTypeFilter('All');
                                        }}
                                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest mt-1"
                                    >
                                        Reset All
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results - Rich List View */}
                <div className="flex-1 overflow-y-auto bg-gray-950/50 p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                        </div>
                    ) : availableCards.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                            <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                            <p>No cards found matching your criteria.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {availableCards.map((card, idx) => {
                                // Double-sided card handling for images
                                const data = card.data || card;
                                const img = data.image_uris?.art_crop ||
                                    data.image_uris?.normal ||
                                    data.card_faces?.[0]?.image_uris?.art_crop ||
                                    data.card_faces?.[0]?.image_uris?.normal ||
                                    'https://placehold.co/100x100?text=No+Img';

                                const price = parseFloat(card.prices?.[card.finish === 'foil' ? 'usd_foil' : 'usd'] || 0).toFixed(2);

                                return (
                                    <div
                                        key={card.firestoreId || `${card.id}-${idx}`}
                                        className="flex bg-gray-800/60 rounded-xl border border-gray-700/50 hover:bg-gray-800 hover:border-indigo-500/50 transition-all group overflow-hidden h-24 relative"
                                    >
                                        {/* Left Art Slice */}
                                        <div className="w-24 shrink-0 relative overflow-hidden cursor-pointer" onClick={() => openCardModal(card)}>
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-900/90 z-10" />
                                            <img src={img} className="w-full h-full object-cover scale-150 transition-transform duration-700 group-hover:scale-125" alt={card.name} loading="lazy" />
                                            {card.finish === 'foil' && (
                                                <div className="absolute top-1 left-1 z-20 text-yellow-500 bg-black/60 rounded-full p-1 leading-none shadow-sm border border-yellow-500/30" title="Foil">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 flex items-center justify-between px-4 py-2 min-w-0">
                                            <div className="flex flex-col justify-center min-w-0 pr-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-gray-100 text-base truncate cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => openCardModal(card)}>
                                                        {card.name}
                                                    </h3>
                                                    <span className="text-xs font-mono text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700 shrink-0">
                                                        {card.mana_cost || ''}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                                    <span className="truncate">{card.type_line}</span>
                                                    <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                                    <span className="font-mono text-xs uppercase bg-gray-700/50 px-1.5 rounded text-gray-300 border border-gray-600/50">
                                                        {card.set?.toUpperCase()}
                                                    </span>
                                                    {price > 0 && (
                                                        <>
                                                            <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                                            <span className="text-green-400/90 font-mono text-xs font-bold">${price}</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="mt-1.5 flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider bg-gray-900/80 px-2 py-0.5 rounded-full">
                                                        Stack: {card.count || 1}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddCard(card, 'mainboard');
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-indigo-900/20 border border-indigo-500/50 transition-all active:scale-95 flex flex-col items-center min-w-[80px]"
                                                >
                                                    <span className="text-xs font-bold uppercase tracking-wider">Main</span>
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddCard(card, 'sideboard');
                                                    }}
                                                    className="bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white px-4 py-2 rounded-lg shadow-lg border border-gray-600 transition-all active:scale-95 flex flex-col items-center min-w-[80px]"
                                                >
                                                    <span className="text-xs font-bold uppercase tracking-wider">Side</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AddFromCollectionModal;
