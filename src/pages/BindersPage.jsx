import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDecks } from '../hooks/useDecks';
import { useAuth } from '../contexts/AuthContext';
import { deckService } from '../services/deckService';
import { useToast } from '../contexts/ToastContext';
import DeckRow from '../components/decks/DeckRow';
import { TIER_CONFIG } from '../config/tiers';

const BindersPage = () => {
    const { decks, loading, refresh } = useDecks();
    const { currentUser, userProfile } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [isCreating, setIsCreating] = useState(false);

    // Filter for decks with format 'binder'
    const binders = decks.filter(d => d.format === 'binder');

    const handleCreateBinder = async () => {
        setIsCreating(true);
        try {
            // Check tier limits if applicable
            const tierConfig = TIER_CONFIG[userProfile?.subscription_tier || 'free'];
            if (binders.length >= (tierConfig?.limits?.binders || 5)) { // Assuming a limit, default 5 for now
                addToast(`Upgrade to create more binders! (Limit: ${tierConfig?.limits?.binders || 5})`, 'error');
                return;
            }

            const name = `New Binder ${binders.length + 1}`;
            // Use dedicated create method
            const newBinder = await deckService.createDeck(currentUser.uid, {
                name,
                format: 'binder', // Important: Treat as binder format
                description: 'A dedicated trade binder.',
                isPublic: true // Backend expects isPublic (camelCase) based on create route? checking api.js...
                // deck.js line 231 destructures: { name, commander, ..., aiBlueprint, format }. 
                // Does NOT destructure isPublic. 
                // Line 241: is_mockup: req.body.isMockup || false.
                // It does NOT seem to set is_public on creation in router.post('/').
                // That might be a backend gap, but unrelated to the 500 error.
                // I will pass isPublic anyway just in case backend is updated later.
            });

            await refresh();
            addToast('Binder created!', 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to create binder.', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B0C15] pb-24 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Armory</span>
                        </h1>
                        <p className="text-gray-400 text-lg max-w-2xl">
                            Manage your trade binders and share your collection with the community.
                        </p>
                    </div>

                    <button
                        onClick={handleCreateBinder}
                        disabled={isCreating}
                        className="group bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 border border-indigo-400/20 hover:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCreating ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <span className="text-xl leading-none font-light">+</span>
                        )}
                        New Binder
                    </button>
                </div>

                {/* Binders Grid */}
                {binders.length > 0 ? (
                    <DeckRow
                        title="Your Binders"
                        decks={binders}
                        canCreate={false}
                    />
                ) : (
                    <div className="text-center py-24 bg-gray-900/30 rounded-3xl border border-dashed border-gray-700">
                        <div className="text-6xl mb-4">📓</div>
                        <h3 className="text-xl font-bold text-white mb-2">No Binders Yet</h3>
                        <p className="text-gray-400 mb-8 max-w-md mx-auto">
                            Create a binder to start organizing your trades or showcased cards separately from your playable decks.
                        </p>
                        <button
                            onClick={handleCreateBinder}
                            className="text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest text-xs hover:underline"
                        >
                            Create your first binder
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BindersPage;
