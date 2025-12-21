import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import KPIBar from '../components/KPIBar';
import BugTrackerModal from '../components/modals/BugTrackerModal';
import { useAuth } from '../contexts/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { useDecks } from '../hooks/useDecks';

const Dashboard = () => {
    const { currentUser } = useAuth();
    const { cards: collection, loading: collectionLoading } = useCollection();
    const { decks, loading: decksLoading } = useDecks();
    const [isBugModalOpen, setIsBugModalOpen] = useState(false);

    // Stats Calculation
    const stats = useMemo(() => {
        if (!collection || !decks) return { totalCards: 0, uniqueDecks: 0, value: 0, topColor: 'N/A' };

        // Total Cards
        const totalCards = collection.reduce((acc, card) => acc + (card.count || 1), 0);

        // Value (approximate based on 'usd' price)
        const value = collection.reduce((acc, card) => {
            const price = parseFloat(card.prices?.usd || 0);
            return acc + (price * (card.count || 1));
        }, 0);

        // Top Color
        const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, M: 0 };
        collection.forEach(card => {
            const colors = card.color_identity || [];
            if (colors.length === 0) colorCounts.C++;
            else if (colors.length > 1) colorCounts.M++;
            else colorCounts[colors[0]]++;
        });

        const topColor = Object.entries(colorCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
        const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless', M: 'Multicolor' };

        return {
            totalCards,
            uniqueDecks: decks.length,
            value: value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            topColor: colorNames[topColor] || 'N/A'
        };
    }, [collection, decks]);

    const recentDecks = useMemo(() => {
        return decks ? decks.slice(0, 3) : []; // Show top 3? Decks might not be sorted by date yet, but taking first few is fine for now.
    }, [decks]);

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <span className="text-gray-400 text-sm">Welcome back, <span className="text-indigo-400 font-bold">{currentUser ? currentUser.email : 'Guest'}</span></span>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KPIBar title="Total Cards" value={stats.totalCards} />
                <KPIBar title="Unique Decks" value={stats.uniqueDecks} />
                <KPIBar title="Collection Value" value={stats.value} />
                <KPIBar title="Top Color" value={stats.topColor} />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Recent Activity / Quick Actions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">Recent Decks</h2>
                        </div>
                        <div className="p-6">
                            {decksLoading ? (
                                <div className="text-gray-400 text-center py-4">Loading decks...</div>
                            ) : recentDecks.length > 0 ? (
                                <div className="space-y-4">
                                    {recentDecks.map(deck => (
                                        <Link key={deck.id} to={`/decks/${deck.id}`} className="block bg-gray-700/50 hover:bg-gray-700 p-4 rounded-xl transition-colors flex justify-between items-center group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-gray-600 flex items-center justify-center text-2xl">
                                                    {/* Placeholder icon or deck image if available */}
                                                    {deck.colors && deck.colors.length > 0 ? (
                                                        <span className={`w-3 h-3 rounded-full bg-mtg-${deck.colors[0].toLowerCase()}`}></span>
                                                    ) : '🃏'}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-white group-hover:text-indigo-400 transition-colors">{deck.name}</h3>
                                                    <p className="text-xs text-gray-400">{deck.format || 'Commander'} • {deck.cards ? Object.keys(deck.cards).length : 0} cards</p>
                                                </div>
                                            </div>
                                            <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </Link>
                                    ))}
                                    <Link to="/decks" className="block text-center text-sm text-indigo-400 hover:text-indigo-300 mt-4">View All Decks</Link>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-gray-500 italic">No recent decks found. start building!</p>
                                    <Link to="/decks" className="mt-4 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
                                        Create New Deck
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Notes & Widgets */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Bug / Feedback Widget */}
                    <div className="bg-gradient-to-br from-red-900/50 to-orange-900/50 rounded-2xl border border-red-700/50 overflow-hidden shadow-lg">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-500/20 rounded-lg">
                                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h2 className="text-xl font-bold text-white">System Status</h2>
                            </div>
                            <p className="text-gray-300 text-sm mb-6">Found a bug or have a feature request? Help us improve the Forge.</p>
                            <button
                                onClick={() => setIsBugModalOpen(true)}
                                className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                Report Issue
                            </button>
                        </div>
                    </div>

                    {/* Notes Widget */}
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 h-64 flex flex-col">
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Quick Notes</h2>
                            <svg className="w-5 h-5 text-gray-500 hover:text-white cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </div>
                        <div className="p-4 flex-grow">
                            <textarea
                                className="w-full h-full bg-transparent border-none text-gray-300 resize-none focus:ring-0 placeholder-gray-600 outline-none"
                                placeholder="Jot down deck ideas or card combos here..."
                            ></textarea>
                        </div>
                    </div>
                </div>

            </div>

            <BugTrackerModal isOpen={isBugModalOpen} onClose={() => setIsBugModalOpen(false)} />
        </div>
    );
};

export default Dashboard;
