import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { GeminiService } from '../services/gemini';
import { MTG_IDENTITY_REGISTRY, getIdentity } from '../utils/identityRegistry';
import { getTierConfig } from '../config/tiers';
import { SUPPORTED_FORMATS, isCommanderFormat } from '../utils/formatUtils';
import { getFormatDetails } from '../utils/formatDescriptions';

import CommanderSearchModal from '../components/modals/CommanderSearchModal';
import ImportDeckModal from '../components/modals/ImportDeckModal';
import { DeckImportService } from '../services/DeckImportService';

const STEPS = {
    BASICS: 1,
    COMMANDER: 2,
    PARTNER: 2.5,
    AI_STRATEGY: 3,
    REVIEW: 4
};

const CreateDeckPage = () => {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { addToast } = useToast();
    const queryClient = useQueryClient();

    // Wizard State
    const [step, setStep] = useState(STEPS.BASICS);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('folder'); // 'list' | 'folder'
    const [expandedGroups, setExpandedGroups] = useState({}); // { [groupName]: boolean }
    const [activeFolder, setActiveFolder] = useState(null); // 'Dimir' etc.

    // Data State
    const [name, setName] = useState('');
    const [format, setFormat] = useState('Commander');
    const [availableCommanders, setAvailableCommanders] = useState([]);
    const [selectedCommander, setSelectedCommander] = useState(null);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [commanderSearch, setCommanderSearch] = useState('');
    const [partnerSearch, setPartnerSearch] = useState('');

    // AI State
    const [strategyData, setStrategyData] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState('Consulting the Oracle...');
    const [isMockup, setIsMockup] = useState(null); // null = unselected, false = collection, true = mockup
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Precons
    const [preconTypes, setPreconTypes] = useState([]);

    const [preconTypesLoading, setPreconTypesLoading] = useState(true);

    // Import Flow
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchPreconTypes();
    }, []);

    const fetchPreconTypes = async () => {
        try {
            const types = await api.get('/api/precons/types');
            setPreconTypes(types);
        } catch (err) {
            console.error('Failed to fetch precon types', err);
        } finally {
            setPreconTypesLoading(false);
        }
    };

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [step]);

    // Helpers
    const getArtCrop = (card) => {
        if (!card) return null;
        const data = card.data || card;
        if (data.image_uris?.art_crop) return data.image_uris.art_crop;
        if (data.card_faces?.[0]?.image_uris?.art_crop) return data.card_faces[0].image_uris.art_crop;
        if (data.image_uris?.normal) return data.image_uris.normal;
        return null;
    };

    const getManaPips = (card) => {
        const data = card.data || card;
        const identity = data.color_identity || [];
        return identity.length > 0 ? identity : ['C'];
    };

    // --- Actions ---

    const handleBasicsSubmit = (selectedFormat, isMockupActive) => {
        if (isCommanderFormat(selectedFormat)) {
            fetchCommanders(selectedFormat, isMockupActive);
        } else {
            setStep(STEPS.REVIEW);
        }
    };

    const fetchCommanders = async (selectedFormat, isMockupActive) => {
        setLoading(true);
        try {
            const params = {
                unused: true
            };

            if (isCommanderFormat(selectedFormat)) {
                params.is_commander = true;
            }
            // For Standard, we don't restrict by type (or restrict to legal Standard cards if backend supported it)
            // For now, we fetch generic unused cards for Standard Showcase selection

            // For Collection Decks, strictly hide wishlist items
            // Legacy behavior: 'true' is string
            if (!isMockupActive) {
                params.wishlist = 'false';
            }

            const cards = await api.get('/api/collection', params);
            setAvailableCommanders(cards);
            setStep(STEPS.COMMANDER);
        } catch (err) {
            console.error(err);
            addToast('Failed to load cards', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCommanderSelect = (card) => {
        setSelectedCommander(card);

        if (!isCommanderFormat(format)) {
            // Skip Partner, move to AI/Review
            // Just go to Review directly as AI is disabled for non-commander formats for now
            addToast(`${format} AI Deckbuilding coming soon!`, "info");
            setStep(STEPS.REVIEW);
            return;
        }

        const data = card.data || card;
        const keywords = data.keywords || [];
        const oracleText = data.oracle_text || '';
        const hasPartner = keywords.includes('Partner') || oracleText.includes('Partner');

        if (hasPartner) {
            setStep(STEPS.PARTNER);
        } else {
            const allowed = (userProfile?.tierConfig || getTierConfig(userProfile?.subscription_tier)).features.aiStrategy;
            if (allowed) {
                setStep(STEPS.AI_STRATEGY);
            } else {
                setStep(STEPS.REVIEW);
            }
        }
    };

    const handlePartnerSelect = (card) => {
        setSelectedPartner(card);
        const allowed = (userProfile?.tierConfig || getTierConfig(userProfile?.subscription_tier)).features.aiStrategy;
        if (allowed) {
            setStep(STEPS.AI_STRATEGY);
        } else {
            setStep(STEPS.REVIEW);
        }
    };

    const generateStrategy = async () => {
        if (format === 'Standard') return; // Should be handled earlier but safeguard

        const apiKey = userProfile?.settings?.geminiApiKey;
        const helperName = userProfile?.settings?.helper?.name || 'The Oracle';

        setLoading(true);
        setLoadingMessage(`${helperName} is analyzing ${selectedPartner ? 'your commanders' : 'your commander'}...`);

        try {
            // --- ROBUST DATA PREPARATION (Matches DeckStrategyModal & Wizard) ---
            const rawCommanders = [selectedCommander, selectedPartner].filter(Boolean);
            const sanitizedCommanders = rawCommanders.map(c => ({
                name: c.name || c.data?.name || 'Unknown',
                mana_cost: c.mana_cost || c.cmc || c.data?.mana_cost || c.data?.cmc || '0',
                type_line: c.type_line || c.data?.type_line || 'Legendary Creature',
                oracle_text: c.oracle_text || c.data?.oracle_text || ''
            }));

            // 2. Playstyle Fallback
            let activePlaystyle = userProfile.playstyle || userProfile.settings?.playstyle || userProfile.data?.playstyle || null;

            // Deep check for "data" if it's a JSON string or nested
            if (!activePlaystyle && userProfile.data && userProfile.data.playstyle) {
                activePlaystyle = userProfile.data.playstyle;
            }
            if (!activePlaystyle) {
                console.warn("⚠️ Playstyle undefined in CreateDeck. Using generic fallback.");
                activePlaystyle = {
                    summary: "Balanced Magic player enjoying strategic depth and interaction.",
                    archetypes: ["Midrange", "Control"],
                    scores: { aggression: 5 }
                };
            }

            const data = await GeminiService.getDeckStrategy(
                apiKey,
                sanitizedCommanders, // Pass ARRAY of objects now
                activePlaystyle,
                [],
                userProfile?.settings?.helper,
                userProfile
            );

            if (!data.layout) {
                data.layout = {
                    functional: { Lands: 36, "Mana Ramp": 10, "Card Draw": 10, "Removal": 10, "Board Wipes": 3, "Synergy": 30 },
                    types: { Creatures: 30, Instants: 10, Sorceries: 10, Artifacts: 10, Enchantments: 4, Planeswalkers: 0, Lands: 36 }
                };
            }

            setStrategyData(data);
            if (!name.trim() && data.suggestedName) setName(data.suggestedName);
            setStep(STEPS.REVIEW);
        } catch (err) {
            console.error(err);
            addToast('AI Generation Failed. Proceeding manually.', 'error');
            setStrategyData({
                theme: '',
                strategy: 'Manual strategy required.',
                layout: { functional: { Lands: 36, Creatures: 63 }, types: { Lands: 36, Creatures: 63 } }
            });
            setStep(STEPS.REVIEW);
        } finally {
            setLoading(false);
        }
    };

    const createDeck = async () => {
        setLoading(true);
        try {
            const payload = {
                name: name || (selectedPartner ? `${selectedCommander.name} & ${selectedPartner.name}` : selectedCommander?.name) || `New ${format} Deck`,
                format,
                commander: selectedCommander?.data || selectedCommander || null,
                commanderPartner: selectedPartner?.data || selectedPartner || null,
                aiBlueprint: strategyData ? {
                    theme: strategyData.theme,
                    strategy: strategyData.strategy,
                    suggestedCounts: strategyData.layout?.functional || strategyData.layout,
                    typeCounts: strategyData.layout?.types
                } : null,
                isMockup // Pass deck type flag
            };

            const newDeck = await api.post('/api/decks', payload);
            await queryClient.invalidateQueries({ queryKey: ['decks'] });
            addToast('Deck created successfully!', 'success');
            navigate(`/decks/${newDeck.id}`);

        } catch (err) {
            console.error(err);
            addToast('Failed to create deck', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImportDeck = async (parsedData, importOptions = {}) => {
        setImporting(true);
        setIsImportModalOpen(false);
        const toastId = addToast('Saving deck...', 'info', 10000);

        try {
            // 1. Identify Commanders and Cards
            // parsedData.mainboard and sideboard are ALREADY resolved in the modal.
            const allCards = [
                ...parsedData.mainboard.map(c => ({ ...c, board: 'main' })),
                ...parsedData.sideboard.map(c => ({ ...c, board: 'side' }))
            ];

            const commanders = allCards.filter(c => c.isCommander);
            const cardsToImport = allCards.filter(c => !c.isCommander);

            const commander = commanders[0] || null;
            const partner = commanders[1] || null;

            // 2. Prepare Payload
            const payload = {
                deck: {
                    name: parsedData.name || "Imported Deck",
                    format: 'Commander',
                    commander: commander ? (commander.data || commander) : null,
                    commanderPartner: partner ? (partner.data || partner) : null,
                    is_wishlist: importOptions.isWishlist // Pass deck-level flag if backend supports it
                },
                cards: cardsToImport.map(c => ({
                    scryfall_id: c.scryfall_id,
                    name: c.name,
                    set_code: c.set_code,
                    collector_number: c.collector_number,
                    finish: c.isFoil ? 'foil' : 'nonfoil',
                    count: c.quantity || 1,
                    data: c.data,
                })),
                options: {
                    checkCollection: !importOptions.isWishlist, // Ensure we check collection ONLY if not a wishlist
                    addToCollection: true, // Always add to collection (backend will tag as wishlist if needed)
                    isWishlist: importOptions.isWishlist // Explicit flag for card creation
                }
            };

            // 3. Send to Backend
            const res = await api.post('/api/decks/import', payload);
            await queryClient.invalidateQueries({ queryKey: ['decks'] });

            addToast(`Deck imported! ${res.missingCards?.length ? `(${res.missingCards.length} missing)` : ''}`, 'success');
            navigate(`/decks/${res.deckId}`);

        } catch (err) {
            console.error(err);
            addToast('Import Failed', 'error');
        } finally {
            setImporting(false);
        }
    };

    // --- Side Effects ---
    useEffect(() => {
        if (step === STEPS.AI_STRATEGY && selectedCommander && !strategyData) {
            generateStrategy();
        }
    }, [step]);

    // --- Render Components ---

    const PosterCard = ({ card, onClick, isSelected }) => {
        const image = getArtCrop(card);
        const pips = getManaPips(card);
        const data = card.data || card;

        return (
            <div
                onClick={() => onClick(card)}
                className={`group relative h-[480px] rounded-3xl cursor-pointer transition-all duration-300 hover:-translate-y-2 ${isSelected ? 'ring-4 ring-primary-500 scale-105' : ''}`}
            >
                {/* Glass Container */}
                <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl group-hover:border-primary-500/50 group-hover:shadow-primary-500/20 transition-all overflow-hidden flex flex-col">

                    {/* Image Area */}
                    <div className="h-[55%] w-full relative overflow-hidden bg-gray-950">
                        {image ? (
                            <img
                                src={image}
                                alt={card.name}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                <span className="text-gray-700 font-bold">No Art</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90" />
                    </div>

                    {/* Content Area */}
                    <div className="h-[45%] p-5 flex flex-col relative">
                        {/* Mana Pips */}
                        <div className="absolute -top-3 left-5 flex gap-2 z-10">
                            {/* Mana Pips */}
                            <div className="flex gap-1 bg-gray-900/90 backdrop-blur-md rounded-full px-2 py-1 border border-white/10 shadow-xl">
                                {pips.map((c, i) => (
                                    <img key={i} src={`https://svgs.scryfall.io/card-symbols/${c}.svg`} alt={c} className="w-4 h-4 shadow-sm" />
                                ))}
                            </div>

                            {/* Foil Star */}
                            {card.finish === 'foil' && (
                                <div className="flex items-center justify-center w-8 h-8 -mt-1 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse" title="Foil">
                                    <svg className="w-5 h-5 text-white drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex-1 flex flex-col gap-2">
                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 mb-1 group-hover:text-primary-300 transition-colors">
                                    {card.name}
                                </h3>
                                <p className="text-xs text-gray-400 font-medium line-clamp-1 border-b border-white/5 pb-2 mb-2">
                                    {data.type_line}
                                </p>
                            </div>

                            {/* Oracle Text */}
                            <p className="text-[10px] text-gray-300 leading-relaxed font-serif opacity-80 line-clamp-4">
                                {data.oracle_text}
                            </p>
                        </div>

                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                            {/* Power / Toughness */}
                            {(data.power && data.toughness) && (
                                <div className="bg-gray-800/80 px-2 py-1 rounded text-xs font-bold text-white border border-white/10 shadow-inner">
                                    {data.power} / {data.toughness}
                                </div>
                            )}
                            <span className="text-[10px] uppercase font-bold tracking-widest text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Grouping Logic
    const groupedCommanders = useMemo(() => {
        if (!availableCommanders.length) return {};

        const groups = {};
        const filtered = availableCommanders.filter(c =>
            c.name.toLowerCase().includes(commanderSearch.toLowerCase()) ||
            (c.data?.type_line || '').toLowerCase().includes(commanderSearch.toLowerCase())
        );

        filtered.forEach(card => {
            const pips = getManaPips(card);
            const identity = getIdentity(pips);
            if (!groups[identity.badge]) {
                groups[identity.badge] = {
                    identity,
                    cards: []
                };
            }
            groups[identity.badge].cards.push(card);
        });

        return groups;
    }, [availableCommanders, commanderSearch]);

    const renderCommanderSelection = () => {
        const hasSearch = commanderSearch.trim().length > 0;
        const sortedGroups = Object.entries(groupedCommanders).sort((a, b) => {
            // Sort by Color Count (Ascending)
            const countDiff = a[1].identity.colors.length - b[1].identity.colors.length;
            if (countDiff !== 0) return countDiff;
            // Secondary: Card Count (Descending) for relevance
            return b[1].cards.length - a[1].cards.length;
        });

        const renderGroupHeader = (group, isExpanded, toggle) => (
            <div
                onClick={toggle}
                className="w-full bg-gray-900/60 hover:bg-gray-800/60 backdrop-blur-md border border-white/5 rounded-2xl p-6 cursor-pointer transition-all flex items-center justify-between group mb-4"
            >
                <div className="flex items-center gap-4">
                    <div className="flex gap-1 bg-gray-950/50 rounded-full px-3 py-1.5 border border-white/5">
                        {group.identity.colors.map(c => (
                            <img key={c} src={`https://svgs.scryfall.io/card-symbols/${c}.svg`} alt={c} className="w-5 h-5 shadow-sm" />
                        ))}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-primary-300 transition-colors">{group.identity.badge}</h3>
                        <p className="text-sm text-gray-400 italic line-clamp-1">"{group.identity.flavor}"</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-gray-500">{group.cards.length} {format === 'Commander' ? 'Legends' : 'Cards'}</span>
                    <svg className={`w-6 h-6 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        );

        return (
            <div className="animate-fade-in space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-end mb-4 gap-4 shrink-0">
                    <div>
                        <h2 className="text-3xl font-black text-white mb-2">{format === 'Commander' ? 'Choose Commander' : 'Choose Spotlight Card'}</h2>
                        <p className="text-gray-400">{format === 'Commander' ? 'Select the legend who will lead your deck.' : 'Select a card to feature as the face of your deck.'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Search Database Button (Visible for Mockup or if no cards found?) */}
                        {/* Always visible as an option to expand collection */}
                        <button
                            onClick={() => setIsSearchOpen(true)}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all hover:-translate-y-0.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            Search Database
                        </button>

                        {/* View Toggles */}
                        <div className="bg-gray-800/50 rounded-xl p-1 flex border border-white/10">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                title="List View"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                            </button>
                            <button
                                onClick={() => setViewMode('folder')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'folder' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                title="Folder View"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={format === 'Commander' ? "Search legends..." : "Search cards..."}
                                value={commanderSearch}
                                onChange={(e) => setCommanderSearch(e.target.value)}
                                className="bg-gray-800/50 border border-white/10 rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 outline-none w-64 backdrop-blur-md"
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {commanderSearch && (
                                <button
                                    onClick={() => setCommanderSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">

                    {/* FOLDER VIEW */}
                    {viewMode === 'folder' && !activeFolder && (
                        <>
                            {sortedGroups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                                    <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6 border border-gray-700">
                                        <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">No Cards Found</h3>
                                    <p className="text-gray-400 max-w-md mb-8">
                                        {commanderSearch
                                            ? "No cards match your search filters."
                                            : "We couldn't find any qualifying cards in your collection."}
                                    </p>
                                    <button
                                        onClick={() => setIsSearchOpen(true)}
                                        className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary-500/20 hover:-translate-y-1 transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        Search Full Database
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {sortedGroups.map(([key, group]) => (
                                        <div
                                            key={key}
                                            onClick={() => setActiveFolder(key)}
                                            className="bg-gray-800/40 hover:bg-gray-700/50 border border-white/5 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl group flex flex-col items-center text-center gap-3 backdrop-blur-sm"
                                        >
                                            <div className="flex gap-1 bg-gray-950/50 rounded-full px-3 py-2 border border-white/5">
                                                {group.identity.colors.map(c => (
                                                    <img key={c} src={`https://svgs.scryfall.io/card-symbols/${c}.svg`} alt={c} className="w-6 h-6" />
                                                ))}
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-white group-hover:text-primary-300 transition-colors uppercase tracking-wide">{group.identity.badge}</h3>
                                                <div className="h-0.5 w-8 bg-primary-500/50 mx-auto my-2" />
                                                <p className="text-sm text-gray-400 italic">"{group.identity.flavor}"</p>
                                            </div>
                                            <span className="text-sm font-mono font-bold text-gray-500 bg-black/20 px-3 py-1 rounded-full mt-2">{group.cards.length} {format === 'Commander' ? 'Legends' : 'Cards'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {viewMode === 'folder' && activeFolder && (
                        <div className="space-y-6">
                            <button
                                onClick={() => setActiveFolder(null)}
                                className="flex items-center gap-2 text-primary-400 hover:text-white transition-colors font-bold uppercase text-xs tracking-widest mb-4"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                Back to Groups
                            </button>

                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-3xl font-black text-white">{groupedCommanders[activeFolder].identity.badge}</h3>
                                <div className="flex gap-1">
                                    {groupedCommanders[activeFolder].identity.colors.map(c => (
                                        <img key={c} src={`https://svgs.scryfall.io/card-symbols/${c}.svg`} alt={c} className="w-6 h-6" />
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {groupedCommanders[activeFolder].cards.map(card => (
                                    <PosterCard key={card.id} card={card} onClick={handleCommanderSelect} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LIST VIEW (Collapsible) */}
                    {viewMode === 'list' && (
                        <div className="space-y-4">
                            {sortedGroups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in border border-dashed border-gray-800 rounded-3xl">
                                    <p className="text-gray-400">No cards found in your collection matching criteria.</p>
                                    <button
                                        onClick={() => setIsSearchOpen(true)}
                                        className="text-primary-400 font-bold hover:text-primary-300 mt-2 hover:underline"
                                    >
                                        Search Scryfall Database
                                    </button>
                                </div>
                            ) : (
                                sortedGroups.map(([key, group]) => {
                                    const isExpanded = expandedGroups[key] || hasSearch; // Auto-expand on search
                                    return (
                                        <div key={key}>
                                            {renderGroupHeader(group, isExpanded, () => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] })))}

                                            {isExpanded && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8 pl-4 border-l-2 border-white/5 animate-fade-in">
                                                    {group.cards.map(card => (
                                                        <PosterCard key={card.id} card={card} onClick={handleCommanderSelect} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderPartnerSelection = () => {
        const filtered = availableCommanders.filter(c => {
            const data = c.data || c;
            const keywords = data.keywords || [];
            const oracleText = data.oracle_text || '';
            const isPartner = keywords.includes('Partner') || oracleText.includes('Partner');

            if (c.id === selectedCommander?.id) return false; // Exclude self
            if (!isPartner) return false;

            return c.name.toLowerCase().includes(partnerSearch.toLowerCase());
        });

        return (
            <div className="animate-fade-in space-y-6">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h2 className="text-3xl font-black text-white mb-2">Choose Partner</h2>
                        <p className="text-gray-400">Select a partner for {selectedCommander?.name}.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search partners..."
                                value={partnerSearch}
                                onChange={(e) => setPartnerSearch(e.target.value)}
                                className="bg-gray-800/50 border border-white/10 rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 outline-none w-64 backdrop-blur-md"
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {partnerSearch && (
                                <button
                                    onClick={() => setPartnerSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => { setSelectedPartner(null); setStep(STEPS.AI_STRATEGY); }}
                            className="text-sm font-bold text-gray-400 hover:text-white underline self-center"
                        >
                            Skip / Solo Commander
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filtered.map(card => (
                        <PosterCard key={card.id} card={card} onClick={handlePartnerSelect} />
                    ))}
                    {filtered.length === 0 && (
                        <div className="col-span-full py-20 text-center text-gray-500">
                            No valid partners found matching your search.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderAIStrategy = () => (
        <div className="flex flex-col items-center justify-center h-[50vh] animate-fade-in text-center">
            <div className="relative mb-8">
                <div className="w-24 h-24 bg-primary-500/20 rounded-full animate-ping absolute inset-0" />
                <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center relative shadow-[0_0_50px_rgba(79,70,229,0.5)]">
                    <svg className="w-10 h-10 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{loadingMessage}</h2>
            <p className="text-gray-400 max-w-md mx-auto">Brewing a perfect strategy tailored to your playstyle.</p>
        </div>
    );

    const renderReview = () => {
        // Prepare editable inputs
        const functional = strategyData?.layout?.functional || {};
        const types = strategyData?.layout?.types || {};

        return (
            <div className="animate-fade-in flex flex-col space-y-8">
                {/* Header with Name Input & Action Button (Sticky) */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 shrink-0 sticky -top-8 z-30 bg-gray-950/90 backdrop-blur-xl pt-4 pb-6 -mx-8 px-8 rounded-t-3xl border-b border-white/5">
                    <div className="space-y-2 flex-1 w-full">
                        <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider">Deck Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full text-4xl font-black bg-transparent border-b-2 border-white/10 focus:border-primary-500 text-white placeholder-gray-600 outline-none pb-2 transition-colors"
                            placeholder="Name your deck..."
                        />
                    </div>
                    <button
                        onClick={createDeck}
                        disabled={loading}
                        className="bg-primary-600 hover:bg-primary-500 text-white text-xl font-bold py-4 px-10 rounded-2xl shadow-lg shadow-primary-500/20 transform hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shrink-0"
                    >
                        {loading ? 'Forging...' : 'Create Deck'}
                        {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                    </button>
                </div>

                <div className="space-y-8 flex-1">

                    {/* Strategy Text */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                            <h3 className="text-xl font-bold text-primary-300 mb-4">Theme & Strategy</h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Theme</span>
                                    <p className="text-lg text-white font-medium">{strategyData?.theme}</p>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gameplan</span>
                                    <div
                                        className="text-sm text-gray-300 leading-relaxed prose prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: strategyData?.strategy }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Composition */}
                        <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md space-y-6">
                            <h3 className="text-xl font-bold text-green-300 mb-4">Composition Preview</h3>

                            {/* Functional Grid */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Functional Needs</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(functional).map(([key, val]) => (
                                        <div key={key} className="flex justify-between items-center bg-gray-900/50 px-3 py-2 rounded-lg border border-white/5">
                                            <span className="text-sm text-gray-300">{key}</span>
                                            <span className="font-mono font-bold text-primary-400">{Math.round(val)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Type Grid */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Type Balance</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(types).map(([key, val]) => (
                                        <div key={key} className="flex justify-between items-center bg-gray-900/50 px-3 py-2 rounded-lg border border-white/5">
                                            <span className="text-sm text-gray-300">{key}</span>
                                            <span className="font-mono font-bold text-emerald-400">{Math.round(val)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- Dynamic Background Logic ---
    const bgImage = selectedCommander ? getArtCrop(selectedCommander) : null;

    return (
        <div className="min-h-screen bg-gray-950 relative flex flex-col pb-20">

            {/* Dynamic Background */}
            {bgImage && (
                <>
                    <div
                        className="fixed inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105"
                        style={{ backgroundImage: `url(${bgImage})` }}
                    />
                    <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-2xl transition-all duration-1000" />
                    <div className="fixed inset-0 bg-gradient-to-t from-gray-950 via-gray-950/50 to-transparent" />
                </>
            )}

            {!bgImage && (
                <div className="absolute top-0 left-0 w-full h-[500px] bg-primary-900/20 blur-[120px] rounded-full pointer-events-none" />
            )}

            {/* Main Content */}
            <div className="relative z-10 max-w-[1600px] mx-auto w-full px-6 py-8">

                {/* Header / Steps */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate('/decks')} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7m-7 7h18" /></svg>
                    </button>
                    <div className="h-8 w-[1px] bg-white/10 mx-2" />
                    <div className="flex gap-2">
                        {[STEPS.BASICS, STEPS.COMMANDER, STEPS.AI_STRATEGY, STEPS.REVIEW].map((s, i) => (
                            <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step >= s ? 'w-12 bg-primary-500' : 'w-4 bg-gray-700'}`} />
                        ))}
                    </div>
                </div>

                {/* Content Container (Glass Box) */}
                <div className="bg-gray-950/40 border border-white/5 rounded-3xl p-8 shadow-2xl backdrop-blur-xl animate-fade-in-up">
                    {loading && step !== STEPS.AI_STRATEGY && (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
                        </div>
                    )}

                    {!loading && step === STEPS.BASICS && (
                        <div className="flex flex-col items-center space-y-12 animate-fade-in py-8">
                            <h1 className="text-5xl font-black text-white tracking-tight text-center">Let's build something <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400">legendary.</span></h1>

                            <div className="w-full max-w-5xl px-4 space-y-12">

                                {/* Commander / Spotlight Display (Only when selected) */}
                                {selectedCommander && (
                                    <div className="bg-gray-800/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm animate-fade-in-down">
                                        <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">{format === 'Commander' ? 'Commander' : 'Spotlight Card'}</h3>
                                        <div className="flex gap-6">
                                            <div className="relative group">
                                                <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-purple-500 rounded-2xl opacity-50 group-hover:opacity-75 blur transition duration-500" />
                                                <img
                                                    src={selectedCommander.image_uris?.normal || selectedCommander.image_uris?.large}
                                                    alt={selectedCommander.name}
                                                    className="relative w-64 rounded-xl shadow-2xl transform group-hover:scale-[1.02] transition-all duration-500"
                                                />
                                            </div>
                                            <div className="flex-1 flex flex-col justify-between">
                                                <div>
                                                    <h4 className="text-3xl font-black text-white mb-2">{selectedCommander.name}</h4>
                                                    <p className="text-gray-400 text-sm">{selectedCommander.type_line}</p>
                                                    <p className="text-gray-300 mt-4 text-base leading-relaxed">{selectedCommander.oracle_text}</p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedCommander(null)}
                                                    className="self-start text-sm font-bold text-red-400 hover:text-red-300 underline mt-4"
                                                >
                                                    Change {format === 'Commander' ? 'Commander' : 'Spotlight Card'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* MODE SECTION (First step if null) */}
                                {isMockup === null ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                            <h2 className="text-xl font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                                                <span className="bg-primary-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                                                Select Build Mode
                                            </h2>
                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
                                            {/* Collection Mode */}
                                            <div
                                                onClick={() => setIsMockup(false)}
                                                className="group cursor-pointer bg-gray-800/40 hover:bg-primary-900/20 border border-white/10 hover:border-primary-500/50 rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/10 flex flex-col items-center text-center gap-4 relative overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="w-20 h-20 bg-primary-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-white/5 group-hover:border-primary-500/30">
                                                    <svg className="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                </div>
                                                <div className="relative z-10">
                                                    <h3 className="text-2xl font-black text-white mb-2 group-hover:text-primary-300 transition-colors">From Collection</h3>
                                                    <p className="text-sm text-gray-400 leading-relaxed">Build using only cards you own.<br />Oracle verifies your binder.</p>
                                                </div>
                                            </div>

                                            {/* Mockup Mode */}
                                            <div
                                                onClick={() => setIsMockup(true)}
                                                className="group cursor-pointer bg-gray-800/40 hover:bg-purple-900/20 border border-white/10 hover:border-purple-500/50 rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/10 flex flex-col items-center text-center gap-4 relative overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="w-20 h-20 bg-purple-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-white/5 group-hover:border-purple-500/30">
                                                    <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                                </div>
                                                <div className="relative z-10">
                                                    <h3 className="text-2xl font-black text-white mb-2 group-hover:text-purple-300 transition-colors">Theorycraft Mockup</h3>
                                                    <p className="text-sm text-gray-400 leading-relaxed">Design without limits.<br />Missing cards added to wishlist.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* FORMAT SECTION (Second step once mode selected) */
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="flex items-center gap-4">
                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                            <h2 className="text-xl font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                                                <span className="bg-primary-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm cursor-pointer hover:bg-primary-400 transition-colors" onClick={() => setIsMockup(null)}>2</span>
                                                Select Format
                                            </h2>
                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                        </div>

                                        <div className="text-center mb-8">
                                            <p className="text-sm text-gray-400 uppercase tracking-widest">
                                                Building <span className={`font-bold ${isMockup ? 'text-purple-400' : 'text-primary-400'}`}>{isMockup ? 'Theorycraft Mockup' : 'From Collection'}</span>
                                                <button onClick={() => setIsMockup(null)} className="ml-3 text-xs text-gray-500 hover:text-white underline">Change</button>
                                            </p>
                                        </div>

                                        {/* 100-CARD FORMATS */}
                                        <div className="mb-12">
                                            <div className="flex items-center gap-4 mb-6">
                                                <h3 className="text-xl font-black text-white uppercase tracking-[0.2em]">100-Card Formats</h3>
                                                <div className="h-px flex-1 bg-gradient-to-r from-primary-500/50 to-transparent" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {SUPPORTED_FORMATS.filter(f => f !== 'Other' && f !== 'Limited').filter(f => getFormatDetails(f).rules.includes('100 Cards')).map(f => {
                                                    const details = getFormatDetails(f);
                                                    const hue = (f.length * 15 + f.charCodeAt(0) * 5) % 360;

                                                    return (
                                                        <div
                                                            key={f}
                                                            onClick={() => { setFormat(f); handleBasicsSubmit(f, isMockup); }}
                                                            className="group cursor-pointer bg-gray-800/40 hover:bg-gray-800 border border-white/10 hover:border-white/30 rounded-[2rem] p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col items-start gap-4 relative overflow-hidden"
                                                        >
                                                            <div
                                                                className="absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none"
                                                                style={{ backgroundColor: `hsl(${hue}, 80%, 55%)` }}
                                                            />

                                                            <div className="w-full relative z-10">
                                                                <div className="mb-2">
                                                                    <h3 className="text-xl sm:text-2xl font-black text-white transition-colors tracking-tight truncate pb-1 pr-2" style={{ textShadow: `0 2px 10px hsla(${hue}, 70%, 50%, 0.3)` }}>{f}</h3>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2 mb-3">
                                                                    {isCommanderFormat(f) && (
                                                                        <span className="bg-primary-500/20 text-primary-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-primary-500/30">Cmdr</span>
                                                                    )}
                                                                    {f !== 'Standard' && f !== 'Commander' && (
                                                                        <div className="relative group/badge inline-flex">
                                                                            <span className="bg-orange-500/20 text-orange-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-orange-500/30">Alpha</span>
                                                                            <div className="absolute left-0 bottom-full mb-2 w-48 bg-gray-900 border border-white/10 rounded-xl p-2 shadow-xl opacity-0 group-hover/badge:opacity-100 pointer-events-none transition-all z-50 text-center">
                                                                                <p className="text-[10px] text-gray-300 font-medium">Not all features in deck will be available for this format</p>
                                                                                <div className="absolute left-4 -bottom-1 w-2 h-2 bg-gray-900 border-b border-r border-white/10 transform rotate-45"></div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-gray-400 leading-relaxed min-h-[60px] relative z-10">{details.description}</p>
                                                            <div className="w-full mt-auto pt-4 border-t border-white/5 relative z-10">
                                                                <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-wider block">{details.rules}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* 60-CARD FORMATS */}
                                        <div>
                                            <div className="flex items-center gap-4 mb-6">
                                                <h3 className="text-xl font-black text-white uppercase tracking-[0.2em]">60-Card & Eternal Formats</h3>
                                                <div className="h-px flex-1 bg-gradient-to-r from-blue-500/50 to-transparent" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {SUPPORTED_FORMATS.filter(f => f !== 'Other' && f !== 'Limited').filter(f => !getFormatDetails(f).rules.includes('100 Cards')).map(f => {
                                                    const details = getFormatDetails(f);
                                                    const hue = (f.length * 25 + f.charCodeAt(0) * 7) % 360;

                                                    return (
                                                        <div
                                                            key={f}
                                                            onClick={() => { setFormat(f); handleBasicsSubmit(f, isMockup); }}
                                                            className="group cursor-pointer bg-gray-800/40 hover:bg-gray-800 border border-white/10 hover:border-white/30 rounded-[2rem] p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col items-start gap-4 relative overflow-hidden"
                                                        >
                                                            <div
                                                                className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none"
                                                                style={{ backgroundColor: `hsl(${hue}, 80%, 55%)` }}
                                                            />

                                                            <div className="w-full relative z-10">
                                                                <div className="mb-2">
                                                                    <h3 className="text-xl sm:text-2xl font-black text-white transition-colors tracking-tight truncate pb-1 pr-2" style={{ textShadow: `0 2px 10px hsla(${hue}, 70%, 50%, 0.3)` }}>{f}</h3>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2 mb-3">
                                                                    {isCommanderFormat(f) && (
                                                                        <span className="bg-primary-500/20 text-primary-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-primary-500/30">Cmdr</span>
                                                                    )}
                                                                    {f !== 'Standard' && f !== 'Commander' && (
                                                                        <div className="relative group/badge inline-flex">
                                                                            <span className="bg-orange-500/20 text-orange-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-orange-500/30">Alpha</span>
                                                                            <div className="absolute left-0 bottom-full mb-2 w-48 bg-gray-900 border border-white/10 rounded-xl p-2 shadow-xl opacity-0 group-hover/badge:opacity-100 pointer-events-none transition-all z-50 text-center">
                                                                                <p className="text-[10px] text-gray-300 font-medium">Not all features in deck will be available for this format</p>
                                                                                <div className="absolute left-4 -bottom-1 w-2 h-2 bg-gray-900 border-b border-r border-white/10 transform rotate-45"></div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-gray-400 leading-relaxed min-h-[60px] relative z-10">{details.description}</p>
                                                            <div className="w-full mt-auto pt-4 border-t border-white/5 relative z-10">
                                                                <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-wider block">{details.rules}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* QUICK ACTIONS SECTION */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                        <h2 className="text-xl font-black text-white uppercase tracking-[0.3em]">Quick Actions</h2>
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto w-full">
                                        {/* Import Deck */}
                                        <div
                                            onClick={() => setIsImportModalOpen(true)}
                                            className="group cursor-pointer bg-gray-800/40 hover:bg-blue-900/20 border border-white/10 hover:border-blue-500/50 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10 flex items-center gap-4 relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-white/5 group-hover:border-blue-500/30 flex-shrink-0">
                                                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                            </div>
                                            <div className="relative z-10 text-left">
                                                <h3 className="text-xl font-black text-white mb-1 group-hover:text-blue-300 transition-colors">Import Deck</h3>
                                                <p className="text-xs text-gray-400 leading-relaxed">Paste from Arena, Moxfield, or text file.</p>
                                            </div>
                                        </div>

                                        {/* Scan Deck */}
                                        <div className="group opacity-50 cursor-not-allowed bg-gray-800/20 border border-white/5 rounded-3xl p-6 flex items-center gap-4 relative">
                                            <div className="w-16 h-16 bg-gray-700/20 rounded-2xl flex items-center justify-center border border-white/5 flex-shrink-0">
                                                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            </div>
                                            <div className="relative z-10 text-left">
                                                <h3 className="text-xl font-black text-gray-500 mb-1">Scan Deck</h3>
                                                <p className="text-xs text-gray-600 leading-relaxed">Coming soon to Mobile Companion.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* PRECON SECTION */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                        <h2 className="text-xl font-black text-white uppercase tracking-[0.3em]">Precons</h2>
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                    </div>

                                    {preconTypesLoading ? (
                                        <div className="flex justify-center p-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                            {preconTypes.map((type) => (
                                                <div
                                                    key={type}
                                                    onClick={() => navigate(`/precons?type=${encodeURIComponent(type)}`)}
                                                    className="group cursor-pointer bg-gray-800/40 hover:bg-amber-900/20 border border-white/10 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col items-center text-center gap-3 relative overflow-hidden"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-white/5 group-hover:border-amber-500/30">
                                                        <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">{type}</h3>
                                                </div>
                                            ))}
                                            {preconTypes.length === 0 && (
                                                <div className="col-span-full text-center text-gray-500 py-8">
                                                    No precon types found. (Is the DB populated?)
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && step === STEPS.COMMANDER && renderCommanderSelection()}
                    {!loading && step === STEPS.PARTNER && renderPartnerSelection()}
                    {step === STEPS.AI_STRATEGY && renderAIStrategy()}
                    {!loading && step === STEPS.REVIEW && renderReview()}
                </div>
            </div>

            <CommanderSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onAdd={() => fetchCommanders()}
            />

            <ImportDeckModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportDeck}
            />

            {importing && (
                <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500 mb-4"></div>
                    <div className="text-white font-bold text-xl">Importing Deck...</div>
                    <div className="text-gray-400 text-sm mt-2">Checking collection for matches</div>
                </div>
            )}
        </div>
    );
};

export default CreateDeckPage;
