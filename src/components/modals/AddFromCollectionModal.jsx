import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCollection } from '../../hooks/useCollection';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { deckService } from '../../services/deckService';

// Helper for color identity check
const isColorIdentityValid = (cardColors, commanderColors) => {
    if (!cardColors || cardColors.length === 0) return true; // Colorless is always allowed
    const commanderColorSet = new Set(commanderColors || []);
    return cardColors.every(c => commanderColorSet.has(c));
};

const AddFromCollectionModal = ({ isOpen, onClose, deck, deckCards = [] }) => {
    const { cards: collection, loading } = useCollection();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');

    // Filter Logic
    const availableCards = useMemo(() => {
        if (!collection || !deck) return [];

        const commanderColors = deck.commander?.color_identity || [];
        // Create a Set of card names already in the deck for fast lookup
        const deckCardNames = new Set(deckCards.map(c => c.name));

        const term = searchTerm.toLowerCase();

        return collection.filter(card => {
            // 1. Must be unassigned (no deckId)
            if (card.deckId) return false;

            const isStandard = deck.format?.toLowerCase() === 'standard';
            const isBasic = card.type_line?.toLowerCase().includes('basic land');

            // 2. Color Identity (Commander Only)
            if (!isStandard) {
                if (!isColorIdentityValid(card.color_identity, commanderColors)) return false;
            }

            // 3. Deck Limits (Singleton vs 4-of)
            // Calculate how many copies are currently in the deck
            const currentCount = deckCards
                .filter(c => c.name === card.name)
                .reduce((acc, c) => acc + (c.countInDeck || 1), 0);

            const limit = isStandard ? 4 : 1;

            if (!isBasic && currentCount >= limit) return false;

            // 4. Search Filter
            if (term && !card.name.toLowerCase().includes(term) && !card.type_line?.toLowerCase().includes(term)) return false;

            // 5. Type Filter
            if (typeFilter !== 'All' && !card.type_line?.toLowerCase().includes(typeFilter.toLowerCase())) return false;

            return true;
        });
    }, [collection, deck, deckCards, searchTerm, typeFilter]);

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

                    {/* Type Tabs */}
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
                                const img = card.image_uris?.art_crop || card.image_uris?.normal || 'https://placehold.co/100x100?text=No+Img';
                                return (
                                    <div key={card.firestoreId || card.id} className="flex items-center gap-3 p-2 bg-gray-800/80 rounded-lg border border-gray-700/50 hover:bg-gray-700 hover:border-indigo-500/50 transition-all group">

                                        {/* Image thumbnail */}
                                        <div className="relative w-16 h-12 rounded overflow-hidden shrink-0 shadow-sm">
                                            <img src={img} className="w-full h-full object-cover" alt={card.name} loading="lazy" />
                                            {card.finish === 'foil' && <div className="absolute top-0 right-0 w-3 h-3 bg-yellow-400 rounded-bl-md shadow-sm" title="Foil"></div>}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-200 text-sm truncate">{card.name}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <span className="truncate max-w-[120px]">{card.type_line}</span>
                                                <span className="bg-gray-700 px-1 rounded text-[10px]">{card.set?.toUpperCase()}</span>
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <button
                                            onClick={() => handleAddCard(card)}
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
