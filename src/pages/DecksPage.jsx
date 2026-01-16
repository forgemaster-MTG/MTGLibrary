import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDecks } from '../hooks/useDecks';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { communityService } from '../services/communityService';
import DeckRow from '../components/decks/DeckRow';
import SharedDeckRow from '../components/decks/SharedDeckRow';
import MarketTicker from '../components/dashboard/MarketTicker';
import { TIER_CONFIG } from '../config/tiers';

const DecksPage = () => {
    const { user, userProfile } = useAuth();
    const { addToast } = useToast();
    const [availableSources, setAvailableSources] = useState([]);

    // Fetch My Decks
    const { decks: myDecks, loading: myLoading, error: myError } = useDecks(null);

    // Fetch shared sources to iterate over
    useEffect(() => {
        const fetchSources = async () => {
            try {
                // Fetch incoming permissions
                const perms = await communityService.fetchIncomingPermissions();
                // Filter for Global Viewers (deckId is null)
                const globalShares = (Array.isArray(perms) ? perms : []).filter(p => !p.target_deck_id);
                setAvailableSources(globalShares);
            } catch (err) {
                console.error("Failed to load shared sources", err);
            }
        };
        if (user) fetchSources();
    }, [user]);

    const handleCreateDeck = (e) => {
        const limit = TIER_CONFIG[userProfile?.subscription_tier || 'free'].limits.decks;
        const current = myDecks?.length || 0;
        if (limit !== Infinity && current >= limit) {
            e.preventDefault();
            addToast(`Deck limit reached (${current}/${limit}). Upgrade to create more!`, 'error');
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
                {/* Header */}
                <div className="flex justify-between items-end mb-12">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">My Strategies</h1>
                        <p className="text-gray-400 font-medium">Manage your collection and view shared decks.</p>
                    </div>
                    <Link
                        to="/decks/new"
                        onClick={handleCreateDeck}
                        className="group bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 border border-indigo-400/20 hover:border-indigo-400"
                    >
                        <span className="text-xl leading-none font-light">+</span>
                        Create New Deck
                    </Link>
                </div>

                {/* Market Ticker */}
                <div className="mb-8">
                    <MarketTicker />
                </div>

                {/* My Decks Row */}
                <DeckRow
                    title="My Decks"
                    decks={myDecks}
                    loading={myLoading}
                    error={myError}
                    isOwner={true}
                />

                {/* Shared Decks Section */}
                {availableSources.length > 0 && (
                    <div className="mt-16 border-t border-white/5 pt-12">
                        <h2 className="text-xl font-bold text-gray-500 uppercase tracking-widest mb-8 flex items-center gap-4">
                            <span className="h-px bg-gray-800 flex-1" />
                            Shared Libraries
                            <span className="h-px bg-gray-800 flex-1" />
                        </h2>

                        <div className="space-y-4">
                            {availableSources.map(source => (
                                <SharedDeckRow key={source.id} friend={source} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DecksPage;
