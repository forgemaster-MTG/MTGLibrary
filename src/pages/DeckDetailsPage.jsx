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
import DeckAI from '../components/DeckAI';
import CardGridItem from '../components/common/CardGridItem';

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

    // Strategy Modal State
    const [isStrategyOpen, setIsStrategyOpen] = useState(false);

    const [showStats, setShowStats] = useState(true);
    // Initialize from settings or default to 'grid'
    const [viewMode, setViewModeState] = useState(userProfile?.settings?.deckViewMode || 'grid');

    const setViewMode = (mode) => {
        setViewModeState(mode);
        updateSettings({ deckViewMode: mode });
    };

    const { deck, cards: deckCards, loading: deckLoading, error: deckError } = useDeck(deckId);
    const { cards: collection } = useCollection();

    // Calculate Available Foils
    const availableFoils = useMemo(() => {
        if (!collection) return new Set();
        const foils = new Set();
        collection.forEach(c => {
            // Check if card is foil and NOT assigned to any deck (deckId is null/undefined)
            // Note: useCollection maps DB deck_id to c.deckId
            if (c.finish === 'foil' && !c.deckId) {
                foils.add(c.name);
            }
        });
        return foils;
    }, [collection]);

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

    // Group cards (Legacy Logic + Refined)
    const groupedCards = useMemo(() => {
        if (!deckCards) return {};
        const groups = {
            Commander: [],
            Creature: [],
            Planeswalker: [],
            Instant: [],
            Sorcery: [],
            Artifact: [],
            Enchantment: [],
            Land: [],
            Other: []
        };

        const commanderId = deck?.commander?.id;

        deckCards.forEach(c => {
            // Normalized card object
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

        // Filter out empty groups
        return Object.fromEntries(Object.entries(groups).filter(([_, list]) => list.length > 0));
    }, [deckCards, deck]);


    // KPI Calculations
    const totalCards = deckCards ? deckCards.reduce((acc, c) => acc + (c.countInDeck || 1), 0) : 0;

    const countByType = (type) => {
        if (!deckCards) return 0;
        return deckCards.reduce((acc, c) => (((c.data?.type_line || c.type_line) || '').includes(type) ? acc + (c.countInDeck || 1) : acc), 0);
    };

    const kpiData = [
        { label: 'Total', current: totalCards, target: deck?.aiBlueprint?.suggestedCounts?.Total },
        { label: 'Creature', current: countByType('Creature'), target: deck?.aiBlueprint?.suggestedCounts?.Creature },
        { label: 'Land', current: countByType('Land'), target: deck?.aiBlueprint?.suggestedCounts?.Land },
        { label: 'Instant', current: countByType('Instant'), target: deck?.aiBlueprint?.suggestedCounts?.Instant },
        { label: 'Sorcery', current: countByType('Sorcery'), target: deck?.aiBlueprint?.suggestedCounts?.Sorcery },
        { label: 'Enchantment', current: countByType('Enchantment'), target: deck?.aiBlueprint?.suggestedCounts?.Enchantment },
        { label: 'Artifact', current: countByType('Artifact'), target: deck?.aiBlueprint?.suggestedCounts?.Artifact },
        { label: 'Planeswalker', current: countByType('Planeswalker'), target: deck?.aiBlueprint?.suggestedCounts?.Planeswalker },
    ];

    const totalValue = deckCards ? deckCards.reduce((acc, c) => {
        const price = c.finish === 'foil' ? c.prices?.usd_foil : c.prices?.usd;
        return acc + (parseFloat(price) || 0) * (c.countInDeck || 1);
    }, 0) : 0;

    // Loading/Error States
    if (deckLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500"></div></div>;
    if (deckError) return <div className="p-20 text-center text-red-500 text-xl font-bold">Error loading deck: {deckError.message}</div>;
    if (!deck) return null;

    // Derived Images
    const commanderImage = getArtCrop(deck.commander);
    const colorIdentityMap = { W: 'https://svgs.scryfall.io/card-symbols/W.svg', U: 'https://svgs.scryfall.io/card-symbols/U.svg', B: 'https://svgs.scryfall.io/card-symbols/B.svg', R: 'https://svgs.scryfall.io/card-symbols/R.svg', G: 'https://svgs.scryfall.io/card-symbols/G.svg' };

    return (
        <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 animate-fade-in pb-24">

            {/* Back Button */}
            <div>
                <button
                    onClick={() => navigate('/decks')}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Decks
                </button>
            </div>

            {/* Banner Header */}
            <div className="relative w-full h-64 bg-gray-900 rounded-xl overflow-hidden shadow-2xl group border border-gray-800">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url('${commanderImage}')`, opacity: 0.6 }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>

                <div className="absolute bottom-0 left-0 p-6 w-full flex flex-col md:flex-row justify-between items-end gap-4 z-10">
                    <div>
                        {isEditingName ? (
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="bg-black/50 text-3xl font-bold text-white border-b-2 border-indigo-500 outline-none px-2 py-1 w-full max-w-md backdrop-blur-sm rounded"
                                    autoFocus
                                />
                                <button onClick={handleSaveName} className="bg-green-600/80 p-1 rounded hover:bg-green-500 text-white">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button onClick={() => setIsEditingName(false)} className="bg-red-600/80 p-1 rounded hover:bg-red-500 text-white">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 group mb-2">
                                <h2 className="text-4xl font-bold text-white drop-shadow-md tracking-tight">{deck.name}</h2>
                                <button onClick={handleStartEdit} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-white bg-black/30 p-1 rounded backdrop-blur-sm">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                            </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-gray-300">
                            <span className="bg-indigo-600/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border border-indigo-500/50">
                                {deck.format || 'Commander'}
                            </span>
                            {deck.commander?.color_identity?.length > 0 && (
                                <div className="flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm px-2 py-1 rounded-full border border-gray-700">
                                    {deck.commander.color_identity.map(c => (
                                        <img key={c} src={colorIdentityMap[c]} className="w-4 h-4" alt={c} />
                                    ))}
                                </div>
                            )}
                            <span className="inline-flex items-center bg-gray-800/80 text-gray-100 text-sm font-semibold px-3 py-1 rounded-full border border-gray-700">
                                Value: ${totalValue.toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-gray-900/50 rounded-lg p-1 border border-gray-700 shadow-lg">
                            <button
                                onClick={() => setIsAddCollectionOpen(true)}
                                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-md shadow-md transition-all flex items-center gap-2"
                                title="Add cards from your collection"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                Add from Collection
                            </button>
                            <div className="w-px bg-gray-700 mx-1"></div>
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="text-gray-400 hover:text-white px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
                                title="Search Scryfall Database (Proxies/Wishlist)"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </button>
                        </div>

                        <button
                            onClick={handleExportDeck}
                            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg shadow-md transition-colors border border-gray-600"
                            title="Export Deck to JSON"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                        {/* More menu can be added here */}
                        <div className="relative group/menu">
                            <button className="bg-gray-700/80 hover:bg-gray-600 text-white p-2 rounded-lg backdrop-blur-sm transition-colors border border-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Toggle */}
            <div className="flex justify-end mb-2">
                <button
                    onClick={() => setShowStats(!showStats)}
                    className="text-xs font-medium text-gray-400 hover:text-white flex items-center gap-1 transition-colors uppercase tracking-wide"
                >
                    {showStats ? 'Hide Stats' : 'Show Stats'}
                    <svg className={`w-3 h-3 transform transition-transform ${showStats ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                </button>
            </div>

            {/* Stats KPIs */}
            {showStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 animate-fade-in-down">
                    {kpiData.map((kpi) => {
                        const hasTarget = kpi.target != null;
                        const percentage = hasTarget ? Math.min((kpi.current / kpi.target) * 100, 100) : 0;
                        let barColor = "bg-gray-500";
                        if (hasTarget) {
                            if (percentage < 50) barColor = "bg-red-500";
                            else if (percentage < 90) barColor = "bg-yellow-500";
                            else barColor = "bg-green-500";
                        }
                        return (
                            <div key={kpi.label} className="bg-gray-800/80 p-3 rounded-lg relative overflow-hidden group border border-gray-700 hover:border-gray-600 transition-all select-none cursor-help" title={`Target: ${kpi.target || 'N/A'}`}>
                                <div className="flex justify-between items-baseline z-10 relative">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{kpi.label}</span>
                                    <span className="font-mono font-bold text-lg text-white">{kpi.current}{hasTarget && <span className="text-gray-500 text-xs font-normal">/{kpi.target}</span>}</span>
                                </div>
                                {hasTarget && (
                                    <div className={`absolute bottom-0 left-0 h-1 ${barColor} transition-all duration-500 opacity-80`} style={{ width: `${percentage}%` }}></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Main Content: Split Layout */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* Left: Decklist (Takes remaining space) */}
                <div className="flex-1 min-w-0 bg-gray-800 rounded-xl shadow-xl border border-gray-700 order-2 lg:order-1 flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-gray-800/50 rounded-t-xl backdrop-blur-sm">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            Decklist
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
                                    <h4 className="text-sm font-bold text-indigo-300 border-b border-gray-700 mb-4 pb-2 sticky top-0 bg-gray-800 z-10 flex justify-between uppercase tracking-wider pl-1">
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
                        <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
                            <div className="p-3 bg-gray-900/50 border-b border-gray-700">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Commander</h3>
                            </div>
                            <div className="p-4 flex flex-col items-center">
                                <img src={getCardImage(deck.commander)} className="w-full rounded-lg shadow-md hover:shadow-indigo-500/30 transition-shadow duration-300" alt={deck.commander.name} />
                            </div>
                        </div>
                    )}

                    {/* Charts */}
                    <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
                        <div className="p-3 bg-gray-900/50 border-b border-gray-700">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Statistics</h3>
                        </div>
                        <div className="p-4 bg-gray-800">
                            {/* Chart component needs to be responsive but container constrained */}
                            {/* Use style with !important if needed, but explicit minHeight usually fixes Recharts -1 error */}
                            <div className="w-full" style={{ height: '256px', minHeight: '256px' }}>
                                <DeckCharts cards={deckCards} type="mana" />
                            </div>
                        </div>
                    </div>

                    {/* AI Tools Actions */}
                    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
                        <div className="p-3 bg-gray-900/50 border-b border-gray-700">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Tools</h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <button
                                onClick={() => setIsStrategyOpen(true)}
                                className="w-full bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border border-purple-600/30 hover:border-purple-500 font-bold py-2.5 px-4 rounded-lg transition-all text-sm flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M3.343 15.657l-.707.707m16.514 0l-.707-.707M6 12a6 6 0 1112 0 6 6 0 01-12 0z" /></svg>
                                View Strategy
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

            {/* Strategy Modal */}
            <DeckSuggestionsModal
                isOpen={isStrategyOpen}
                onClose={() => setIsStrategyOpen(false)}
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
        </div>
    );
};

export default DeckDetailsPage;
