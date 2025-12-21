import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useScryfall } from '../hooks/useScryfall';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { collectionService } from '../services/collectionService';

const CardSearchModal = ({ isOpen, onClose, onAddCard }) => {
    const [query, setQuery] = useState('');
    const { results, loading, error, searchCards, setResults } = useScryfall();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSearch = (e) => {
        e.preventDefault();
        searchCards(query);
    };

    const handleAddCard = async (card) => {
        try {
            if (onAddCard) {
                await onAddCard(card);
            } else {
                const result = await collectionService.addCardToCollection(currentUser?.uid, card);
                if (result.type === 'update') {
                    addToast(`Updated ${result.name} count to ${result.count}`, 'success');
                } else {
                    addToast(`Added ${result.name} to collection`, 'success');
                }
            }
        } catch (err) {
            console.error(err);
            addToast('Failed to add card', 'error');
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700">
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Add Cards</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 bg-gray-900/50">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search for a card..."
                            className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg py-3 px-4 pl-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="absolute right-2 top-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                </div>

                {/* Results Area */}
                <div className="flex-1 overflow-y-auto p-4 min-h-[400px]">
                    {error && (
                        <div className="text-center text-red-400 py-8">
                            {error}
                        </div>
                    )}

                    {!loading && results.length === 0 && query && !error && (
                        <div className="text-center text-gray-500 py-8">
                            No cards found.
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {results.map((card) => {
                            const img = card.image_uris?.normal || card.image_uris?.small || (card.card_faces && card.card_faces[0]?.image_uris?.normal) || 'https://placehold.co/250x350?text=No+Image';
                            return (
                                <div key={card.id} className="relative group aspect-[2.5/3.5] bg-gray-900 rounded-lg overflow-hidden shadow-lg border border-gray-700 hover:border-indigo-500 transition-all">
                                    <img
                                        src={img}
                                        alt={card.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    {/* Hover Actions */}
                                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-2 p-4">
                                        <h4 className="text-white font-bold text-sm text-center mb-2">{card.name}</h4>
                                        <button
                                            onClick={() => handleAddCard(card)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all transform hover:scale-105 shadow-lg flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            Add
                                        </button>
                                        <button
                                            onClick={() => handleAddCard({ ...card, finish: 'foil' })}
                                            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all transform hover:scale-105 shadow-lg flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            Add Foil
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CardSearchModal;
