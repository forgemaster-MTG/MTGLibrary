import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDecks } from '../hooks/useDecks';
import { useCollection } from '../hooks/useCollection';
import { collectionService } from '../services/collectionService';
import CardSkeleton from '../components/CardSkeleton';
import InteractiveCard from '../components/common/InteractiveCard';
import CardAutocomplete from '../components/common/CardAutocomplete';
import StartAuditButton from '../components/Audit/StartAuditButton';
import { getTierConfig, TIER_CONFIG, TIERS } from '../config/tiers';

const SetDetailsPage = () => {
    const { setCode } = useParams();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all'); // all, owned, missing
    const [cardFilter, setCardFilter] = useState(sessionStorage.getItem('mtg_card_search') || '');
    const { currentUser, userProfile } = useAuth();
    const { addToast } = useToast();
    const { cards: collectionCards, refresh } = useCollection();
    const { decks } = useDecks();

    // Sync cardFilter to sessionStorage whenever it changes
    useEffect(() => {
        if (cardFilter) {
            sessionStorage.setItem('mtg_card_search', cardFilter);
        } else {
            sessionStorage.removeItem('mtg_card_search');
        }
    }, [cardFilter]);

    // Map of Scryfall ID -> Array of UserCards
    // Indexed by all potential ID fields to ensure robust matching
    const collectionMap = useMemo(() => {
        const map = new Map();
        if (collectionCards) {
            collectionCards.forEach(c => {
                const keys = new Set();

                // Add all potential ID candidates
                if (c.scryfall_id) keys.add(c.scryfall_id);
                if (c.scryfallId) keys.add(c.scryfallId); // CamelCase check
                if (c.id) keys.add(c.id); // Potential database ID vs Scryfall ID ambiguity
                if (c.data?.id) keys.add(c.data.id);
                if (c.data?.scryfall_id) keys.add(c.data.scryfall_id);

                // Add to map for each unique key
                keys.forEach(k => {
                    if (!map.has(k)) map.set(k, []);
                    // Prevent duplicate pushing if a card indexes to multiple valid keys that are the same?
                    // No, map values are arrays. If we push the SAME card object multiple times to the SAME array, stats might double count.
                    // But here 'k' changes. The array at 'k' is unique or shared? 
                    // map.get(k) is the array for that ID.
                    // A card has only one "true" identity, but we don't know which field holds the key the Set Page has.
                    // It's safe to add the card to multiple 'buckets' (keys). 
                    // The Set Page only looks up ONE key (the ID it has). So it will get the array from that bucket.
                    map.get(k).push(c);
                });
            });

            // Deduplication within buckets is likely not needed unless the source list has dupes.
            // But if c.id == c.scryfall_id, we just adding to same bucket?
            // keys is a Set, so if c.id === c.scryfall_id, we only iterate once. Good.
        }
        return map;
    }, [collectionCards]);

    // Stats Calculation
    const stats = useMemo(() => {
        const uniqueNamesInSet = new Set(results.map(r => r.name));
        const ownedUniqueNames = new Set();
        let totalValueResult = 0;

        results.forEach(card => {
            const userCopies = collectionMap.get(card.scryfall_id || card.id) || [];
            const normalCount = userCopies
                .filter(c => c.finish === 'nonfoil' && !c.is_wishlist)
                .reduce((sum, c) => sum + (c.count ?? 1), 0);
            const foilCount = userCopies
                .filter(c => c.finish === 'foil' && !c.is_wishlist)
                .reduce((sum, c) => sum + (c.count ?? 1), 0);

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
        let base = results;

        // 1. Filter by ownership
        if (filter !== 'all') {
            base = base.filter(card => {
                const userCopies = collectionMap.get(card.scryfall_id || card.id) || [];
                const isOwned = userCopies.some(c => !c.is_wishlist && (c.count ?? 1) > 0);
                return filter === 'owned' ? isOwned : !isOwned;
            });
        }

        // 2. Filter by card name (if searching)
        if (cardFilter) {
            const query = cardFilter.toLowerCase();
            base = base.filter(card =>
                card.name.toLowerCase().includes(query) ||
                (card.data?.name_en || '').toLowerCase().includes(query)
            );
        }

        return base;
    }, [results, collectionMap, filter, cardFilter]);

    useEffect(() => {
        const fetchSetCards = async () => {
            if (!setCode) return;
            setLoading(true);
            try {
                const data = await api.get(`/api/sets/${setCode}/cards`);
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

    const handleUpdateCount = async (card, type, delta, absolute = null) => {
        if (!currentUser) return addToast("Please log in", "error");

        try {
            const scryfallId = card.id;
            const userCopies = collectionMap.get(scryfallId) || [];
            const finish = type === 'foil' ? 'foil' : 'nonfoil';

            // Calculate totals
            const totalOwned = userCopies
                .filter(c => c.finish === finish && !c.is_wishlist)
                .reduce((sum, c) => sum + (c.count || 1), 0);

            const deckCopies = userCopies
                .filter(c => c.finish === finish && !c.is_wishlist && c.deck_id)
                .reduce((sum, c) => sum + (c.count || 1), 0);

            // Determine target total
            let newTotal;
            if (absolute !== null) {
                newTotal = Math.max(0, parseInt(absolute));
            } else {
                newTotal = Math.max(0, totalOwned + delta);
            }

            // Calculate allowed binder count
            // Binder = Total - Decks
            // If newTotal < DeckCount, we would need to remove from decks -> Error
            if (newTotal < deckCopies) {
                addToast(`Cannot reduce count below ${deckCopies} (used in decks)`, 'error');
                return;
            }

            const newBinderCount = newTotal - deckCopies;
            const binderCard = userCopies.find(c => c.finish === finish && !c.deck_id && !c.is_wishlist);

            if (binderCard) {
                if (newBinderCount > 0) {
                    await collectionService.updateCard(binderCard.id, { count: newBinderCount });
                    const msg = absolute !== null ? `Updated ${finish} count to ${newTotal}` : `Added ${finish} ${card.name}`;
                    if (absolute !== null || delta > 0) addToast(msg, 'success');
                    else addToast(`Removed ${finish} ${card.name}`, 'info');
                } else {
                    await collectionService.removeCard(binderCard.id);
                    addToast(`Removed last binder copy of ${finish} ${card.name}`, 'info');
                }
            } else if (newBinderCount > 0) {
                await collectionService.addCardToCollection(currentUser.uid, card, newBinderCount, finish);
                addToast(`Added new ${finish} ${card.name}`, 'success');
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
            {/* Integrated Sticky Header */}
            <div className="sticky top-16 z-30 bg-gray-950/80 backdrop-blur-xl border-b border-white/10 shadow-2xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    {/* Top Row: Back, Title, and Stats */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
                        <div className="flex items-center gap-4">
                            <Link to="/sets" className="p-1.5 bg-gray-800/50 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-all group" title="Back to Sets">
                                <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none">
                                    {setCode} <span className="text-gray-500 font-bold ml-1">Library</span>
                                </h1>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1 opacity-70">Expansion Collection</p>
                            </div>
                        </div>

                        {/* Compact Stats Row */}
                        <div className="flex items-center gap-6 bg-gray-900/50 border border-white/5 px-4 py-2 rounded-xl">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Collected</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-black text-primary-400">{stats.collected}</span>
                                    <span className="text-gray-600 font-bold text-[10px]">/ {stats.total}</span>
                                </div>
                            </div>
                            <div className="w-[1px] h-4 bg-white/10" />
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Estimate Value</span>
                                <span className="text-sm font-black text-emerald-400 tabular-nums">${stats.value}</span>
                            </div>
                        </div>
                        {(userProfile?.tierConfig || getTierConfig(userProfile?.subscription_tier)).features.setAudit ? (
                            <StartAuditButton type="set" targetId={setCode} label="Audit Set" className="text-xs py-1.5" />
                        ) : (
                            <button
                                onClick={() => addToast(`Set Audits are available on ${TIER_CONFIG[TIERS.TIER_2].name} tier and above.`, 'info')}
                                className="bg-gray-800/50 border border-gray-700 text-gray-500 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest cursor-not-allowed flex items-center gap-2"
                                title={`Requires ${TIER_CONFIG[TIERS.TIER_2].name} Tier`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Audit Set
                            </button>
                        )}
                    </div>

                    {/* Bottom Row: Filters and Search */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-3 border-t border-white/5">
                        <div className="flex bg-gray-900/80 rounded-lg p-0.5 border border-white/5 w-full md:w-auto overflow-hidden">
                            {['all', 'owned', 'missing'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilter(type)}
                                    className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${filter === type
                                        ? 'bg-primary-600 text-white shadow-lg'
                                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto md:flex-1 justify-end">
                            <div className="relative w-full max-w-sm">
                                <CardAutocomplete
                                    value={cardFilter}
                                    onChange={setCardFilter}
                                    placeholder="Filter cards..."
                                />
                            </div>

                            {cardFilter && (
                                <button
                                    onClick={() => {
                                        setCardFilter('');
                                        sessionStorage.removeItem('mtg_card_search');
                                    }}
                                    className="p-2 bg-primary-500/10 border border-primary-500/30 text-primary-400 hover:bg-primary-500/20 hover:text-white rounded-lg transition-all"
                                    title="Clear filter"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* List Body */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

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
                            const userCopies = collectionMap.get(card.scryfall_id || card.id) || [];
                            const normalCount = userCopies
                                .filter(c => c.finish === 'nonfoil' && !c.is_wishlist)
                                .reduce((sum, c) => sum + (c.count || 1), 0);
                            const foilCount = userCopies
                                .filter(c => c.finish === 'foil' && !c.is_wishlist)
                                .reduce((sum, c) => sum + (c.count || 1), 0);
                            const wishlistCount = userCopies
                                .filter(c => c.is_wishlist)
                                .reduce((sum, c) => sum + (c.count || 1), 0);

                            return (
                                <InteractiveCard
                                    key={card.id || index}
                                    card={card}
                                    normalCount={normalCount} // This is binder only? No, let's check logic above.
                                    foilCount={foilCount}
                                    wishlistCount={wishlistCount}
                                    onUpdateCount={handleUpdateCount}
                                    onUpdateWishlistCount={handleUpdateWishlistCount}
                                    currentUser={userProfile}
                                    showOwnerTag={true}
                                    userCopies={userCopies} // For locations
                                    decks={decks} // For location names
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
