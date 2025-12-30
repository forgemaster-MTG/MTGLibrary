import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import KPIBar from '../components/KPIBar';
import BugTrackerModal from '../components/modals/BugTrackerModal';
import { useAuth } from '../contexts/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { useDecks } from '../hooks/useDecks';

const Dashboard = () => {
    const { currentUser, userProfile } = useAuth();
    const { cards: collection, loading: collectionLoading } = useCollection();
    const { decks, loading: decksLoading } = useDecks();
    const [isBugModalOpen, setIsBugModalOpen] = useState(false);
    const navigate = useNavigate();

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

        const topColorEntries = Object.entries(colorCounts);
        let topColor = 'N/A';
        if (topColorEntries.length > 0) {
            topColor = topColorEntries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
        }

        const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless', M: 'Multicolor' };

        return {
            totalCards,
            uniqueDecks: decks.length,
            value: value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            topColor: colorNames[topColor] || 'N/A'
        };
    }, [collection, decks]);

    const recentDecks = useMemo(() => {
        // Sort by date if available, or just take first 3 for now (assuming backend returns decent order)
        // Ideally we'd sort by `updated_at` or `created_at` desc
        return decks ? [...decks].reverse().slice(0, 3) : [];
    }, [decks]);

    return (
        <div className="relative min-h-screen">
            {/* Immersive Background */}
            <div
                className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000"
                style={{ backgroundImage: 'url(/MTG-Forge_Logo_Background.png)' }}
            >
                <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-12 animate-fade-in">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                            Dashboard
                        </h1>
                        <p className="text-gray-400">
                            Welcome back, <span className="text-indigo-400 font-bold">{currentUser ? (currentUser.displayName || currentUser.email) : 'Guest'}</span>.
                        </p>
                    </div>
                </div>

                {/* KPI Section */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <DashboardKPI title="Total Cards" value={stats.totalCards} icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" color="blue" />
                    <DashboardKPI title="Unique Decks" value={stats.uniqueDecks} icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" color="purple" />
                    <DashboardKPI title="Collection Value" value={stats.value} icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" color="green" />
                    <DashboardKPI title="Top Color" value={stats.topColor} icon="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" color="red" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Quick Actions & Recent */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <QuickAction
                                title="New Deck"
                                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
                                color="from-indigo-600 to-purple-600"
                                onClick={() => navigate('/decks/new')}
                            />
                            <QuickAction
                                title="Add Cards"
                                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                                color="from-blue-600 to-cyan-600"
                                onClick={() => navigate('/collection')}
                            />
                            <QuickAction
                                title="Browse Sets"
                                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                                color="from-green-600 to-emerald-600"
                                onClick={() => navigate('/sets')}
                            />
                            <QuickAction
                                title="Wishlist"
                                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                                color="from-pink-600 to-rose-600"
                                onClick={() => navigate('/collection?wishlist=true')}
                            />
                        </div>


                        {/* Recent Decks (Portrait Tiles) */}
                        <div className="bg-gray-950/40 border border-white/5 rounded-3xl p-8 backdrop-blur-md shadow-xl">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </span>
                                Recent Decks
                            </h2>
                            {decksLoading ? (
                                <div className="text-gray-400 text-center py-8">Loading decks...</div>
                            ) : recentDecks.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {recentDecks.map(deck => {
                                        // Helper to get image
                                        const getArtCrop = (card) => {
                                            if (!card) return null;
                                            if (card.image_uris?.art_crop) return card.image_uris.art_crop;
                                            if (card.card_faces?.[0]?.image_uris?.art_crop) return card.card_faces[0].image_uris.art_crop;
                                            return null;
                                        };

                                        const mainImage = getArtCrop(deck.commander);
                                        const partnerImage = getArtCrop(deck.commander_partner);

                                        return (
                                            <div key={deck.id} onClick={() => navigate(`/decks/${deck.id}`)} className="group relative aspect-[63/88] rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-2 border border-white/5 bg-gray-900">

                                                {/* Background Image Logic */}
                                                <div className="absolute inset-0 bg-gray-950">
                                                    {deck.commander_partner ? (
                                                        // Partner Layout: Split View
                                                        <div className="w-full h-full flex">
                                                            <div className="w-1/2 h-full relative border-r border-black/50">
                                                                <img
                                                                    src={mainImage || 'https://placehold.co/400x600?text=?'}
                                                                    alt={deck.commander?.name}
                                                                    className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700"
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-60" />
                                                            </div>
                                                            <div className="w-1/2 h-full relative">
                                                                <img
                                                                    src={partnerImage || 'https://placehold.co/400x600?text=?'}
                                                                    alt={deck.commander_partner?.name}
                                                                    className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700"
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-60" />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Solo Layout
                                                        <img
                                                            src={mainImage || 'https://placehold.co/400x600?text=?'}
                                                            alt={deck.name}
                                                            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700"
                                                        />
                                                    )}
                                                </div>

                                                {/* Gradient Overlay */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent opacity-90" />

                                                {/* Content */}
                                                <div className="absolute inset-0 p-5 flex flex-col justify-end">
                                                    <div className="mb-1">
                                                        <div className="flex justify-between items-end mb-2">
                                                            <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                                                                {deck.format || 'Commander'}
                                                            </span>
                                                        </div>

                                                        <h3 className="text-xl font-bold text-white leading-tight mb-1 group-hover:text-indigo-400 transition-colors line-clamp-2">
                                                            {deck.name}
                                                        </h3>
                                                        <p className="text-sm text-gray-400 line-clamp-1">
                                                            {deck.commander_partner ? `${deck.commander.name} & ${deck.commander_partner.name}` : (deck.commander?.name || 'Unknown Commander')}
                                                        </p>
                                                    </div>

                                                    {/* Footer metadata */}
                                                    <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center text-xs text-gray-500 font-mono">
                                                        <span>{deck.card_count || 0} cards</span>
                                                        <svg className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-gray-900/30 rounded-2xl border border-dashed border-gray-800">
                                    <p className="text-gray-500">No decks forged yet.</p>
                                    <Link to="/decks/new" className="text-indigo-400 font-bold hover:text-indigo-300 mt-2 inline-block">Create your first deck &rarr;</Link>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Right Column: Key Stats / Profile / Reports */}
                    <div className="space-y-6">

                        {/* System / Report */}
                        <div className="bg-red-900/10 border border-red-500/20 rounded-3xl p-6 backdrop-blur-md">
                            <h2 className="font-bold text-white mb-2 flex items-center gap-2">
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                System Status
                            </h2>
                            <p className="text-sm text-gray-400 mb-6">Found a bug or have a feature request? Help us improve the Forge.</p>

                            <button
                                onClick={() => setIsBugModalOpen(true)}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                Report Issue
                            </button>
                        </div>

                        {/* Placeholder Note Widget */}
                        <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-6 h-64">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-white">Quick Notes</h3>
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </div>
                            <textarea
                                className="w-full h-full bg-transparent resize-none text-gray-400 placeholder-gray-600 text-sm focus:outline-none"
                                placeholder="Jot down deck ideas or card combos here..."
                            ></textarea>
                        </div>

                    </div>

                </div>
            </div>

            <BugTrackerModal
                isOpen={isBugModalOpen}
                onClose={() => setIsBugModalOpen(false)}
            />
        </div>
    );
};

// Mini Components for Dashboard local usage
const DashboardKPI = ({ title, value, icon, color }) => (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 backdrop-blur-sm hover:border-gray-700 transition-colors group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl bg-gray-950 text-${color}-400 group-hover:scale-110 transition-transform shadow-inner`}>
                {/* Icon requires specific color classes that might need strict definition, relying on dynamic string interpolation if tailwind allows, else fallback */}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} /></svg>
            </div>
            {/* Trend indicator could go here */}
        </div>
        <div>
            <div className="text-3xl font-black text-white tracking-tight">{value}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{title}</div>
        </div>
    </div>
);

const QuickAction = ({ title, icon, color, onClick }) => (
    <button
        onClick={onClick}
        className={`group relative overflow-hidden rounded-2xl p-4 md:p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl border border-white/5`}
    >
        <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
        {/* Default darker BG */}
        <div className="absolute inset-0 bg-gray-800/50 group-hover:opacity-0 transition-opacity" />

        <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-gray-300 group-hover:text-white transition-colors">
            <div className="p-3 bg-gray-900/50 rounded-full backdrop-blur-sm group-hover:scale-110 transition-transform group-hover:bg-white/20">
                {icon}
            </div>
            <span className="font-bold text-sm tracking-wide">{title}</span>
        </div>
    </button>
);

export default Dashboard;
