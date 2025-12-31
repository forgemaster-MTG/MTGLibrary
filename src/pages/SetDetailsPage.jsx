import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { collectionService } from '../services/collectionService';
import CardSkeleton from '../components/CardSkeleton';
import InteractiveCard from '../components/common/InteractiveCard';

const SetDetailsPage = () => {
    const { setCode } = useParams();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all'); // all, owned, missing
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { cards: collectionCards, refresh } = useCollection();

    // Map of Scryfall ID -> Array of UserCards
    const collectionMap = useMemo(() => {
        const map = new Map();
        if (collectionCards) {
            collectionCards.forEach(c => {
                // Prioritize scryfall_id as the primary lookup key for set details matching
                const key = c.scryfall_id || (c.data && (c.data.scryfall_id || c.data.id)) || c.id;
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(c);
            });
        }
        return map;
    }, [collectionCards]);

    // Stats Calculation
    const stats = useMemo(() => {
        const uniqueNamesInSet = new Set(results.map(r => r.name));
        const ownedUniqueNames = new Set();
        let totalValueResult = 0;

        results.forEach(card => {
            const userCopies = collectionMap.get(card.id) || [];
            const normalCount = userCopies
                .filter(c => c.finish === 'nonfoil' && !c.deck_id && !c.is_wishlist)
                .reduce((sum, c) => sum + (c.count || 1), 0);
            const foilCount = userCopies
                .filter(c => c.finish === 'foil' && !c.deck_id && !c.is_wishlist)
                .reduce((sum, c) => sum + (c.count || 1), 0);

            if (normalCount > 0 || foilCount > 0) {
                ownedUniqueNames.add(card.name);
                const price = parseFloat(card.prices?.usd || 0) * normalCount;
                const foilPrice = parseFloat(card.prices?.usd_foil || 0) * foilCount;
                totalValueResult += price + foilPrice;
            }
        });

        return {
            collected: ownedUniqueNames.size,
            total: uniqueNamesInSet.size,
            value: totalValueResult.toFixed(2)
        };
    }, [results, collectionMap]);

    // Filtered Results
    const filteredResults = useMemo(() => {
        if (filter === 'all') return results;
        return results.filter(card => {
            const userCopies = collectionMap.get(card.id) || [];
            const isOwned = userCopies.some(c => !c.is_wishlist && (c.count || 0) > 0);
            return filter === 'owned' ? isOwned : !isOwned;
        });
    }, [results, collectionMap, filter]);

    useEffect(() => {
        const fetchSetCards = async () => {
            if (!setCode) return;
            setLoading(true);
            try {
                const data = await api.get(`/sets/${setCode}/cards`);
                setResults(data.data || []);
                setError(null);
            } catch (err) {
                console.error("Failed to load set cards", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSetCards();
    }, [setCode]);

    const handleUpdateCount = async (card, type, delta) => {
        if (!currentUser) return addToast("Please log in", "error");

        try {
            const scryfallId = card.id;
            const userCopies = collectionMap.get(scryfallId) || [];

            const finish = type === 'foil' ? 'foil' : 'nonfoil';
            const existing = userCopies.find(c => c.finish === finish && !c.deck_id && !c.is_wishlist);

            if (delta > 0) {
                if (existing) {
                    await collectionService.updateCard(existing.id, { count: (existing.count || 1) + 1 });
                    addToast(`Added ${finish} ${card.name}`, 'success');
                } else {
                    await collectionService.addCardToCollection(currentUser.uid, card, 1, finish);
                    addToast(`Added new ${finish} ${card.name}`, 'success');
                }
            } else {
                if (existing) {
                    if ((existing.count || 1) > 1) {
                        await collectionService.updateCard(existing.id, { count: existing.count - 1 });
                        addToast(`Removed ${finish} ${card.name}`, 'info');
                    } else {
                        await collectionService.removeCard(existing.id);
                        addToast(`Removed last ${finish} ${card.name}`, 'info');
                    }
                }
            }
            await refresh();
        } catch (err) {
            console.error("Update failed", err);
            addToast("Failed to update collection", "error");
        }
    };

    const handleUpdateWishlistCount = async (card, delta) => {
        if (!currentUser) return addToast("Please log in", "error");
        try {
            const scryfallId = card.id;
            const userCopies = collectionMap.get(scryfallId) || [];
            const existing = userCopies.find(c => c.is_wishlist && !c.deck_id);

            if (delta > 0) {
                if (existing) {
                    await collectionService.updateCard(existing.id, { count: (existing.count || 1) + 1 });
                    addToast(`Increased wishlist for ${card.name}`, 'success');
                } else {
                    await collectionService.addCardToCollection(currentUser.uid, card, 1, 'nonfoil', true);
                    addToast(`Added ${card.name} to wishlist`, 'success');
                }
            } else {
                if (existing) {
                    if ((existing.count || 1) > 1) {
                        await collectionService.updateCard(existing.id, { count: existing.count - 1 });
                        addToast(`Decreased wishlist for ${card.name}`, 'info');
                    } else {
                        await collectionService.removeCard(existing.id);
                        addToast(`Removed ${card.name} from wishlist`, 'info');
                    }
                }
            }
            await refresh();
        } catch (err) {
            console.error("Wishlist update failed", err);
            addToast("Failed to update wishlist", "error");
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 pb-20">
            {/* Header Content */}
            <div className="relative overflow-hidden bg-gray-950/50 pt-16 pb-8 border-b border-white/5">
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <Link to="/sets" className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-6 group">
                        <svg className="w-5 h-5 mr-1 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Sets
                    </Link>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-2">
                                {setCode} <span className="text-gray-500">Details</span>
                            </h1>
                            <p className="text-gray-400 font-medium">Manage and track your collection for this expansion</p>
                        </div>

                        {/* Collection Info Panel */}
                        <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-white/5 p-4 md:p-6 flex items-center gap-8 shadow-xl">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-1">Collected</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-indigo-400">{stats.collected}</span>
                                    <span className="text-gray-600 font-bold text-sm">/ {stats.total}</span>
                                </div>
                            </div>
                            <div className="w-[1px] h-12 bg-white/5" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-1">Value</span>
                                <span className="text-3xl font-black text-emerald-400 tabular-nums">${stats.value}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Toggle */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex bg-gray-950/50 backdrop-blur-md rounded-xl p-1 border border-white/5 self-start">
                        {['all', 'owned', 'missing'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilter(type)}
                                className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-300 ${filter === type
                                    ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]'
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <CardSkeleton key={i} />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center text-red-500 py-12 bg-red-500/10 rounded-2xl border border-red-500/20">
                        Error loading set: {error}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {filteredResults.map((card, index) => {
                            const userCopies = collectionMap.get(card.id) || [];
                            const normalCount = userCopies
                                .filter(c => c.finish === 'nonfoil' && !c.deck_id && !c.is_wishlist)
                                .reduce((sum, c) => sum + (c.count || 1), 0);
                            const foilCount = userCopies
                                .filter(c => c.finish === 'foil' && !c.deck_id && !c.is_wishlist)
                                .reduce((sum, c) => sum + (c.count || 1), 0);
                            const wishlistCount = userCopies
                                .filter(c => c.is_wishlist && !c.deck_id)
                                .reduce((sum, c) => sum + (c.count || 1), 0);

                            return (
                                <InteractiveCard
                                    key={card.id || index}
                                    card={card}
                                    normalCount={normalCount}
                                    foilCount={foilCount}
                                    wishlistCount={wishlistCount}
                                    onUpdateCount={handleUpdateCount}
                                    onUpdateWishlistCount={handleUpdateWishlistCount}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SetDetailsPage;
