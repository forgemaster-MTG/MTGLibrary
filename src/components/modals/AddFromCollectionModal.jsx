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

const AddFromCollectionModal = ({ isOpen, onClose, deck, deckCards = [] }) => {
    const { cards: collection, loading } = useCollection();
    const { currentUser } = useAuth();
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

            const limit = isStandard ? 4 : 1;
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

    const handleAddCard = async (card) => {
        try {
            await deckService.addCardToDeck(currentUser.uid, deck.id, card);
            addToast(`Added ${card.name} to deck`, 'success');
            // Optimistic update handled by parent usually, but we might want to remove from availableCards visually?
            // The hook useCollection might not update immediately if it's not subscribed to deck changes, 
            // but useDeck in parent will update the deckCards list, which will trigger re-filtering here!
        } catch (err) {
            console.error(err);
            addToast('Failed to add card', 'error');
        }
    };

    if (!isOpen) return null;

    const cardTypes = ['All', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-gray-700">

                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-indigo-400">Add from Collection</span>
                            <span className="text-sm font-normal text-gray-400">({availableCards.length} available)</span>
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">Showing unassigned cards compatible with this deck.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 p-2 rounded-lg">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-gray-800 border-b border-gray-700 space-y-4">
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

                {/* Results - List View for density */}
                <div className="flex-1 overflow-y-auto bg-gray-900/30 p-2 custom-scrollbar">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {availableCards.map(card => {
                                // Double-sided card handling for images
                                const data = card.data || card;
                                const img = data.image_uris?.art_crop ||
                                    data.image_uris?.normal ||
                                    data.card_faces?.[0]?.image_uris?.art_crop ||
                                    data.card_faces?.[0]?.image_uris?.normal ||
                                    'https://placehold.co/100x100?text=No+Img';
                                return (
                                    <div
                                        key={card.firestoreId || card.id}
                                        className="flex items-center gap-3 p-2 bg-gray-800/80 rounded-lg border border-gray-700/50 hover:bg-gray-700 hover:border-indigo-500/50 transition-all group cursor-pointer"
                                        onClick={() => openCardModal(card)}
                                    >

                                        {/* Image thumbnail */}
                                        <div className="relative w-16 h-12 rounded overflow-hidden shrink-0 shadow-sm">
                                            <img src={img} className="w-full h-full object-cover" alt={card.name} loading="lazy" />
                                            {card.finish === 'foil' && (
                                                <div className="absolute top-0.5 right-0.5 text-yellow-500 bg-black/40 rounded-full p-0.5 leading-none" title="Foil">
                                                    <span className="text-[10px]">★</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-xs font-mono font-bold bg-gray-900 px-1 rounded">{card.count || 1}x</span>
                                                <h4 className="font-bold text-gray-200 text-sm truncate">{card.name}</h4>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <span className="truncate max-w-[120px]">{card.type_line}</span>
                                                <span className="bg-gray-700 px-1 rounded text-[10px]">{card.set?.toUpperCase()}</span>
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddCard(card);
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg shadow-md transition-transform active:scale-95 shrink-0 flex items-center gap-1 text-xs font-bold"
                                        >
                                            Add
                                        </button>
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
