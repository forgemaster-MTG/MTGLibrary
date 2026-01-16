import React, { useState, memo } from 'react';
import DeckCard from './DeckCard';
import { Link } from 'react-router-dom';

const DeckRow = memo(function DeckRow({ title, decks, loading, error, isOwner = false }) {
    const [expanded, setExpanded] = useState(false);

    // Show 4 cards by default, or all if expanded
    const visibleDecks = expanded ? decks : decks.slice(0, 4);
    const hasMore = decks.length > 4;

    if (loading) {
        return (
            <div className="mb-12">
                <div className="h-8 w-48 bg-gray-800 rounded-lg animate-pulse mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-[420px] bg-gray-900 rounded-3xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mb-12 p-6 bg-red-900/20 border border-red-500/50 rounded-2xl">
                <h3 className="text-red-400 font-bold">Error loading decks</h3>
            </div>
        );
    }

    if (decks.length === 0) return null;

    return (
        <div className="mb-12 animate-fade-in relative z-10">
            <div className="flex justify-between items-end mb-6 border-b border-white/5 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        {title}
                        <span className="text-sm font-medium text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                            {decks.length}
                        </span>
                    </h2>
                </div>

                {hasMore && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-indigo-400 hover:text-indigo-300 text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                    >
                        {expanded ? 'Show Less' : `Show All (${decks.length})`}
                        <svg
                            className={`w-4 h-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {visibleDecks.map(deck => (
                    <DeckCard key={deck.id} deck={deck} />
                ))}
            </div>

            {isOwner && decks.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-gray-900/20 rounded-3xl border border-dashed border-gray-800">
                    <p className="text-gray-500 mb-6">You haven't built any decks yet.</p>
                    <Link to="/decks/new" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all">
                        Create Deck
                    </Link>
                </div>
            )}
        </div>
    );
});

export default DeckRow;
