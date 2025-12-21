import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useScryfall } from '../hooks/useScryfall';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { collectionService } from '../services/collectionService';
import CardSkeleton from '../components/CardSkeleton';

const SetDetailsPage = () => {
    const { setCode } = useParams();
    const { results, loading, error, searchCards } = useScryfall();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [addingId, setAddingId] = useState(null);

    useEffect(() => {
        if (setCode) {
            // Search for all cards in this set
            // order:set is standard for set views (sorted by collector number)
            searchCards(`set:${setCode} order:set`);
        }
    }, [setCode, searchCards]);

    const handleAdd = async (card) => {
        if (!currentUser) {
            addToast("Please log in to add cards", "error");
            return;
        }
        try {
            setAddingId(card.id);
            const result = await collectionService.addCardToCollection(currentUser.uid, card);
            if (result.type === 'update') {
                addToast(`Updated ${result.name} count to ${result.count}`, 'success');
            } else {
                addToast(`Added ${result.name} to collection`, 'success');
            }
        } catch (err) {
            console.error(err);
            addToast("Failed to add card", 'error');
        } finally {
            setAddingId(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 border-b border-gray-700 pb-4">
                <Link to="/sets" className="text-gray-400 hover:text-white mb-2 inline-block transition-colors">&larr; Back to Sets</Link>
                <h1 className="text-3xl font-bold text-white uppercase tracking-wider">{setCode} Set Details</h1>
                <p className="text-gray-400 text-sm mt-1">Showing cards from Scryfall database</p>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : error ? (
                <div className="text-center text-red-500 py-12">
                    Error loading set: {error}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {results.map((card) => {
                        const img = card.image_uris?.normal || card.image_uris?.small || (card.card_faces && card.card_faces[0]?.image_uris?.normal) || 'https://placehold.co/250x350?text=No+Image';
                        return (
                            <div key={card.id} className="relative group aspect-[2.5/3.5] bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 hover:border-indigo-500 transition-all">
                                <img
                                    src={img}
                                    alt={card.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center p-4 text-center">
                                    <h4 className="text-white font-bold text-sm mb-1">{card.name}</h4>
                                    <p className="text-gray-400 text-xs mb-3">{card.type_line}</p>

                                    <button
                                        onClick={() => handleAdd(card)}
                                        disabled={addingId === card.id}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg transform active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        {addingId === card.id ? (
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        )}
                                        Add
                                    </button>
                                </div>

                                {/* Rarity Indicator (Corner) */}
                                <div className={`absolute bottom-0 right-0 w-full h-1 
                                    ${card.rarity === 'common' ? 'bg-black' : ''}
                                    ${card.rarity === 'uncommon' ? 'bg-gray-400' : ''}
                                    ${card.rarity === 'rare' ? 'bg-yellow-500' : ''}
                                    ${card.rarity === 'mythic' ? 'bg-orange-600' : ''}
                                `}></div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SetDetailsPage;
