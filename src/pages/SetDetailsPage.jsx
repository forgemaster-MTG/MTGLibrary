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
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { cards: collectionCards, refresh } = useCollection();

    // Map of Scryfall ID -> Array of UserCards
    const collectionMap = useMemo(() => {
        const map = new Map();
        if (collectionCards) {
            collectionCards.forEach(c => {
                const scryfallId = c.scryfall_id || c.id; // Existing coll items use scryfall_id usually
                if (!map.has(scryfallId)) map.set(scryfallId, []);
                map.get(scryfallId).push(c);
            });
        }
        return map;
    }, [collectionCards]);

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

            // Filter by finish (and deck_id null => binder only?)
            // For now, we update ANY copy in binder matching the finish.
            const finish = type === 'foil' ? 'foil' : 'nonfoil';
            const existing = userCopies.find(c => c.finish === finish && !c.deck_id);

            if (delta > 0) {
                // ADD
                if (existing) {
                    await collectionService.updateCard(existing.id, { count: existing.count + 1 });
                    addToast(`Added ${finish} ${card.name}`, 'success');
                } else {
                    await collectionService.addCardToCollection(currentUser.uid, card, 1, finish);
                    addToast(`Added new ${finish} ${card.name}`, 'success');
                }
            } else {
                // REMOVE
                if (existing) {
                    if (existing.count > 1) {
                        await collectionService.updateCard(existing.id, { count: existing.count - 1 });
                        addToast(`Removed ${finish} ${card.name}`, 'info');
                    } else {
                        // Count is 1 -> 0, remove
                        await collectionService.removeCard(existing.id);
                        addToast(`Removed last ${finish} ${card.name}`, 'info');
                    }
                }
            }
            // Refresh collection to update UI
            refresh();

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
                    await collectionService.updateCard(existing.id, { count: existing.count + 1 });
                    addToast(`Increased wishlist for ${card.name}`, 'success');
                } else {
                    await collectionService.addCardToCollection(currentUser.uid, card, 1, 'nonfoil', true);
                    addToast(`Added ${card.name} to wishlist`, 'success');
                }
            } else {
                if (existing) {
                    if (existing.count > 1) {
                        await collectionService.updateCard(existing.id, { count: existing.count - 1 });
                        addToast(`Decreased wishlist for ${card.name}`, 'info');
                    } else {
                        await collectionService.removeCard(existing.id);
                        addToast(`Removed ${card.name} from wishlist`, 'info');
                    }
                }
            }
            refresh();
        } catch (err) {
            console.error("Wishlist update failed", err);
            addToast("Failed to update wishlist", "error");
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 border-b border-gray-700 pb-4">
                <Link to="/sets" className="text-gray-400 hover:text-white mb-2 inline-block transition-colors">&larr; Back to Sets</Link>
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-white uppercase tracking-wider">{setCode} Set Details</h1>
                        <p className="text-gray-400 text-sm mt-1">Manage your collection for this set</p>
                    </div>
                    <p className="text-gray-500 text-sm">{results.length} Cards</p>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : error ? (
                <div className="text-center text-red-500 py-12">
                    Error loading set: {error}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {results.map((card, index) => {
                        // Calculate counts
                        const userCopies = collectionMap.get(card.id) || [];
                        const normalCount = userCopies
                            .filter(c => c.finish === 'nonfoil' && !c.deck_id)
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
    );
};

export default SetDetailsPage;
