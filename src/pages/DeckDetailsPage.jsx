import React, { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDeck } from '../hooks/useDeck';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { deckService } from '../services/deckService';
import CardSearchModal from '../components/CardSearchModal';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import DeckSuggestionsModal from '../components/modals/DeckSuggestionsModal';
import AddFromCollectionModal from '../components/modals/AddFromCollectionModal';
import DeckCharts from '../components/DeckCharts';
import DeckAdvancedStats from '../components/DeckAdvancedStats';
import DeckStatsModal from '../components/modals/DeckStatsModal';
import DeckStrategyModal from '../components/modals/DeckStrategyModal';
import DeckAI from '../components/DeckAI';
import CardGridItem from '../components/common/CardGridItem';

const MTG_IDENTITY_REGISTRY = [
    { badge: "White", colors: ["W"], theme: "Absolute Order", flavor_text: "A single spark of light can banish a world of shadows." },
    { badge: "Blue", colors: ["U"], theme: "Infinite Inquiry", flavor_text: "The mind is the only battlefield where victory is absolute." },
    { badge: "Black", colors: ["B"], theme: "Unrestricted Power", flavor_text: "Power at any cost, for greatness is written in blood." },
    { badge: "Red", colors: ["R"], theme: "Chaotic Passion", flavor_text: "Do not fear the fire; fear the heart that commands it." },
    { badge: "Green", colors: ["G"], theme: "Primal Growth", flavor_text: "The forest does not ask for permission to grow." },
    { badge: "Azorius", colors: ["W", "U"], theme: "Bureaucratic Control", flavor_text: "Justice is blind, but she has a very long reach." },
    { badge: "Dimir", colors: ["U", "B"], theme: "Subterfuge & Infiltration", flavor_text: "The finest secrets are those that kill the ones who keep them." },
    { badge: "Rakdos", colors: ["B", "R"], theme: "Carnival of Carnage", flavor_text: "Entertain us, or become the entertainment." },
    { badge: "Gruul", colors: ["R", "G"], theme: "Primal Destruction", flavor_text: "Not for city-dwellers. Not for the weak. Only for the weak." },
    { badge: "Selesnya", colors: ["G", "W"], theme: "Collective Harmony", flavor_text: "One voice is a whisper; the Conclave is a roar." },
    { badge: "Orzhov", colors: ["W", "B"], theme: "Indentured Eternity", flavor_text: "Even death is no excuse for a breach of contract." },
    { badge: "Izzet", colors: ["U", "R"], theme: "Volatile Genius", flavor_text: "If it doesn’t explode, you aren't trying hard enough." },
    { badge: "Golgari", colors: ["B", "G"], theme: "Cycles of Rot", flavor_text: "Every grave is a garden if you wait long enough." },
    { badge: "Boros", colors: ["R", "W"], theme: "Tactical Aggression", flavor_text: "First to the fight, last to the fall." },
    { badge: "Simic", colors: ["G", "U"], theme: "Biological Evolution", flavor_text: "Nature is a rough draft; we are the final edit." },
    { badge: "Esper", colors: ["W", "U", "B"], theme: "Obsidian Logic", flavor_text: "Perfection is not a goal; it is a requirement." },
    { badge: "Grixis", colors: ["U", "B", "R"], theme: "Ruthless Tyranny", flavor_text: "A wasteland of power where only the cruelest thrive." },
    { badge: "Jund", colors: ["B", "R", "G"], theme: "Apex Predation", flavor_text: "In this world, you are either the dragon or the meal." },
    { badge: "Naya", colors: ["R", "G", "W"], theme: "Primal Majesty", flavor_text: "Where the mountains wake and the earth trembles." },
    { badge: "Bant", colors: ["G", "W", "U"], theme: "Knightly Order", flavor_text: "The sigil of the sun protects those who stand together." },
    { badge: "Abzan", colors: ["W", "B", "G"], theme: "Eternal Endurance", flavor_text: "We do not break; we simply outlast." },
    { badge: "Jeskai", colors: ["U", "R", "W"], theme: "Disciplined Spark", flavor_text: "The wind carries the strike; the mind guides the bolt." },
    { badge: "Sultai", colors: ["B", "G", "U"], theme: "Opulent Decay", flavor_text: "Power is measured in gold and the bones of the fallen." },
    { badge: "Mardu", colors: ["R", "W", "B"], theme: "Relentless Conquest", flavor_text: "Victory is the only law worth following." },
    { badge: "Temur", colors: ["G", "U", "R"], theme: "Elemental Instinct", flavor_text: "The wild does not think; it reacts with ice and fire." },
    { badge: "Glint-Eye", colors: ["U", "B", "R", "G"], theme: "Chaotic Adaptation", flavor_text: "Order is a cage; we have chosen to break the locks." },
    { badge: "Dune-Brood", colors: ["W", "B", "R", "G"], theme: "Sandless Conquest", flavor_text: "When the logic of the mind fails, the instinct of the swarm prevails." },
    { badge: "Ink-Treader", colors: ["W", "U", "R", "G"], theme: "Radiant Reflection", flavor_text: "To touch one is to touch the whole of the world." },
    { badge: "Witch-Maw", colors: ["W", "U", "B", "G"], theme: "Eldritch Growth", flavor_text: "There is a hunger beneath the earth that knows no fire." },
    { badge: "Yore-Tiller", colors: ["W", "U", "B", "R"], theme: "Relentless History", flavor_text: "The past is a weapon we sharpen for the future." },
    { badge: "WUBRG", colors: ["W", "U", "B", "R", "G"], theme: "The Convergence", flavor_text: "The full spectrum of power, bound in a single hand." },
    { badge: "Colorless", colors: ["C"], theme: "The Great Void", flavor_text: "Existence is a fleeting dream in the eyes of the silent." }
];

const DeckDetailsPage = () => {
    const { deckId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile, updateSettings } = useAuth();
    const { addToast } = useToast();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAddCollectionOpen, setIsAddCollectionOpen] = useState(false);

    // Edit Mode State
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    // Modals State
    const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

    const [showStats, setShowStats] = useState(true);
    // Initialize from settings or default to 'grid'
    const [viewMode, setViewModeState] = useState(userProfile?.settings?.deckViewMode || 'grid');

    const setViewMode = (mode) => {
        setViewModeState(mode);
        updateSettings({ deckViewMode: mode });
    };

    const { deck, cards: deckCards, loading: deckLoading, error: deckError } = useDeck(deckId);
    const { cards: collection } = useCollection();

    // Identity Lookup (Must be before early returns)
    const identityInfo = useMemo(() => {
        const deckColors = deck?.commander?.color_identity || [];
        if (!deck || deckColors.length === 0) return MTG_IDENTITY_REGISTRY.find(i => i.badge === 'Colorless');

        // Perfect match search
        const match = MTG_IDENTITY_REGISTRY.find(entry => {
            if (entry.colors.length !== deckColors.length) return false;
            return entry.colors.every(c => deckColors.includes(c));
        });

        return match || MTG_IDENTITY_REGISTRY.find(i => i.badge === 'Colorless');
    }, [deck]);

    // Calculate Available Foils
    const availableFoils = useMemo(() => {
        if (!collection) return new Set();
        const foils = new Set();
        collection.forEach(c => {
            if (c.finish === 'foil' && !c.deckId) {
                foils.add(c.name);
            }
        });
        return foils;
    }, [collection]);

    // Helpers (Moved here to be used in useMemo)
    const countByType = (type) => {
        if (!deckCards) return 0;
        return deckCards.reduce((acc, c) => (((c.data?.type_line || c.type_line) || '').includes(type) ? acc + (c.countInDeck || 1) : acc), 0);
    };

    const totalCards = useMemo(() => {
        return deckCards ? deckCards.reduce((acc, c) => acc + (c.countInDeck || 1), 0) : 0;
    }, [deckCards]);

    const ownedCardsCount = useMemo(() => {
        if (!deckCards) return 0;
        return deckCards
            .filter(c => !c.is_wishlist)
            .reduce((acc, c) => acc + (c.countInDeck || 1), 0);
    }, [deckCards]);

    const totalValue = useMemo(() => {
        if (!deckCards) return 0;
        return deckCards.reduce((acc, c) => {
            const price = parseFloat(c.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd']) || (parseFloat(c.data?.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd']) || 0);
            return acc + (price * (c.countInDeck || 1));
        }, 0);
    }, [deckCards]);

    // KPI Calculations (Moved before early returns)
    const kpiData = useMemo(() => {
        const blueprint = deck?.aiBlueprint || {};
        const targets = blueprint.suggestedCounts || {};

        return [
            { label: 'Total', current: totalCards, target: targets.Total || (deck?.format === 'commander' ? 100 : 60) },
            { label: 'Creatures', current: countByType('Creature'), target: targets.Creatures || targets.Creature || 30 },
            { label: 'Lands', current: countByType('Land'), target: targets.Lands || targets.Land || 36 },
            { label: 'Instants', current: countByType('Instant'), target: targets.Instants || targets.Instant || 10 },
            { label: 'Sorceries', current: countByType('Sorcery'), target: targets.Sorceries || targets.Sorcery || 10 },
            { label: 'Enchantments', current: countByType('Enchantment'), target: targets.Enchantments || targets.Enchantment || 5 },
            { label: 'Artifacts', current: countByType('Artifact'), target: targets.Artifacts || targets.Artifact || 10 },
            { label: 'Planeswalkers', current: countByType('Planeswalker'), target: targets.Planeswalkers || targets.Planeswalker || 0 },
        ];
    }, [deck, totalCards, deckCards]);

    // Group cards (Moved before early returns)
    const groupedCards = useMemo(() => {
        if (!deckCards) return {};
        const groups = {
            Commander: [], Creature: [], Planeswalker: [], Instant: [],
            Sorcery: [], Artifact: [], Enchantment: [], Land: [], Other: []
        };

        const commanderId = deck?.commander?.id;
        deckCards.forEach(c => {
            const cardData = c;
            const typeLine = ((cardData.data?.type_line || cardData.type_line) || '').toLowerCase();

            if (commanderId && (cardData.id === commanderId || cardData.oracle_id === deck?.commander?.oracle_id)) {
                groups.Commander.push(cardData);
                return;
            }

            if (typeLine.includes('creature')) groups.Creature.push(cardData);
            else if (typeLine.includes('planeswalker')) groups.Planeswalker.push(cardData);
            else if (typeLine.includes('instant')) groups.Instant.push(cardData);
            else if (typeLine.includes('sorcery')) groups.Sorcery.push(cardData);
            else if (typeLine.includes('artifact')) groups.Artifact.push(cardData);
            else if (typeLine.includes('enchantment')) groups.Enchantment.push(cardData);
            else if (typeLine.includes('land')) groups.Land.push(cardData);
            else groups.Other.push(cardData);
        });

        return Object.fromEntries(Object.entries(groups).filter(([_, list]) => list.length > 0));
    }, [deckCards, deck]);

    // Handlers
    const handleExportDeck = () => {
        if (!deck || !deckCards) return;
        const backup = {
            deck: {
                name: deck.name,
                commander: deck.commander
            },
            cards: deckCards, // Full card objects
            exported_at: new Date()
        };

        const dataStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `${deck.name.replace(/[^a-z0-9]/yi, '_')}_backup.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleAddToDeck = async (card) => {
        try {
            await deckService.addCardToDeck(currentUser.uid, deckId, card);
            addToast(`Added ${card.name} to deck`, 'success');
        } catch (err) {
            console.error(err);
            addToast('Failed to add card to deck', 'error');
        }
    };

    const handleRemoveFromDeck = async (cardId, cardName) => {
        setConfirmModal({
            isOpen: true,
            title: 'Remove Card',
            message: `Are you sure you want to remove ${cardName} from this deck?`,
            onConfirm: async () => {
                try {
                    await deckService.removeCardFromDeck(currentUser.uid, deckId, cardId); // cardId is managedId
                    addToast(`Removed ${cardName} from deck`, 'success');
                } catch (err) {
                    console.error(err);
                    addToast('Failed to remove card', 'error');
                }
            }
        });
    };

    // Helper to robustly get image URL from various potential structures
    const getCardImage = (card) => {
        if (!card) return 'https://placehold.co/250x350?text=No+Image';
        const data = card.data || card; // Handle both structures (flat or nested)

        // 1. Check direct image_uris (normal) on data object
        if (data.image_uris?.normal) return data.image_uris.normal;

        // 2. Check 2-sided cards (card_faces) on data object
        if (data.card_faces?.[0]?.image_uris?.normal) return data.card_faces[0].image_uris.normal;

        // 3. Check table column 'image_uri' (singular) if present
        if (card.image_uri) return card.image_uri;

        // 4. Fallback
        return 'https://placehold.co/250x350?text=No+Image';
    };

    const handleStartEdit = () => {
        setEditName(deck.name);
        setIsEditingName(true);
    };

    const handleSaveName = async () => {
        try {
            await deckService.updateDeck(currentUser.uid, deckId, { name: editName });
            addToast('Deck renamed successfully', 'success');
            setIsEditingName(false);
            window.location.reload();
        } catch (err) {
            console.error(err);
            addToast('Failed to rename deck', 'error');
        }
    };

    const handleToggleMockup = async () => {
        try {
            await deckService.updateDeck(currentUser.uid, deckId, { is_mockup: !deck.is_mockup });
            addToast(`Deck set to ${!deck.is_mockup ? 'Mockup' : 'Collection'} mode`, 'info');
            window.location.reload();
        } catch (err) {
            console.error(err);
            addToast('Failed to update deck mode', 'error');
        }
    };

    const handleDeleteDeck = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Deck',
            message: 'Are you sure you want to delete this deck? Cards inside will be returned to your collection binder.',
            onConfirm: async () => {
                try {
                    await deckService.deleteDeck(currentUser.uid, deckId);
                    addToast('Deck deleted successfully', 'success');
                    navigate('/decks');
                } catch (err) {
                    console.error(err);
                    addToast('Failed to delete deck', 'error');
                }
            }
        });
    };

    const getArtCrop = (card) => {
        if (!card) return '';
        const data = card.data || card;

        if (data.image_uris?.art_crop) return data.image_uris.art_crop;
        if (data.card_faces?.[0]?.image_uris?.art_crop) return data.card_faces[0].image_uris.art_crop;
        if (data.image_uris?.normal) return data.image_uris.normal; // fallback to normal if art crop missing
        if (card.image_uri) return card.image_uri;

        return '';
    };

    // Loading/Error States - MUST BE AFTER ALL HOOKS
    if (deckLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500"></div></div>;
    if (deckError) return <div className="p-20 text-center text-red-500 text-xl font-bold">Error loading deck: {deckError.message}</div>;
    if (!deck) return null;


    const commanderImage = getArtCrop(deck.commander);
    const colorIdentityMap = { W: 'https://svgs.scryfall.io/card-symbols/W.svg', U: 'https://svgs.scryfall.io/card-symbols/U.svg', B: 'https://svgs.scryfall.io/card-symbols/B.svg', R: 'https://svgs.scryfall.io/card-symbols/R.svg', G: 'https://svgs.scryfall.io/card-symbols/G.svg' };

    return (
        <div className="relative min-h-screen">
            {/* Immersive Background */}
            <div
                className="fixed inset-0 z-0 transition-all duration-1000 ease-in-out"
                style={{
                    backgroundImage: `url(${commanderImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-[2px]" />
            </div>

            <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 animate-fade-in pb-24 relative z-10">


                <div className="sticky top-16 z-40 px-4 md:px-8 py-3 bg-gray-950/40 backdrop-blur-3xl border-b border-white/5 shadow-2xl transition-all duration-300 rounded-b-3xl mx-2">
                    <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row justify-between items-center gap-6">
                        {/* Left: Identity */}
                        <div className="flex items-center gap-6 w-full lg:w-auto">
                            <button
                                onClick={() => navigate('/decks')}
                                className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl border border-white/5 transition-all shrink-0 group"
                                title="Back to Decks"
                            >
                                <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </button>
                            <div className="flex-1 min-w-0">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="bg-black/50 text-2xl font-black text-white border-b-2 border-indigo-500 outline-none px-2 py-1 w-full max-w-md backdrop-blur-sm rounded"
                                            autoFocus
                                        />
                                        <button onClick={handleSaveName} className="p-2 bg-green-600 rounded-lg hover:bg-green-500 text-white shadow-lg">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-3 group">
                                            <h2 className="text-4xl font-black text-white tracking-tighter uppercase truncate leading-none">{deck.name}</h2>
                                            <button onClick={handleStartEdit} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 pl-0.5">
                                            <div className="text-[11px] text-indigo-300 font-black uppercase tracking-[0.2em] opacity-80">
                                                {identityInfo.badge} — {identityInfo.theme}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {(deck?.commander?.color_identity || []).map(color => (
                                                    <img
                                                        key={color}
                                                        src={colorIdentityMap[color]}
                                                        alt={color}
                                                        className="w-4 h-4 shadow-sm"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 mt-3">
                                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 backdrop-blur-md shadow-2xl">
                                        <span className="bg-orange-600/20 text-orange-400 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-500/30">
                                            {deck.format || 'Commander'}
                                        </span>
                                        {deck.is_mockup && (
                                            <span className="bg-red-600/20 text-red-400 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-500/30">
                                                Mockup
                                            </span>
                                        )}
                                        <div className="h-4 w-px bg-white/10 mx-1" />
                                        <span className="text-gray-400 text-xs font-bold font-mono">
                                            ${totalValue.toFixed(2)}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => setIsStrategyModalOpen(true)}
                                        className="flex items-center gap-2 text-indigo-300 hover:text-white transition-all text-xs font-black uppercase tracking-widest bg-indigo-500/20 hover:bg-indigo-500/30 px-5 py-2 rounded-2xl border border-indigo-500/30 shadow-xl shadow-indigo-500/10 active:scale-95"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        View Strategy
                                    </button>

                                    <div className="text-[13px] text-white/30 italic font-medium tracking-tight border-l border-white/5 pl-4 ml-2" title={identityInfo.flavor_text}>
                                        "{identityInfo.flavor_text}"
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Global Actions */}
                        <div className="flex items-center gap-2 bg-gray-950/50 p-1.5 rounded-2xl border border-gray-800 backdrop-blur shadow-inner">
                            <button
                                onClick={() => setIsAddCollectionOpen(true)}
                                className="bg-green-600 hover:bg-green-500 text-white font-black py-2.5 px-6 rounded-xl shadow-lg shadow-green-900/40 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                Collection
                            </button>
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700 transition-all shadow-md"
                                title="Quick Search"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </button>
                            <div className="w-px h-6 bg-gray-800 mx-1" />
                            <button
                                onClick={handleExportDeck}
                                className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700 transition-all shadow-md"
                                title="Export JSON"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            </button>
                            <div className="relative group">
                                <button className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700 transition-all shadow-md">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                </button>
                                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 rounded-xl shadow-2xl border border-gray-800 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50 overflow-hidden">
                                    <button
                                        onClick={handleToggleMockup}
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-gray-800 flex items-center gap-2 transition-colors border-b border-gray-800 text-gray-300"
                                    >
                                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        {deck.is_mockup ? 'Switch to Collection' : 'Switch to Mockup'}
                                    </button>
                                    <button
                                        onClick={handleDeleteDeck}
                                        className="w-full text-left px-4 py-3 text-sm hover:bg-red-900/30 text-red-400 flex items-center gap-2 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Delete Deck
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Summary / Quick View */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
                    {kpiData.map((kpi, idx) => {
                        const progress = kpi.target > 0 ? Math.min((kpi.current / kpi.target) * 100, 100) : 0;
                        const isPerfect = kpi.target > 0 && kpi.current === kpi.target;
                        const isOver = kpi.target > 0 && kpi.current > kpi.target;

                        return (
                            <div key={idx} className="bg-gray-950/30 p-3 rounded-xl border border-white/5 backdrop-blur-md shadow-lg group hover:border-indigo-500/30 transition-all hover:bg-gray-950/50">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{kpi.label}</span>
                                    <span className={`text-xs font-mono font-bold ${isPerfect ? 'text-green-400' : isOver ? 'text-orange-400' : 'text-indigo-300'}`}>
                                        {kpi.current}<span className="text-gray-600 mx-0.5">/</span>{kpi.target || '?'}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-700/30">
                                    <div
                                        className={`h-full transition-all duration-700 ${isPerfect ? 'bg-green-500' : isOver ? 'bg-orange-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${progress || 0}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Quick Stats Summary (Pips & Production) */}
                <div className="bg-gray-950/20 p-4 rounded-2xl border border-white/5 backdrop-blur-md mb-6 flex flex-wrap gap-8 items-center justify-between shadow-lg">
                    <div className="flex gap-8 items-center">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Mana Symbols (Pips)</span>
                            <div className="flex gap-2">
                                {['W', 'U', 'B', 'R', 'G'].map(color => {
                                    const colorMap = { W: 'bg-yellow-100', U: 'bg-blue-500', B: 'bg-gray-700', R: 'bg-red-500', G: 'bg-green-600' };
                                    // We need a simple way to get pip counts without full calculation here if possible, 
                                    // but for "Quick View" let's just show the color identity if no easy stats
                                    return deck.commander?.color_identity?.includes(color) ? (
                                        <div key={color} className={`w-3 h-3 rounded-full ${colorMap[color]} shadow-sm border border-black/20`} />
                                    ) : null;
                                })}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsStatsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 rounded-xl border border-indigo-500/30 transition-all text-xs font-bold uppercase tracking-widest group"
                    >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        Comprehensive Analysis
                    </button>
                </div>

                {/* Main Content: Split Layout */}
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Left: Decklist (Takes remaining space) */}
                    <div className="flex-1 min-w-0 bg-gray-950/40 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/10 order-2 lg:order-1 flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5 rounded-t-xl backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-white flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    Decklist
                                </div>
                                {totalCards > 0 && (
                                    <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-1 rounded-full border border-gray-700">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Acquired</span>
                                        <span className={`text-sm font-mono font-bold ${ownedCardsCount === totalCards ? 'text-green-400' : 'text-orange-400'}`}>
                                            {ownedCardsCount}/{totalCards}
                                        </span>
                                        <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden ml-1">
                                            <div
                                                className="h-full bg-green-500 transition-all duration-500"
                                                style={{ width: `${(ownedCardsCount / totalCards) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </h3>
                            <div className="flex bg-gray-900/50 rounded-lg p-1 gap-1 border border-gray-700">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'text-white bg-gray-700 shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                    title="Grid View"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'text-white bg-gray-700 shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                    title="Table View"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-8 min-h-[500px]">
                            {Object.entries(groupedCards).length === 0 && (
                                <div className="text-center py-20 text-gray-500 italic">
                                    Use the "Add Cards" button to start building your deck.
                                </div>
                            )}
                            {Object.entries(groupedCards).map(([type, cards]) => {
                                return (
                                    <div key={type} className="animate-fade-in text-left">
                                        <h4 className="text-sm font-bold text-indigo-300 border-b border-white/5 mb-4 pb-2 sticky top-0 bg-gray-950/60 backdrop-blur-md z-10 flex justify-between uppercase tracking-wider pl-1">
                                            <span>{type}</span>
                                            <span className="text-gray-500 text-xs bg-gray-900 px-2 py-0.5 rounded-full border border-gray-700">
                                                {cards.reduce((a, c) => a + (c.countInDeck || 1), 0)}
                                            </span>
                                        </h4>
                                        {viewMode === 'grid' ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 px-1">
                                                {cards.map(card => (
                                                    <CardGridItem
                                                        key={card.firestoreId || card.id}
                                                        card={card}
                                                        availableFoils={availableFoils}
                                                        onRemove={handleRemoveFromDeck}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {cards.map((card, idx) => (
                                                    <div key={card.id + idx} className="flex items-center justify-between p-2 hover:bg-gray-700/50 rounded-lg transition-colors text-sm group border border-transparent hover:border-gray-700">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono text-gray-500 w-6 text-center bg-gray-900 rounded py-0.5 text-xs">{card.countInDeck}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-medium ${card.finish === 'foil' ? 'text-yellow-200' : 'text-gray-200'}`}>{card.name}</span>
                                                                {card.finish !== 'foil' && availableFoils.has(card.name) && (
                                                                    <span className="text-yellow-500 text-xs cursor-help" title="Foil copy available in collection">☆</span>
                                                                )}
                                                            </div>
                                                            {card.finish === 'foil' && <span className="text-[10px] bg-yellow-900/40 text-yellow-500 px-1 rounded uppercase tracking-wider border border-yellow-800">Foil</span>}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-gray-400">
                                                            <span className="hidden md:inline-block text-xs text-gray-500">{card.data?.type_line || card.type_line || ''}</span>
                                                            <span className="font-mono w-16 text-right text-xs">{card.mana_cost || ''}</span>
                                                            <span className="font-mono w-16 text-right text-green-400/80 text-xs">${(parseFloat(card.prices?.[card.finish === 'foil' ? 'usd_foil' : 'usd']) || 0).toFixed(2)}</span>
                                                            <button
                                                                onClick={() => handleRemoveFromDeck(card.firestoreId || card.id, card.name)}
                                                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Sidebar (Fixed Width) */}
                    <div className="w-full lg:w-80 space-y-6 shrink-0 order-1 lg:order-2">

                        {/* Commander Mini View */}
                        {deck.commander && (
                            <div className="bg-gray-950/40 backdrop-blur-3xl rounded-3xl shadow-2xl overflow-hidden border border-white/10">
                                <div className="p-4 bg-white/5 border-b border-white/5">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Commander</h3>
                                </div>
                                <div className="p-4 flex flex-col items-center">
                                    <img src={getCardImage(deck.commander)} className="w-full rounded-lg shadow-md hover:shadow-indigo-500/30 transition-shadow duration-300" alt={deck.commander.name} />
                                </div>
                            </div>
                        )}

                        {/* AI Tools Actions */}
                        <div className="bg-gray-950/40 backdrop-blur-3xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
                            <div className="p-4 bg-white/5 border-b border-white/5">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Tools</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <button
                                    onClick={() => navigate(`/decks/${deckId}/build`)}
                                    className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-600/30 hover:border-indigo-500 font-bold py-2.5 px-4 rounded-lg transition-all text-sm flex items-center justify-center gap-2 mb-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    AI Deck Builder
                                </button>

                                <button
                                    onClick={() => setIsStatsModalOpen(true)}
                                    className="w-full bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 border border-blue-600/30 hover:border-blue-500 font-bold py-2.5 px-4 rounded-lg transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    Full Deck Stats
                                </button>

                                {/* DeckAI Component Integration */}
                                {/* Kept for inline access if desired, but button above now opens modal */}
                                {/* <DeckAI deck={deck} cards={deckCards} /> */}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Search Modal */}
                <CardSearchModal
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                    onAddCard={handleAddToDeck}
                />

                {/* Confirmation Modal */}
                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    isDanger={true}
                    confirmText="Remove"
                />


                {/* Strategy Blueprint Modal */}
                <DeckStrategyModal
                    isOpen={isStrategyModalOpen}
                    onClose={() => setIsStrategyModalOpen(false)}
                    deck={deck}
                    cards={deckCards}
                />
                {/* Add From Collection Modal */}
                <AddFromCollectionModal
                    isOpen={isAddCollectionOpen}
                    onClose={() => setIsAddCollectionOpen(false)}
                    deck={deck}
                    deckCards={deckCards}
                />
                {/* Stats Modal */}
                <DeckStatsModal
                    isOpen={isStatsModalOpen}
                    onClose={() => setIsStatsModalOpen(false)}
                    cards={deckCards}
                    deckName={deck.name}
                />
            </div>
        </div>
    );
};

export default DeckDetailsPage;
