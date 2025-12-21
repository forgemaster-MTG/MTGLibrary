import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDecks } from '../hooks/useDecks';
import { deckService } from '../services/deckService';
import { useToast } from '../contexts/ToastContext';

const DecksPage = () => {
    const { decks, loading, error, refresh } = useDecks(); // Assuming useDecks has refresh? If not, we reload.
    const navigate = useNavigate();
    const { addToast } = useToast();

    const handleDelete = async (e, deckId) => {
        e.preventDefault(); // Prevent navigation
        if (window.confirm('Are you sure you want to delete this deck?')) {
            try {
                await deckService.deleteDeck(null, deckId); // userId handled by token/backend
                addToast('Deck deleted', 'success');
                window.location.reload(); // Simple refresh
            } catch (err) {
                console.error(err);
                addToast('Failed to delete deck', 'error');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg">
                    Error loading decks: {error.message}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">My Decks</h1>
                <Link to="/decks/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Deck
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {decks.map((deck) => (
                    <Link to={`/decks/${deck.id}`} key={deck.id} className="group block h-full">
                        <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 group-hover:border-indigo-500 transition-all h-full flex flex-col">
                            {/* Deck Cover Image */}
                            <div className="relative h-48 bg-gray-900 overflow-hidden group/image">
                                <button
                                    onClick={(e) => handleDelete(e, deck.id)}
                                    className="absolute top-2 right-2 z-10 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity hover:bg-red-700 shadow-lg"
                                    title="Delete Deck"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                                {deck.commander?.image_uris?.art_crop ? (
                                    <img
                                        src={deck.commander.image_uris.art_crop}
                                        alt={deck.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-600">
                                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-800 to-transparent opacity-60"></div>

                                <div className="absolute bottom-0 left-0 p-4 w-full">
                                    {/* Color Identity (Placeholder) */}
                                    {deck.colors && deck.colors.length > 0 && (
                                        <div className="flex gap-1 mb-2">
                                            {deck.colors.map(c => (
                                                <span key={c} className={`w-3 h-3 rounded-full bg-mtg-${c.toLowerCase()} shadow-sm`}></span>
                                            ))}
                                        </div>
                                    )}
                                    {/* We can map colors to actual css classes or SVGs later */}
                                </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors">{deck.name || 'Untitled Deck'}</h3>
                                    {deck.commander && (
                                        <p className="text-sm text-gray-400 mb-2">Cmdr: {deck.commander.name}</p>
                                    )}
                                </div>
                                <div className="flex justify-between items-center mt-4 text-xs text-gray-500 font-medium uppercase tracking-wider">
                                    <span>{Object.keys(deck.cards || {}).length} Cards</span>
                                    <span>{deck.format || 'Commander'}</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {decks.length === 0 && (
                <div className="text-center py-20 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
                    <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="text-xl font-bold text-gray-400 mb-2">No Decks Found</h3>
                    <p className="text-gray-500 mb-6 max-w-sm mx-auto">Get started by creating your first deck and adding cards from your collection.</p>
                    <Link to="/decks/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-lg shadow-indigo-500/20 inline-flex items-center gap-2">
                        Create First Deck
                    </Link>
                </div>
            )}
        </div>
    );
};

export default DecksPage;
