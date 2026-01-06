import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import KPIBar from '../components/KPIBar';
import IssueTrackerModal from '../components/modals/IssueTrackerModal';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { useDecks } from '../hooks/useDecks';
import { getIdentity } from '../data/mtg_identity_registry';
import DonationWidget from '../components/dashboard/DonationWidget';
import CommunityWidget from '../components/dashboard/CommunityWidget';
import TipsWidget from '../components/dashboard/TipsWidget';

import DonationModal from '../components/modals/DonationModal';
import BinderGuideModal from '../components/modals/BinderGuideModal';
import PodGuideModal from '../components/modals/PodGuideModal';

const Dashboard = () => {
    const { currentUser, userProfile } = useAuth();
    const { cards: collection, loading: collectionLoading, refresh: refreshCollection } = useCollection();
    const { decks, loading: decksLoading } = useDecks();
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
    const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
    const [showBinderGuide, setShowBinderGuide] = useState(false);
    const [showPodGuide, setShowPodGuide] = useState(false);
    const [syncLoading, setSyncLoading] = useState(false);
    const navigate = useNavigate();

    const handleSyncPrices = async () => {
        setSyncLoading(true);
        try {
            await api.post('/api/sync/prices');
            await refreshCollection(); // Refresh collection to get new prices
        } catch (err) {
            console.error("Sync failed", err);
            // Optionally add toast here
        } finally {
            setSyncLoading(false);
        }
    };

    // Stats Calculation
    const stats = useMemo(() => {
        if (!collection || !decks) return { totalCards: 0, uniqueDecks: 0, value: 0, topColor: 'N/A' };

        // Total Cards (Collection + Header-only Commanders)
        const collectionScryfallIds = new Set(collection.map(c => c.scryfall_id || c.id));
        let totalCards = collection.reduce((acc, card) => acc + (card.count || 1), 0);

        // Add commanders that aren't in the card-level collection list
        decks.forEach(deck => {
            if (deck.commander) {
                const cid = deck.commander.id || deck.commander.scryfall_id;
                if (cid && !collectionScryfallIds.has(cid)) {
                    totalCards++;
                    collectionScryfallIds.add(cid);
                }
            }
            if (deck.commander_partner) {
                const pid = deck.commander_partner.id || deck.commander_partner.scryfall_id;
                if (pid && !collectionScryfallIds.has(pid)) {
                    totalCards++;
                    collectionScryfallIds.add(pid);
                }
            }
        });

        // Value (approximate based on 'usd' price)
        const value = collection.reduce((acc, card) => {
            const price = parseFloat(card.prices?.usd || 0);
            return acc + (price * (card.count || 1));
        }, 0);

        // Top Color Identity Grouping
        const colorCounts = {};

        collection.forEach(card => {
            const colors = card.color_identity || [];
            // Sort to ensure key consistency (e.g. ['U', 'B'] vs ['B', 'U'])
            const wubrgOrder = { 'W': 0, 'U': 1, 'B': 2, 'R': 3, 'G': 4 };
            const sortedKey = colors.filter(c => wubrgOrder[c] !== undefined)
                .sort((a, b) => wubrgOrder[a] - wubrgOrder[b])
                .join('');

            const key = sortedKey.length === 0 ? 'C' : sortedKey;
            colorCounts[key] = (colorCounts[key] || 0) + (card.count || 1);
        });

        const topColorEntries = Object.entries(colorCounts);

        let topColorData = getIdentity('C');

        if (topColorEntries.length > 0) {
            // Find max
            const [bestKey, _] = topColorEntries.reduce((max, curr) => curr[1] > max[1] ? curr : max);
            topColorData = getIdentity(bestKey);
        }

        return {
            totalCards,
            uniqueDecks: decks.length,
            value: value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            topColor: topColorData
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
                    <DashboardKPI to="/collection" title="Total Cards" value={stats.totalCards} icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" color="blue" />
                    <DashboardKPI to="/decks" title="Unique Decks" value={stats.uniqueDecks} icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" color="purple" />
                    <DashboardKPI title="Collection Value" value={stats.value} icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" color="green">
                        <button
                            onClick={handleSyncPrices}
                            disabled={syncLoading}
                            className={`absolute top-4 right-4 p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all ${syncLoading ? 'animate-spin' : ''}`}
                            title="Update Prices from Scryfall"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </DashboardKPI>

                    {/* Top Color Widget - Custom Render */}
                    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 backdrop-blur-sm hover:border-gray-700 transition-colors group relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-24 h-24 opacity-10 rounded-bl-full ${stats.topColor.bg}`} />

                        <div className="flex flex-col h-full justify-between relative z-10">
                            <div className="flex gap-1 mb-2">
                                {stats.topColor.pips?.map((pip, i) => (
                                    <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ring-1 ring-white/10 shadow-sm ${pip === 'W' ? 'bg-yellow-200 text-yellow-900' :
                                        pip === 'U' ? 'bg-blue-300 text-blue-900' :
                                            pip === 'B' ? 'bg-gray-800 text-gray-200' :
                                                pip === 'R' ? 'bg-red-400 text-red-900' :
                                                    pip === 'G' ? 'bg-green-400 text-green-900' :
                                                        'bg-gray-400 text-gray-900'
                                        }`}>
                                        {pip}
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div className={`text-xl font-black tracking-tight ${stats.topColor.color || 'text-white'}`}>{stats.topColor.name}</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Top Color Identity</div>
                                <div className="text-[10px] text-gray-400 italic mt-2 line-clamp-2 opacity-70">
                                    "{stats.topColor.flavor}"
                                </div>
                            </div>
                        </div>
                    </div>
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

                        {/* System & Support Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* System Status */}
                            <div className="bg-red-900/10 border border-red-500/20 rounded-3xl p-6 backdrop-blur-md">
                                <h2 className="font-bold text-white mb-2 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    System Status
                                </h2>
                                <p className="text-sm text-gray-400 mb-6">Found a bug or have a feature request? Help us improve the Forge.</p>

                                <button
                                    onClick={() => setIsIssueModalOpen(true)}
                                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    Report Issue
                                </button>
                            </div>

                            {/* Donation Widget */}
                            <DonationWidget onOpenModal={() => setIsDonationModalOpen(true)} />
                        </div>

                    </div>

                    {/* Right Column: Key Stats / Profile / Reports */}
                    <div className="space-y-6">



                        {/* Tips Widget */}
                        <TipsWidget />

                        {/* Guides & Resources */}
                        <div className="bg-gray-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md">
                            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                                <span className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                </span>
                                Guides & Resources
                            </h2>
                            <div className="space-y-3">
                                <button
                                    onClick={() => setShowBinderGuide(true)}
                                    className="w-full text-left p-3 rounded-xl bg-gray-950/50 hover:bg-gray-800 border border-white/5 hover:border-indigo-500/30 transition-all group flex items-center gap-3"
                                >
                                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:scale-110 transition-transform">
                                        ✨
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-200 group-hover:text-white">Smart Binders</div>
                                        <div className="text-xs text-gray-500">Automate your collection</div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                                <button
                                    onClick={() => setShowPodGuide(true)}
                                    className="w-full text-left p-3 rounded-xl bg-gray-950/50 hover:bg-gray-800 border border-white/5 hover:border-purple-500/30 transition-all group flex items-center gap-3"
                                >
                                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 group-hover:scale-110 transition-transform">
                                        🤝
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-200 group-hover:text-white">Pods & Sharing</div>
                                        <div className="text-xs text-gray-500">Manage permissions</div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-600 group-hover:text-purple-400 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>



                        {/* Community Widget (My Pod) */}
                        <div className="h-auto">
                            <CommunityWidget />
                        </div>



                    </div>

                </div>
            </div>

            <IssueTrackerModal
                isOpen={isIssueModalOpen}
                onClose={() => setIsIssueModalOpen(false)}
            />

            <DonationModal
                isOpen={isDonationModalOpen}
                onClose={() => setIsDonationModalOpen(false)}
            />

            <BinderGuideModal
                isOpen={showBinderGuide}
                onClose={() => setShowBinderGuide(false)}
            />

            <PodGuideModal
                isOpen={showPodGuide}
                onClose={() => setShowPodGuide(false)}
            />
        </div>
    );
};

// Mini Components for Dashboard local usage
const DashboardKPI = ({ title, value, icon, color, to, children }) => {
    const content = (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 backdrop-blur-sm hover:border-gray-700 transition-colors group relative h-full">
            {children}
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl bg-gray-950 text-${color}-400 group-hover:scale-110 transition-transform shadow-inner`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} /></svg>
                </div>
            </div>
            <div>
                <div className="text-3xl font-black text-white tracking-tight">{value}</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{title}</div>
            </div>
        </div>
    );

    if (to) {
        return <Link to={to} className="block transition-transform active:scale-95">{content}</Link>;
    }

    return content;
};

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
