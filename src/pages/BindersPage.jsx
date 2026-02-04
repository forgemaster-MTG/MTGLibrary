import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBinders } from '../hooks/useBinders';
import { useToast } from '../contexts/ToastContext';
import { TIER_CONFIG } from '../config/tiers';
import FeatureTour from '../components/common/FeatureTour';
import BinderWizardModal from '../components/modals/BinderWizardModal';
import { api } from '../services/api';
import { communityService } from '../services/communityService';
import CardGridItem from '../components/common/CardGridItem';
import { useSearchParams, Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import SocialShareHub from '../components/Social/SocialShareHub';



// Re-implementing with useAuth and proper logic
const PodBindersList = ({ navigate }) => {
    const { currentUser } = useAuth();
    const [podBinders, setPodBinders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        const load = async () => {
            setLoading(true);
            try {
                // 1. Get Friends
                const rels = await communityService.fetchRelationships();
                // Check structure: API returns objects with `friend` property
                const friends = rels.filter(r => r.status === 'accepted').map(r => r.friend?.id).filter(Boolean);

                if (friends.length === 0) {
                    setPodBinders([]);
                    setLoading(false);
                    return;
                }

                // Fetch binders for each friend
                const promises = friends.map(fid =>
                    api.getBinders({ userId: fid }).catch(() => [])
                );

                const results = await Promise.all(promises);
                const flat = results.flat().filter(b => b.is_trade || b.is_public);

                // Add owner info if missing (API might not return owner name if flattened?)
                // API `getBinders` returns rows from `binders`. 
                // We might need to know WHOSE binder it is.
                // The binder row has `user_id`. We can Map ID back to username if we have it?
                // Or we fetch username separately?
                // For MVP, display user_id or generic "Friend's Binder".
                // Better: The relationships endpoint usually returns the friend's profile.

                // Hack: Let's assume the API returns the binder, and we trust `user_id`.
                setPodBinders(flat);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [currentUser]);

    if (loading) return null; // or skeleton
    if (podBinders.length === 0) return null;

    return (
        <div className="mt-16 animate-fade-in">
            <div className="flex items-center gap-4 mb-8">
                <h2 className="text-3xl font-black text-white tracking-tight">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Pod Trades</span>
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-amber-500/50 to-transparent" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {podBinders.map(binder => (
                    <BinderFolderCard
                        key={binder.id}
                        binder={binder}
                        onClick={() => navigate(`/collection?folder=binder-${binder.id}&view=folder`)}
                        onEdit={() => { }} // No edit for others
                        isReadOnly={true}
                    />
                ))}
            </div>
        </div>
    );
};

const BinderFolderCard = ({ binder, onClick, onEdit, isReadOnly }) => {
    // Style matching CollectionPage folder view
    const color = binder.color_preference || 'blue';
    const icon = binder.icon_value || '📁';
    const isSmart = !!binder.rules;
    const isOwner = !isReadOnly; // approximation

    // Status visual checks
    const isTrade = binder.is_trade;
    const isPublic = binder.is_public;
    const isSell = binder.name.toLowerCase().includes('sell') || binder.name.toLowerCase().includes('sale');

    return (
        <div
            onClick={onClick}
            className="group relative bg-[#13141f] hover:bg-[#1a1b26] border border-gray-800 hover:border-indigo-500/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 overflow-hidden"
        >
            {/* Background Glow */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl group-hover:bg-${color}-500/20 transition-colors`} />

            {/* Smart Badge */}
            {isSmart && (
                <span className="absolute top-4 left-4 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                    Smart
                </span>
            )}

            {/* Type Badges (Top Right) */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                {isPublic && (
                    <span className="text-[9px] bg-sky-900/30 text-sky-400 px-2 py-0.5 rounded border border-sky-500/30 flex items-center gap-1 font-bold uppercase tracking-wider backdrop-blur-sm">
                        Public
                    </span>
                )}
                {isTrade && (
                    <span className="text-[9px] bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-bold uppercase tracking-wider backdrop-blur-sm">
                        Trade
                    </span>
                )}
                {isSell && (
                    <span className="text-[9px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1 font-bold uppercase tracking-wider backdrop-blur-sm">
                        $$$
                    </span>
                )}
            </div>

            {/* Icon */}
            <div className="flex gap-1 mb-6 group-hover:scale-110 transition-transform relative z-10">
                {icon.startsWith('ms') ? (
                    <div className={`w-16 h-16 bg-${color}-900/30 text-${color}-400 rounded-2xl flex items-center justify-center text-4xl`}>
                        <i className={`ms ${icon} ms-cost`}></i>
                    </div>
                ) : (
                    <div className={`w-16 h-16 bg-${color}-900/30 text-${color}-400 rounded-2xl flex items-center justify-center text-4xl`}>
                        {icon}
                    </div>
                )}
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-white mb-2 leading-tight group-hover:text-indigo-300 transition-colors line-clamp-2 relative z-10">
                {binder.name}
            </h3>

            {/* Card Count (if available) - Optional enhancement */}
            <div className="text-xs text-gray-500 font-mono relative z-10">
                View Binder &rarr;
            </div>

            {/* Owner Tag for Pod Binders */}
            {!isOwner && binder.owner_username && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800/80 text-gray-400 text-[10px] px-2 py-1 rounded-full border border-gray-700 whitespace-nowrap">
                    👤 {binder.owner_username}
                </div>
            )}

            {/* Edit Button (visible on hover) - Only if Owner */}
            {isOwner && (
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(binder); }}
                    className="absolute top-4 left-4 p-2 text-gray-600 hover:text-white bg-black/20 hover:bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-all z-20"
                    title="Edit Binder Settings"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
            )}
        </div>
    );
};


const BinderDetailView = ({ binderId, onBack, currentUserId }) => {
    const [binder, setBinder] = useState(null);
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [sharingCard, setSharingCard] = useState(null);
    const { addToast } = useToast();

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Fetch Binder Metadata & Cards in parallel
                const [binderRes, cardsRes] = await Promise.all([
                    api.getBinder(binderId),
                    api.getBinderCards(binderId)
                ]);
                setBinder(binderRes);
                setCards(cardsRes);
            } catch (err) {
                console.error("Failed to load binder details", err);
                setError("Failed to load binder. It may be private or deleted.");
            } finally {
                setLoading(false);
            }
        };
        if (binderId) load();
    }, [binderId]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-indigo-400 font-bold tracking-widest text-xs animate-pulse">OPENING BINDER...</p>
        </div>
    );

    if (error) return (
        <div className="text-center py-24">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-white mb-2">Access Denied</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <button onClick={onBack} className="text-indigo-400 hover:text-white underline">Return to Armory</button>
        </div>
    );

    if (!binder) return null;

    const color = binder.color_preference || 'blue';

    // isOwner check
    const isOwner = String(binder.user_id) === String(currentUserId);

    return (
        <div className="animate-fade-in space-y-8">
            {/* Header / Navigation */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-95"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight leading-none">{binder.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-${color}-500/20 text-${color}-400 border border-${color}-500/30`}>
                            {binder.type || 'Binder'}
                        </span>
                        {!isOwner && (
                            <span className="text-[10px] text-gray-500 font-mono">
                                Owned by {binder.owner_username || 'Friend'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="ml-auto">
                    <button
                        onClick={() => setIsShareOpen(true)}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-indigo-400 hover:text-white transition-all active:scale-95 border border-white/5 hover:border-indigo-500/30 shadow-xl"
                        title="Share Binder"
                    >
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <SocialShareHub
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                type="binder"
                shareUrl={`${window.location.origin}/share/binder?id=${binderId}`}
                data={{
                    title: binder.name,
                    win: binder.is_trade ? "Ready to Trade" : (binder.is_public ? "Showcase Curator" : "Master Collector"),
                    stats: [
                        { label: "Total Cards", value: cards.length },
                        { label: "Visibility", value: binder.is_public ? "Public" : "Private", highlight: true },
                        { label: "Purpose", value: binder.is_trade ? "Trading" : "Collection" }
                    ]
                }}
            />

            {/* Cards Grid */}
            {cards.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {cards.map(card => (
                        <CardGridItem
                            key={card.id || card.firestoreId}
                            card={card}
                            currentUser={{ id: currentUserId }} // For ownership badges
                            onShare={(c) => setSharingCard(c)}
                        // Basic props for now, no complex selection logic yet
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 bg-gray-900/30 rounded-3xl border border-dashed border-gray-700/50">
                    <p className="text-gray-500 italic">This binder is empty.</p>
                </div>
            )}

            {sharingCard && (
                <SocialShareHub
                    isOpen={!!sharingCard}
                    onClose={() => setSharingCard(null)}
                    type="card"
                    shareUrl={`${window.location.origin}/card/${sharingCard.id || sharingCard.card_id}`}
                    data={{
                        title: sharingCard.name,
                        win: (sharingCard.rarity || 'Common').toUpperCase() + " Rarity",
                        cardImage: sharingCard.image_uris?.normal || sharingCard.image_uri || sharingCard.data?.image_uris?.normal,
                        stats: [
                            { label: "Type", value: sharingCard.type_line?.split('—')?.[0]?.trim() || 'Spell' },
                            { label: "Cost", value: sharingCard.mana_cost || '0', highlight: true },
                            { label: "Price", value: `$${Number(sharingCard.prices?.usd || 0).toFixed(2)}` }
                        ]
                    }}
                />
            )}
        </div>
    );
};

const BindersPage = () => {
    const { binders, loading, refreshBinders } = useBinders();
    const { currentUser, userProfile } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Inline View Logic
    const activeBinderId = searchParams.get('binder');

    // Modal State
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingBinder, setEditingBinder] = useState(null);

    // Tour
    const [isTourOpen, setIsTourOpen] = useState(false);
    useEffect(() => {
        const handleStartTour = () => setIsTourOpen(true);
        window.addEventListener('start-tour', handleStartTour);
        if (!localStorage.getItem('tour_seen_binders_tour_v2')) { // New version
            setTimeout(() => setIsTourOpen(true), 1000);
        }
        return () => window.removeEventListener('start-tour', handleStartTour);
    }, []);

    const TOUR_STEPS = [
        { target: 'h1', title: 'The Armory', content: 'This is where your Binders live. Separate your collection into trade binders, project boxes, or showcase displays.' },
        { target: '#new-binder-btn', title: 'Create Binder', content: 'Create a new manual binder or a Smart Binder that automatically fills itself based on rules.' }
    ];

    const handleCreateWrapper = () => {
        // Check tier limits
        const tierConfig = TIER_CONFIG[userProfile?.subscription_tier || 'free'];
        // const limit = tierConfig?.features?.binders ? 99 : 0; // If feature allowed, unlimited? Or specific limit?
        // Assuming 'binders' boolean in feature list means access. 
        // If not allowed, show toast.

        if (!tierConfig?.features?.binders) {
            addToast(`Binders are available on Wizard tier and above.`, 'info');
            return;
        }

        setEditingBinder(null);
        setIsWizardOpen(true);
    };

    const handleEditBinder = (binder) => {
        setEditingBinder(binder);
        setIsWizardOpen(true);
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
            {/* Immersive Background */}
            <div
                className="fixed inset-0 z-0 bg-cover bg-center transform-gpu opacity-20"
                style={{ backgroundImage: 'url(/MTG-Forge_Logo_Background.png)' }}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                {/* Header - Only hide if viewing details? Or keep "Armory"? Let's keep Armory as global header */}
                {!activeBinderId && (
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-fade-in-down">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Armory</span>
                            </h1>
                            <p className="text-gray-400 text-lg max-w-2xl">
                                Manage your trade binders and share your collection with the community.
                            </p>
                        </div>

                        <button
                            id="new-binder-btn"
                            onClick={handleCreateWrapper}
                            className="group bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 border border-indigo-400/20 hover:border-indigo-400"
                        >
                            <span className="text-xl leading-none font-light">+</span>
                            New Binder
                        </button>
                    </div>
                )}

                {/* Content Area */}
                {activeBinderId ? (
                    <BinderDetailView
                        binderId={activeBinderId}
                        onBack={() => setSearchParams({})}
                        currentUserId={userProfile?.id}
                    />
                ) : (
                    <>
                        {/* Binders Grid */}
                        {binders.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in-up">
                                {binders.map((binder) => (
                                    <BinderFolderCard
                                        key={binder.id}
                                        binder={binder}
                                        onClick={() => setSearchParams({ binder: binder.id })}
                                        onEdit={handleEditBinder}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-24 bg-gray-900/30 rounded-3xl border border-dashed border-gray-700">
                                <div className="text-6xl mb-4">📓</div>
                                <h3 className="text-xl font-bold text-white mb-2">No Binders Yet</h3>
                                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                                    Create a binder to start organizing your trades or showcased cards separately from your playable decks.
                                </p>
                                <button
                                    onClick={handleCreateWrapper}
                                    className="text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest text-xs hover:underline"
                                >
                                    Create your first binder
                                </button>
                            </div>
                        )}

                        {/* Pod Trade Binders Section */}
                        <PodBindersList navigate={(path) => {
                            // Intercept navigation for PodBinders to use inline view if it's a binder link
                            // Previously: navigate(`/collection?folder=binder-${binder.id}&view=folder`)
                            // We want to extract ID and set search param ?binder=ID
                            if (path.includes('folder=binder-')) {
                                const match = path.match(/binder-(\d+)/);
                                if (match && match[1]) {
                                    setSearchParams({ binder: match[1] });
                                } else {
                                    navigate(path);
                                }
                            } else {
                                navigate(path);
                            }
                        }} />
                    </>
                )}
            </div>

            <FeatureTour
                steps={TOUR_STEPS}
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                tourId="binders_tour_v2"
            />

            <BinderWizardModal
                isOpen={isWizardOpen}
                onClose={() => {
                    setIsWizardOpen(false);
                    setEditingBinder(null);
                    refreshBinders();
                }}
                editingBinder={editingBinder}
            />
        </div >
    );
};

export default BindersPage;
