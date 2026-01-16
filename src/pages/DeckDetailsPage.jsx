import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDeck } from '../hooks/useDeck';
import { useDecks } from '../hooks/useDecks';
import useUndo from '../hooks/useUndo';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { useMarketData } from '../hooks/useMarketData';
import { deckService } from '../services/deckService';
import { getTierConfig } from '../config/tiers';
import CardSearchModal from '../components/CardSearchModal';
import ConfirmationModal from '../components/modals/ConfirmationModal';

import AddFromCollectionModal from '../components/modals/AddFromCollectionModal';
import DeckAdvancedStats from '../components/DeckAdvancedStats';
import DeckStatsModal from '../components/modals/DeckStatsModal';
import DeckStrategyModal from '../components/modals/DeckStrategyModal';
import ShareModal from '../components/social/ShareModal';
import DeckDoctorModal from '../components/modals/DeckDoctorModal';
import DeckAI from '../components/DeckAI';
import TokenModal from '../components/modals/TokenModal';
import CardGridItem from '../components/common/CardGridItem';
import StartAuditButton from '../components/Audit/StartAuditButton';
import ForgeLensModal from '../components/modals/ForgeLensModal';
import PrintSettingsModal from '../components/printing/PrintSettingsModal';

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
    const helperName = userProfile?.settings?.helper?.name || 'The Oracle';

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAddCollectionOpen, setIsAddCollectionOpen] = useState(false);
    const [isForgeLensOpen, setIsForgeLensOpen] = useState(false);

    // Edit Mode State
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');

    // Partner State
    const [activeCommanderIndex, setActiveCommanderIndex] = useState(0); // 0 = Main, 1 = Partner
    const [deleteCards, setDeleteCards] = useState(false);
    const [isManageMode, setIsManageMode] = useState(false);
    const [selectedCardIds, setSelectedCardIds] = useState(new Set());

    const toggleCardSelection = (id) => {
        const newSet = new Set(selectedCardIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedCardIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedCardIds.size === deckCards.length) {
            setSelectedCardIds(new Set());
        } else {
            setSelectedCardIds(new Set(deckCards.map(c => c.id)));
        }
    };

    const handleBulkAction = async () => {
        if (selectedCardIds.size === 0) return;

        const action = deck.is_mockup ? 'delete' : 'remove'; // Delete from DB for mockups, remove to binder for decks
        const count = selectedCardIds.size;

        if (!window.confirm(`Are you sure you want to ${action === 'delete' ? 'delete' : 'remove'} ${count} cards ? `)) return;

        try {
            const idsToRemove = Array.from(selectedCardIds);

            // Optimistic Update
            const newCards = deckCards.filter(c => !idsToRemove.includes(c.id)); // Note: c.id matches logic in toggleSelection
            recordAction(`Removed ${count} cards`, newCards);
            setCards(newCards);

            await deckService.batchRemoveCards(currentUser.uid, deckId, idsToRemove, action);
            addToast(`Successfully removed ${count} cards`, 'success');

            setIsManageMode(false);
            setSelectedCardIds(new Set());
            // No full reload needed if optimistic update works
            // But checking consistency is good
            refreshDeck(true);
        } catch (err) {
            console.error(err);
            addToast('Failed to remove cards', 'error');
            refreshDeck();
        }
    };
    const [flippedCards, setFlippedCards] = useState({}); // { [id]: boolean }
    const [fixingData, setFixingData] = useState(false); // Loading state for fetching back face

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
    const [isDoctorOpen, setIsDoctorOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
    const [isToolsMenuLocked, setIsToolsMenuLocked] = useState(false);
    const toolsMenuRef = useRef(null);
    const toolsMenuTimeoutRef = useRef(null);

    const [showStats, setShowStats] = useState(true);
    // Initialize from settings or default to 'grid'
    const [viewMode, setViewModeState] = useState(userProfile?.settings?.deckViewMode || 'grid');
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target)) {
                setIsToolsMenuLocked(false);
                setIsToolsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const setViewMode = (mode) => {
        setViewModeState(mode);
        updateSettings({ deckViewMode: mode });
    };

    const { deck, cards: deckCards, loading: deckLoading, error: deckError, refresh: refreshDeck } = useDeck(deckId);
    // Market Data
    const { value: marketValue, tcgPlayerLink } = useMarketData(deckCards);
    const { decks } = useDecks();
    const { cards: collection } = useCollection();

    // Undo/Redo Integration
    const handleUndoRedoStateChange = (restoredCards) => {
        setCards(currentCards => {
            // Diffing Logic: currentCards vs restoredCards
            // We need to transform current backend state (currentCards) to match history state (restoredCards)

            // 1. Find cards to remove (Present in current, missing in restored)
            // WE USE MANAGED ID (row id) for stable identity
            const restoredIds = new Set(restoredCards.map(c => c.managedId));
            const cardsToRemove = currentCards.filter(c => !restoredIds.has(c.managedId));

            // 2. Find cards to add (Present in restored, missing in current)
            const currentIds = new Set(currentCards.map(c => c.managedId));
            const cardsToAdd = restoredCards.filter(c => !currentIds.has(c.managedId));

            // 3. Find quantity updates
            const cardsToUpdate = restoredCards.filter(r => {
                const current = currentCards.find(c => c.managedId === r.managedId);
                return current && current.countInDeck !== r.countInDeck;
            });

            // Execute Sync Actions (Fire and forget, or toast on error)
            const syncBackend = async () => {
                try {
                    // Removals
                    if (cardsToRemove.length > 0) {
                        for (const c of cardsToRemove) {
                            await deckService.removeCardFromDeck(currentUser.uid, deckId, c.managedId);
                        }
                    }

                    // Additions (Complex: managedId changes on re-add usually)
                    // If we just re-add the card, the DB creates a NEW managedId.
                    // This breaks future diffs if we don't update local state with new ID.
                    // THIS IS A CRITICAL ISSUE with Undo/Redo on DB rows relative to snapshots.
                    // Snapshots store OLD managedIds.
                    // If I restore a snapshot with ID=100, but ID=100 was deleted, I can't "restore" ID=100.
                    // I must create a NEW card.
                    if (cardsToAdd.length > 0) {
                        for (const c of cardsToAdd) {
                            await deckService.addCardToDeck(currentUser.uid, deckId, c);
                        }
                        // We really should re-fetch here because IDs changed.
                        refreshDeck(true);
                    }

                    // Updates
                    if (cardsToUpdate.length > 0) {
                        for (const c of cardsToUpdate) {
                            await deckService.updateCardQuantity(currentUser.uid, deckId, c.managedId, c.countInDeck);
                        }
                    }

                } catch (err) {
                    console.error("Undo Sync Failed", err);
                    addToast('Sync error. Refreshing...', 'error');
                    refreshDeck();
                }
            };

            syncBackend();

            return restoredCards;
        });
    };

    const { undo, redo, recordAction, canUndo, canRedo } = useUndo(deckCards, handleUndoRedoStateChange);

    // Keyboard Shortcuts for Undo/Redo are handled by useUndo hook globally if mounted.
    // However, useUndo attaches listener to window. 
    // This is fine for DeckDetailsPage.

    // Permissions
    const permissionLevel = deck?.permissionLevel || 'viewer';
    const isOwner = permissionLevel === 'owner';
    const canEdit = permissionLevel === 'owner' || permissionLevel === 'editor';

    // Identity Lookup (Must be before early returns)
    const identityInfo = useMemo(() => {
        // Standard Deck Logic
        if (deck?.format?.toLowerCase() === 'standard') {
            const colors = deck.colors || deck.commander?.color_identity || [];
            // Find match for the deck's colors
            const match = MTG_IDENTITY_REGISTRY.find(entry => {
                if (entry.colors.length !== colors.length) return false;
                return entry.colors.every(c => colors.includes(c));
            });
            return match || { badge: "Standard", theme: "Constructed", flavor_text: "A format defined by rotation and meta mastery." };
        }

        // Merge colors from both commanders
        const mainColors = deck?.commander?.color_identity || [];
        const partnerColors = deck?.commander_partner?.color_identity || [];
        const deckColors = [...new Set([...mainColors, ...partnerColors])]; // Dedupe

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
        let count = deckCards.reduce((acc, c) => (((c.data?.type_line || c.type_line) || '').includes(type) ? acc + (c.countInDeck || 1) : acc), 0);

        // Add commander if not in the cards list but in the header
        // Compare using scryfall_id as c.id is the database row ID
        if (deck?.commander && !deckCards.some(c => c.scryfall_id === (deck.commander.id || deck.commander.scryfall_id) || (c.oracle_id && c.oracle_id === deck.commander.oracle_id))) {
            if ((deck.commander.type_line || '').includes(type)) count++;
        }
        if (deck?.commander_partner && !deckCards.some(c => c.scryfall_id === (deck.commander_partner.id || deck.commander_partner.scryfall_id) || (c.oracle_id && c.oracle_id === deck.commander_partner.oracle_id))) {
            if ((deck.commander_partner.type_line || '').includes(type)) count++;
        }
        return count;
    };

    const totalCards = useMemo(() => {
        if (!deckCards) return 0;
        let total = deckCards.reduce((acc, c) => acc + (c.countInDeck || 1), 0);
        // Include commanders in header if not present as rows
        if (deck?.commander && !deckCards.some(c => c.scryfall_id === (deck.commander.id || deck.commander.scryfall_id) || (c.oracle_id && c.oracle_id === deck.commander.oracle_id))) total++;
        if (deck?.commander_partner && !deckCards.some(c => c.scryfall_id === (deck.commander_partner.id || deck.commander_partner.scryfall_id) || (c.oracle_id && c.oracle_id === deck.commander_partner.oracle_id))) total++;
        return total;
    }, [deckCards, deck]);

    const ownedCardsCount = useMemo(() => {
        if (!deckCards) return 0;
        let owned = deckCards
            .filter(c => !c.is_wishlist)
            .reduce((acc, c) => acc + (c.countInDeck || 1), 0);

        // Commanders in header are considered owned for counting purposes
        if (deck?.commander && !deckCards.some(c => c.scryfall_id === (deck.commander.id || deck.commander.scryfall_id) || (c.oracle_id && c.oracle_id === deck.commander.oracle_id))) owned++;
        if (deck?.commander_partner && !deckCards.some(c => c.scryfall_id === (deck.commander_partner.id || deck.commander_partner.scryfall_id) || (c.oracle_id && c.oracle_id === deck.commander_partner.oracle_id))) owned++;
        return owned;
    }, [deckCards, deck]);

    const isBinder = deck?.format === 'binder';

    const totalValue = useMemo(() => {
        if (!deckCards) return 0;
        let value = deckCards.reduce((acc, c) => {
            const price = parseFloat(c.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd']) || (parseFloat(c.data?.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd']) || 0);
            return acc + (price * (c.countInDeck || 1));
        }, 0);

        // Add commander value if not in list
        if (deck?.commander && !deckCards.some(c => c.scryfall_id === (deck.commander.id || deck.commander.scryfall_id) || (c.oracle_id && c.oracle_id === deck.commander.oracle_id))) {
            const c = deck.commander;
            const price = parseFloat(c.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd']) || 0;
            value += price;
        }
        if (deck?.commander_partner && !deckCards.some(c => c.scryfall_id === (deck.commander_partner.id || deck.commander_partner.scryfall_id) || (c.oracle_id && c.oracle_id === deck.commander_partner.oracle_id))) {
            const c = deck.commander_partner;
            const price = parseFloat(c.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd']) || 0;
            value += price;
        }

        return value;
    }, [deckCards, deck]);

    // KPI Calculations (Moved before early returns)
    const kpiData = useMemo(() => {
        const blueprint = deck?.aiBlueprint || {};
        // Support new nested layout.types and legacy suggestedCounts
        const targets = blueprint.layout?.types || blueprint.suggestedCounts || {};

        const layout = [
            { label: 'Total', current: totalCards, target: (deck?.format?.toLowerCase() === 'standard' || deck?.format?.toLowerCase() === 'modern' ? 60 : 100) },
            { label: 'Creatures', current: countByType('Creature'), target: targets.Creatures || targets.Creature || 30 },
            { label: 'Lands', current: countByType('Land'), target: targets.Lands || targets.Land || 36 },
            { label: 'Instants', current: countByType('Instant'), target: targets.Instants || targets.Instant || 10 },
            { label: 'Sorceries', current: countByType('Sorcery'), target: targets.Sorceries || targets.Sorcery || 10 },
            { label: 'Enchantments', current: countByType('Enchantment'), target: targets.Enchantments || targets.Enchantment || 5 },
            { label: 'Artifacts', current: countByType('Artifact'), target: targets.Artifacts || targets.Artifact || 10 },
            { label: 'Planeswalkers', current: countByType('Planeswalker'), target: targets.Planeswalkers || targets.Planeswalker || 0 },
        ];

        return layout.filter(item => item.target > 0);
    }, [deck, totalCards, deckCards]);

    // Group cards (Moved before early returns)
    const groupedCards = useMemo(() => {
        if (!deckCards) return {};
        const groups = {
            Commander: [], Creature: [], Planeswalker: [], Instant: [],
            Sorcery: [], Artifact: [], Enchantment: [], Land: [], Other: []
        };

        deckCards.forEach(c => {
            const cardData = c;
            const typeLine = ((cardData.data?.type_line || cardData.type_line) || '').toLowerCase();

            const isCommander = deck?.commander && (cardData.scryfall_id === (deck.commander.id || deck.commander.scryfall_id) || (cardData.oracle_id && cardData.oracle_id === deck.commander.oracle_id));
            const isPartner = deck?.commander_partner && (cardData.scryfall_id === (deck.commander_partner.id || deck.commander_partner.scryfall_id) || (cardData.oracle_id && cardData.oracle_id === deck.commander_partner.oracle_id));

            if (isCommander || isPartner) {
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
        link.download = `${deck.name.replace(/[^a-z0-9]/yi, '_')} _backup.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // EDH Power Level Integration (from https://edhpowerlevel.com)
    const EDHPowerLevelEncode = (decklistString) => {
        let arr = decklistString.split(/[\r\n~]/);
        arr.forEach((c, i) => {
            c = c.split("(")[0]; // Remove set info in parentheses
            c = c.replace(/ *\[[^\]]*\] */g, " "); // Remove brackets
            c = c.replace(/ *<[^>]*> */g, " "); // Remove angle brackets  
            c = c.trim();
            arr[i] = c;
        });
        const cleanedDeck = arr.join("~");
        return encodeURIComponent(cleanedDeck).replace(/%20/g, "+") + "~Z~";
    };

    const handleEDHPowerLevel = () => {
        if (!deck || !deckCards) return;

        // Format deck list: "1 Card Name" per line
        const decklistLines = [];

        // Add commander(s)
        if (deck.commander) {
            decklistLines.push(`1 ${deck.commander.name} `);
        }
        if (deck.commander_partner) {
            decklistLines.push(`1 ${deck.commander_partner.name} `);
        }

        // Add all other cards
        deckCards.forEach(card => {
            const count = card.countInDeck || 1;
            const name = card.name || card.data?.name || '';
            if (name) {
                decklistLines.push(`${count} ${name} `);
            }
        });

        const decklistString = decklistLines.join("\n");
        const encoded = EDHPowerLevelEncode(decklistString);

        // Open in new tab
        window.open(`https://edhpowerlevel.com?d=${encoded}`, '_blank');
    };

    const handleTCGPlayer = () => {
        if (!deck || !deckCards) return;

        // Format as "Quantity CardName" per line for TCGPlayer mass entry
        const cardLines = [];

        // Add commander(s)
        if (deck.commander) {
            cardLines.push(`1 ${deck.commander.name}`);
        }
        if (deck.commander_partner) {
            cardLines.push(`1 ${deck.commander_partner.name}`);
        }

        // Add all other cards
        deckCards.forEach(card => {
            const count = card.countInDeck || 1;
            const name = card.name || card.data?.name || '';
            if (name) {
                cardLines.push(`${count} ${name}`);
            }
        });

        const decklistText = cardLines.join('\n');

        // TCGPlayer mass entry URL - we'll encode the list
        const encoded = encodeURIComponent(decklistText);
        window.open(`https://www.tcgplayer.com/massentry?c=${encoded}`, '_blank');
    };

    const handleAddToDeck = async (card) => {
        try {
            // Optimistic Update
            // Note: managedId is missing until refresh. We use a temp placeholder.
            const newCard = { ...card, countInDeck: 1, managedId: `temp-${Date.now()}` };
            const newCards = [...deckCards, newCard];

            // Record History
            recordAction(`Added ${card.name}`, newCards);
            setCards(newCards);

            await deckService.addCardToDeck(currentUser.uid, deckId, card);
            addToast(`Added ${card.name} to deck`, 'success');
            // Silent refresh to get real managedId (important for subsequent deletes)
            refreshDeck(true);
        } catch (err) {
            console.error(err);
            addToast('Failed to add card to deck', 'error');
            refreshDeck(); // Revert on error
        }
    };

    const handleRemoveFromDeck = async (cardId, cardName) => {
        setConfirmModal({
            isOpen: true,
            title: 'Remove Card',
            message: `Are you sure you want to remove ${cardName} from this deck?`,
            onConfirm: async () => {
                try {
                    // Optimistic Update
                    const newCards = deckCards.filter(c => c.managedId !== cardId && c.id !== cardId); // Check both for robustness

                    recordAction(`Removed ${cardName}`, newCards);
                    setCards(newCards);

                    await deckService.removeCardFromDeck(currentUser.uid, deckId, cardId); // cardId is managedId
                    addToast(`Removed ${cardName} from deck`, 'success');
                } catch (err) {
                    console.error(err);
                    addToast('Failed to remove card', 'error');
                    refreshDeck(); // Revert on error
                }
            }
        });
    };

    // Helper to robustly get image URL from various potential structures
    const getCardImage = (card) => {
        if (!card) return 'https://placehold.co/250x350?text=No+Image';
        const data = card.data || card; // Handle both structures (flat or nested)
        const isFlipped = flippedCards[data.id];

        // 1. Handle Flipped State (Back Face)
        if (isFlipped && data.card_faces && data.card_faces[1]) {
            if (data.card_faces[1].image_uris?.normal) {
                return data.card_faces[1].image_uris.normal;
            }
        }

        // 2. Check direct image_uris (normal) on data object
        if (data.image_uris?.normal) return data.image_uris.normal;

        // 3. Check 2-sided cards (card_faces) on data object (Front Face default)
        if (data.card_faces?.[0]?.image_uris?.normal) return data.card_faces[0].image_uris.normal;

        // 4. Check table column 'image_uri' (singular) if present
        if (card.image_uri) return card.image_uri;

        // 5. Fallback
        return 'https://placehold.co/250x350?text=No+Image';
    };

    const handleFlip = async (e, card, index) => {
        e.stopPropagation();

        // 1. Logic: If clicking inactive partner -> Swap. If active -> Flip.
        if (deck.commander_partner && activeCommanderIndex !== index) {
            setActiveCommanderIndex(index);
            return;
        }

        // 2. Check if card is flip-able
        const data = card.data || card;
        if (!data.card_faces || data.card_faces.length < 2) return;

        // 3. Check if back face data is missing (common with minimal search results)
        // If we are about to flip to back (currently false), check for image
        if (!flippedCards[data.id] && !data.card_faces[1].image_uris) {
            setFixingData(true);
            try {
                addToast('Fetching back face data...', 'info');
                const response = await fetch(`https://api.scryfall.com/cards/${data.id}`);
                if (!response.ok) throw new Error('Fetch failed');

                const fullCardData = await response.json();

                // Construct update payload
                // We need to update specifically the 'commander' or 'commander_partner' field in the DB
                const updateField = index === 0 ? { commander: fullCardData } : { commanderPartner: fullCardData };

                await deckService.updateDeck(currentUser.uid, deckId, updateField);

                // Re-fetch to get clean state
                refreshDeck(true);

                addToast('Commander data updated.', 'success');
            } catch (err) {
                console.error("Flip fix failed", err);
                addToast('Could not load card back.', 'error');
            } finally {
                setFixingData(false);
            }
        }

        // 4. Toggle Flip State
        setFlippedCards(prev => ({
            ...prev,
            [data.id]: !prev[data.id]
        }));
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

    const deleteCardsRef = React.useRef(false);
    const [renderDeleteCheckbox, setRenderDeleteCheckbox] = useState(false);

    const handleDeleteDeck = () => {
        deleteCardsRef.current = false; // Reset
        setRenderDeleteCheckbox(true);
        setConfirmModal({
            isOpen: true,
            title: 'Delete Deck',
            message: 'Are you sure you want to delete this deck? Cards inside will be returned to your collection binder.',
            onConfirm: async () => {
                try {
                    await deckService.deleteDeck(currentUser.uid, deckId, { deleteCards: deleteCardsRef.current });
                    addToast('Deck deleted successfully', 'success');
                    navigate('/decks');
                } catch (err) {
                    console.error(err);
                    addToast('Failed to delete deck', 'error');
                } finally {
                    setRenderDeleteCheckbox(false);
                }
            }
        });
    };


    // Changing approach: Render ConfirmationModal separately with dynamic props
    // We already have `confirmModal` state. We can add a child rendering function or just use state directly if we render the modal in JSX.
    // The current pattern uses a single state object `confirmModal` to drive the modal.
    // To support checkboxes, we need to render the checkbox IN the modal.
    // So we should modify how we RENDER ConfirmationModal in the return statement.

    // Let's scroll down to where ConfirmationModal is rendered.
    // It's likely at the bottom.


    const getArtCrop = (card) => {
        if (!card) return '';
        const data = card.data || card;
        const isFlipped = flippedCards[data.id];

        // 1. Handle Flipped State (Back Face)
        if (isFlipped && data.card_faces && data.card_faces[1]) {
            if (data.card_faces[1].image_uris?.art_crop) {
                return data.card_faces[1].image_uris.art_crop;
            }
        }

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

    const activeCommander = activeCommanderIndex === 0 ? deck.commander : (deck.commander_partner || deck.commander);
    const commanderImage = getArtCrop(activeCommander);
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



                <div className="sticky top-16 z-40 bg-gradient-to-r from-gray-900/95 via-gray-900/80 to-gray-900/40 backdrop-blur-3xl border-b border-white/10 shadow-2xl transition-all duration-300 mx-auto w-full max-w-[1600px] rounded-b-3xl">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 px-3 md:px-8 py-3 md:py-4">
                        {/* Left: Identity Section */}
                        <div className="flex items-start gap-3 md:gap-4 min-w-0 shrink-0">
                            <Link
                                to="/decks"
                                className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700 transition-all shrink-0 mt-0.5 md:mt-0"
                                title="Back to Decks"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                            </Link>

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
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <div className="flex items-center gap-2 group max-w-full">
                                            <h2 className="text-xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase truncate leading-tight flex-1" title={deck.name}>{deck.name}</h2>
                                            {canEdit && (
                                                <button onClick={handleStartEdit} className="p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white shrink-0">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <div className="text-[10px] md:text-[11px] text-indigo-300 font-black uppercase tracking-[0.15em] md:tracking-[0.2em] opacity-80 whitespace-nowrap">
                                                {identityInfo.badge} — {identityInfo.theme}
                                            </div>
                                            {!isOwner && (
                                                <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap ${canEdit ? 'bg-green-900/40 text-green-400 border-green-500/30' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                                                    {permissionLevel} Access
                                                </span>
                                            )}
                                            <div className="flex items-center gap-1 shrink-0">
                                                {/* Calculate combined identity for display */
                                                    (() => {
                                                        const mainColors = deck?.commander?.color_identity || [];
                                                        const partnerColors = deck?.commander_partner?.color_identity || [];
                                                        const allColors = [...new Set([...mainColors, ...partnerColors])];

                                                        return allColors.map(color => (
                                                            <img
                                                                key={color}
                                                                src={colorIdentityMap[color]}
                                                                alt={color}
                                                                className="w-5 h-5 md:w-6 md:h-6 shadow-sm"
                                                            />
                                                        ));
                                                    })()
                                                }
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 md:mt-3">
                                    <div className="flex items-center gap-2 bg-black/40 px-2.5 md:px-3 py-1 md:py-1.5 rounded-xl border border-white/5 backdrop-blur-md shadow-2xl">
                                        <span className="bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-orange-500/30">
                                            {deck.format || 'Commander'}
                                        </span>
                                        {deck.tags && deck.tags.includes('Precon') && (
                                            <span className="bg-teal-600/20 text-teal-400 px-2 md:px-2.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-teal-500/30">
                                                Precon
                                            </span>
                                        )}
                                        {deck.aiBlueprint?.grade?.commanderBracket && (
                                            <span className="bg-indigo-600/20 text-indigo-300 px-2 md:px-2.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
                                                <span className="hidden md:inline">Bracket </span>{deck.aiBlueprint.grade.commanderBracket}
                                            </span>
                                        )}
                                        {deck.is_mockup && (
                                            <span className="bg-red-600/20 text-red-400 px-2 md:px-2.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-red-500/30">
                                                Mockup
                                            </span>
                                        )}

                                        {deck.aiBlueprint?.grade?.powerLevel > 0 && (
                                            <div className="flex items-center">
                                                <div className="h-4 w-px bg-white/10 mx-1" />
                                                <span className="text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-80">
                                                    <span className="hidden md:inline">power </span>{deck.aiBlueprint.grade.powerLevel.toFixed(1)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="h-4 w-px bg-white/10 mx-1" />
                                        <span className="text-gray-400 text-[10px] md:text-xs font-bold font-mono">
                                            ${totalValue.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="hidden sm:block flex-1 px-8 text-center">
                            <div className="text-[12px] md:text-[13px] text-white/30 italic font-medium tracking-tight mx-auto max-w-2xl leading-relaxed">
                                "{identityInfo.flavor_text}"
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 md:gap-3 bg-gray-950/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md relative self-end lg:self-auto">
                            <div className="flex gap-1 mr-2 border-r border-white/10 pr-3">
                                <button
                                    onClick={undo}
                                    disabled={!canUndo}
                                    className={`p-2 rounded-lg transition-colors ${canUndo ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-900/50 text-gray-600 cursor-not-allowed'}`}
                                    title="Undo (Ctrl+Z)"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                </button>
                                <button
                                    onClick={redo}
                                    disabled={!canRedo}
                                    className={`p-2 rounded-lg transition-colors ${canRedo ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-900/50 text-gray-600 cursor-not-allowed'}`}
                                    title="Redo (Ctrl+Y)"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                                </button>
                            </div>

                            <button
                                onClick={() => setIsStrategyModalOpen(true)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2.5 px-4 md:px-6 rounded-xl shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-2 uppercase tracking-widest text-[10px] md:text-xs shrink-0"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                <span className="hidden sm:inline">Strategy</span>
                            </button>

                            {canEdit && (
                                <button
                                    onClick={() => setIsAddCollectionOpen(true)}
                                    className="bg-green-600 hover:bg-green-500 text-white font-black py-2.5 px-4 md:px-6 rounded-xl shadow-lg shadow-green-900/40 transition-all flex items-center gap-2 uppercase tracking-widest text-[10px] md:text-xs shrink-0"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                    <span className="hidden sm:inline">Collection</span>
                                </button>
                            )}



                            {/* Grouped Action Menu */}
                            <div
                                ref={toolsMenuRef}
                                className="relative"
                                onMouseEnter={() => {
                                    if (toolsMenuTimeoutRef.current) {
                                        clearTimeout(toolsMenuTimeoutRef.current);
                                        toolsMenuTimeoutRef.current = null;
                                    }
                                    setIsToolsMenuOpen(true);
                                }}
                                onMouseLeave={() => {
                                    if (!isToolsMenuLocked) {
                                        toolsMenuTimeoutRef.current = setTimeout(() => {
                                            setIsToolsMenuOpen(false);
                                        }, 400); // 400ms delay for easier navigation
                                    }
                                }}
                            >
                                <button
                                    onClick={() => {
                                        const newLocked = !isToolsMenuLocked;
                                        setIsToolsMenuLocked(newLocked);
                                        setIsToolsMenuOpen(true);
                                    }}
                                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all duration-300 shadow-xl ${isToolsMenuLocked
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-300 hover:text-white hover:border-indigo-500/50 hover:bg-indigo-600/20'
                                        }`}
                                >
                                    <div className="flex -space-x-1.5 items-center">
                                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center backdrop-blur-sm">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        </div>
                                        <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center backdrop-blur-sm">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                                        </div>
                                        <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center backdrop-blur-sm">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest">{isToolsMenuLocked ? 'Close' : 'Tools'}</span>
                                </button>
                                {isToolsMenuOpen && (
                                    <div className="absolute right-0 top-full mt-3 w-72 md:w-80 bg-gray-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <div className="p-4 space-y-6">
                                            {/* Section: Building */}
                                            <div className="space-y-2">
                                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Deck Building</h3>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {canEdit && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setIsForgeLensOpen(true); setIsToolsMenuOpen(false); }}
                                                            className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-indigo-500/20 rounded-xl border border-white/5 transition-all group lg:min-h-[64px] group"
                                                            title="Forge Lens: Scan & Add"
                                                        >
                                                            <svg className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                                            <span className="text-[10px] font-bold text-gray-300">Forge Lens</span>
                                                        </button>
                                                    )}


                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsSearchOpen(true); setIsToolsMenuOpen(false); }}
                                                        className={`flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5 transition-all group ${canEdit ? 'hover:bg-indigo-500/20' : 'opacity-50 cursor-not-allowed'}`}
                                                        disabled={!canEdit}
                                                    >
                                                        <svg className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                                        <span className="text-[10px] font-bold text-gray-300">Search</span>
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsTokenModalOpen(true); setIsToolsMenuOpen(false); }}
                                                        className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-indigo-500/20 rounded-xl border border-white/5 transition-all group group"
                                                    >
                                                        <svg className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" /></svg>
                                                        <span className="text-[10px] font-bold text-gray-300">View Tokens</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Section: Analysis */}
                                            <div className="space-y-2">
                                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Logic & Analysis</h3>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const tierConfig = getTierConfig(userProfile?.subscription_tier);
                                                            if (!tierConfig.features.deckDoctor) {
                                                                addToast('Deck Doctor is available on Wizard tier and above.', 'info');
                                                                return;
                                                            }
                                                            setIsDoctorOpen(true);
                                                            setIsToolsMenuOpen(false);
                                                        }}
                                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all group ${getTierConfig(userProfile?.subscription_tier).features.deckDoctor
                                                            ? 'bg-indigo-500/10 hover:bg-indigo-500/30 border-indigo-500/20'
                                                            : 'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <svg className="w-8 h-8 text-indigo-400 group-hover:scale-110 transition-transform bg-indigo-500/20 p-1.5 rounded-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Deck Doctor</span>
                                                    </button>

                                                    {
                                                        canEdit && (
                                                            getTierConfig(userProfile?.subscription_tier).features.deckAudit ? (
                                                                <div onClick={() => setIsToolsMenuOpen(false)} className="h-full">
                                                                    <StartAuditButton type="deck" targetId={deckId} label="Audit" className="w-full h-full flex flex-col items-center gap-2 p-3 bg-purple-500/10 hover:bg-purple-500/30 border border-purple-500/20 rounded-xl transition-all font-bold text-[10px] text-purple-300" />
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); addToast('Deck Audits are available on Magician tier and above.', 'info'); }}
                                                                    className="flex flex-col items-center gap-2 p-3 bg-gray-900 border border-gray-800 rounded-xl opacity-40 cursor-not-allowed"
                                                                >
                                                                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                    <span className="text-[10px] font-bold text-gray-500">Audit</span>
                                                                </button>
                                                            )
                                                        )
                                                    }
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Tabletop & Print</h3>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Link
                                                        to={`/solitaire/${deckId}`}
                                                        className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-amber-500/20 rounded-xl border border-amber-500/10 hover:border-amber-500/30 transition-all group lg:min-h-[64px]"
                                                    >
                                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🃏</span>
                                                        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Playtest</span>
                                                    </Link>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsPrintModalOpen(true); setIsToolsMenuOpen(false); }}
                                                        className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-gray-500/20 rounded-xl border border-gray-500/10 hover:border-gray-500/30 transition-all group lg:min-h-[64px]"
                                                    >
                                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🖨️</span>
                                                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Print</span>
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate('/play'); setIsToolsMenuOpen(false); }}
                                                        className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-green-500/20 rounded-xl border border-green-500/10 hover:border-green-500/30 transition-all group lg:min-h-[64px]"
                                                    >
                                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🎲</span>
                                                        <span className="text-[10px] font-bold text-green-300 uppercase tracking-wider">Life Counter</span>
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate('/tournaments'); setIsToolsMenuOpen(false); }}
                                                        className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-orange-500/20 rounded-xl border border-orange-500/10 hover:border-orange-500/30 transition-all group lg:min-h-[64px]"
                                                    >
                                                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🏆</span>
                                                        <span className="text-[10px] font-bold text-orange-300 uppercase tracking-wider">Tournaments</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {activeTab === 'market' && (
                                                <div className="space-y-8 animate-fade-in">
                                                    {/* Value Summary */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <div className="bg-gray-900/50 p-4 rounded-2xl border border-white/5">
                                                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Value</div>
                                                            <div className="text-3xl font-mono font-bold text-amber-500">
                                                                ${marketValue?.total?.toFixed(2) || '0.00'}
                                                            </div>
                                                        </div>
                                                        <div className="bg-gray-900/50 p-4 rounded-2xl border border-white/5">
                                                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Avg Card Price</div>
                                                            <div className="text-xl font-mono font-bold text-gray-300">
                                                                ${marketValue?.average?.toFixed(2) || '0.00'}
                                                            </div>
                                                        </div>
                                                        <div className="bg-gray-900/50 p-4 rounded-2xl border border-white/5">
                                                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Most Expensive</div>
                                                            <div className="text-sm font-bold text-white truncate">{marketValue?.maxCard?.name || '-'}</div>
                                                            <div className="text-lg font-mono text-indigo-400">${marketValue?.max?.toFixed(2) || '0.00'}</div>
                                                        </div>
                                                    </div>

                                                    {/* Charts */}
                                                    <DeckValueChart cards={deckCards} />

                                                    {/* Conversion Actions */}
                                                    <div className="flex justify-center pt-8">
                                                        <a
                                                            href={tcgPlayerLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-green-900/50 hover:shadow-green-500/30 transition-all transform hover:-translate-y-1"
                                                        >
                                                            <span className="relative z-10 flex items-center gap-2">
                                                                Buy Deck on TCGPlayer
                                                                <svg className="w-5 h-5 opacity-70 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                            </span>
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Management</h3>
                                                <div className="bg-white/5 rounded-xl border border-white/5 divide-y divide-white/5">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsShareModalOpen(true); setIsToolsMenuOpen(false); }}
                                                        className="w-full text-left px-4 py-3 text-xs flex items-center justify-between hover:bg-indigo-500/10 transition-colors group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                                            <span className="font-bold text-gray-300">Share Deck</span>
                                                        </div>
                                                        <svg className="w-3 h-3 text-gray-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (getTierConfig(userProfile?.subscription_tier).features.deckBackup) {
                                                                handleExportDeck();
                                                                setIsToolsMenuOpen(false);
                                                            } else {
                                                                addToast('Deck Export is available on Magician tier and above.', 'error');
                                                            }
                                                        }}
                                                        className={`w-full text-left px-4 py-3 text-xs flex items-center justify-between transition-colors group ${getTierConfig(userProfile?.subscription_tier).features.deckBackup ? 'hover:bg-gray-800' : 'opacity-40 cursor-not-allowed'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                                            <span className="font-bold text-gray-300">Export JSON</span>
                                                        </div>
                                                        {!getTierConfig(userProfile?.subscription_tier).features.deckBackup && <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded leading-none">PRO</span>}
                                                    </button>

                                                    {canEdit && (
                                                        <>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (getTierConfig(userProfile?.subscription_tier).features.mockupDeck) {
                                                                        handleToggleMockup();
                                                                        setIsToolsMenuOpen(false);
                                                                    } else {
                                                                        addToast('Mockup Mode is available on Magician tier and above.', 'error');
                                                                    }
                                                                }}
                                                                className={`w-full text-left px-4 py-3 text-xs flex items-center justify-between transition-colors group ${getTierConfig(userProfile?.subscription_tier).features.mockupDeck ? 'hover:bg-orange-950/20' : 'opacity-40 cursor-not-allowed'}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                    <span className="font-bold text-gray-300">{deck.is_mockup ? 'To Collection' : 'To Mockup'}</span>
                                                                </div>
                                                            </button>

                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteDeck(); setIsToolsMenuOpen(false); }}
                                                                className="w-full text-left px-4 py-3 text-xs flex items-center gap-3 hover:bg-red-900/30 text-red-400 transition-colors"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                <span className="font-bold">Delete Deck</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Summary / Quick View */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
                    {
                        kpiData.map((kpi, idx) => {
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
                        })
                    }
                </div>

                {/* Quick Stats Summary Removed as per user request */}

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
                            <div className="flex bg-gray-900/50 rounded-lg p-1 gap-1 border border-gray-700 items-center">
                                {isManageMode ? (
                                    <div className="flex items-center gap-2 mr-2 animate-fade-in">
                                        <button
                                            onClick={handleSelectAll}
                                            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs px-2 mr-2 border border-gray-600"
                                        >
                                            {selectedCardIds.size === deckCards.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                        <span className="text-xs text-indigo-300 font-bold ml-2">{selectedCardIds.size} Selected</span>
                                        <button
                                            onClick={handleBulkAction}
                                            disabled={selectedCardIds.size === 0}
                                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 rounded text-xs font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {deck.is_mockup ? 'Delete' : 'Remove'}
                                        </button>
                                        <button
                                            onClick={() => setIsManageMode(false)}
                                            className="p-1 px-2 text-gray-400 hover:text-white text-xs"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsManageMode(true)}
                                        className="text-xs font-bold text-gray-400 hover:text-indigo-400 px-3 transition-colors uppercase mr-1"
                                    >
                                        Select
                                    </button>
                                )}
                                <div className="w-px h-4 bg-gray-700 mx-1" />
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
                                    Use the "Collection" button to start building your deck.
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
                                                        decks={decks}
                                                        currentUser={userProfile}
                                                        showOwnerTag={true}
                                                        hideDeckTag={true}
                                                        hideOwnerTag={true}
                                                        selectMode={isManageMode}
                                                        isSelected={selectedCardIds.has(card.id)}
                                                        onToggleSelect={toggleCardSelection}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {cards.map((card, idx) => (
                                                    <div
                                                        key={card.id + idx}
                                                        className={`flex items-center justify-between p-2 hover:bg-gray-700/50 rounded-lg transition-colors text-sm group border ${selectedCardIds.has(card.id) ? 'bg-indigo-900/20 border-indigo-500/50' : 'border-transparent hover:border-gray-700'}`}
                                                        onClick={(e) => {
                                                            if (isManageMode) {
                                                                e.stopPropagation();
                                                                toggleCardSelection(card.id);
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {isManageMode && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedCardIds.has(card.id)}
                                                                    readOnly
                                                                    className="rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer"
                                                                />
                                                            )}
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
                                                            {canEdit && !isManageMode && (
                                                                <button
                                                                    onClick={() => handleRemoveFromDeck(card.firestoreId || card.id, card.name)}
                                                                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                                </button>
                                                            )}
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

                        {/* Commander Mini View - Hide for Binders */}
                        {!isBinder && deck.commander && (
                            <div className="bg-gray-950/40 backdrop-blur-3xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 relative group">
                                <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        {deck.format?.toLowerCase() === 'standard' ? 'Spotlight Card' : (deck.commander_partner ? 'Partners' : 'Commander')}
                                    </h3>
                                    {deck.commander_partner && (
                                        <button
                                            onClick={() => setActiveCommanderIndex(i => i === 0 ? 1 : 0)}
                                            className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-wider transition-colors"
                                        >
                                            Swap View ⟳
                                        </button>
                                    )}
                                </div>

                                <div className="p-4 flex justify-center relative min-h-[350px]">
                                    {/* Partner (Render Behind) */}
                                    {deck.commander_partner && (
                                        <div
                                            className={`transition-all duration-500 ease-out transform absolute top-4
                                            ${activeCommanderIndex === 0 ? 'scale-90 opacity-60 translate-x-4 -rotate-3 z-0 blur-[1px] hover:blur-0' : 'scale-100 opacity-100 z-10 translate-x-0 rotate-0'}
                                            cursor-pointer`}
                                            onClick={(e) => handleFlip(e, deck.commander_partner, 1)}
                                        >
                                            <div className="relative">
                                                <img
                                                    src={getCardImage(deck.commander_partner)}
                                                    className="w-full max-w-[250px] rounded-lg shadow-2xl skew-y-1"
                                                    alt={deck.commander_partner.name}
                                                />
                                                {/* Flip Indicator */}
                                                {(deck.commander_partner.card_faces || deck.commander_partner.data?.card_faces) && activeCommanderIndex === 1 && (
                                                    <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors backdrop-blur-sm">
                                                        <svg className={`w-4 h-4 ${fixingData ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Primary Commander */}
                                    <div
                                        className={`transition-all duration-500 ease-out transform relative
                                        ${deck.commander_partner && activeCommanderIndex === 1 ? 'scale-90 opacity-60 -translate-x-4 rotate-3 z-0 blur-[1px] hover:blur-0 cursor-pointer' : 'scale-100 opacity-100 z-10'}
                                        `}
                                        onClick={(e) => handleFlip(e, deck.commander, 0)}
                                    >
                                        <div className="relative">
                                            <img
                                                src={getCardImage(deck.commander)}
                                                className="w-full max-w-[250px] rounded-lg shadow-2xl hover:shadow-indigo-500/30 transition-shadow duration-300"
                                                alt={deck.commander.name}
                                            />
                                            {/* Flip Indicator */}
                                            {(deck.commander.card_faces || deck.commander.data?.card_faces) && activeCommanderIndex === 0 && (
                                                <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors backdrop-blur-sm">
                                                    <svg className={`w-4 h-4 ${fixingData ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* AI Tools - Hide for Binders */}
                        {!isBinder && (
                            <div className="bg-gray-950/40 backdrop-blur-3xl rounded-3xl shadow-2xl p-6 border border-white/10 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <span className="text-8xl">🤖</span>
                                </div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                    {helperName} Tools
                                </h3>
                                <div className="space-y-3 relative z-10">
                                    <button
                                        onClick={() => {
                                            if (deck.format?.toLowerCase() === 'standard') {
                                                addToast("Standard AI Deck Tech coming soon! Please verify on Discord to prioritize.", 'info', 0); // 0 = persistent
                                            } else {
                                                navigate(`/decks/${deckId}/build`);
                                            }
                                        }}
                                        className="w-full py-4 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 rounded-xl border border-indigo-500/20 hover:border-indigo-500/40 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 group/btn"
                                    >
                                        <span className="text-lg group-hover/btn:scale-110 transition-transform">✨</span>
                                        {helperName}'s Deck Builder
                                    </button>
                                    <button
                                        onClick={() => setIsStatsModalOpen(true)}
                                        className="w-full py-4 bg-indigo-900/10 hover:bg-indigo-900/20 text-indigo-400 rounded-xl border border-indigo-500/10 hover:border-indigo-500/30 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3"
                                    >
                                        <span className="text-lg">📊</span>
                                        Full Deck Stats
                                    </button>
                                    <button
                                        onClick={() => navigate('/tournaments')}
                                        className="w-full py-4 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 rounded-xl border border-yellow-500/20 hover:border-yellow-500/40 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3"
                                    >
                                        <span className="text-lg">🏆</span>
                                        Tournament Mode
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* External Sites */}
                        <div className="bg-gray-950/40 backdrop-blur-3xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 relative group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <span className="text-8xl">🌐</span>
                            </div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 p-4 pb-0 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                                External Sites
                            </h3>
                            <div className="space-y-3 relative z-10 p-4 pt-3">
                                <button
                                    onClick={handleEDHPowerLevel}
                                    className="w-full py-4 bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 group/btn"
                                >
                                    <span className="text-lg group-hover/btn:scale-110 transition-transform">📊</span>
                                    EDH Power Level
                                </button>
                                <button
                                    onClick={handleTCGPlayer}
                                    className="w-full py-4 bg-green-900/10 hover:bg-green-900/20 text-green-400 rounded-xl border border-green-500/10 hover:border-green-500/30 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3"
                                >
                                    <span className="text-lg">🛒</span>
                                    Buy on TCGPlayer
                                </button>
                            </div>
                        </div>

                        {/* DeckAI Component Integration */}
                        {/* Kept for inline access if desired, but button above now opens modal */}
                        {/* <DeckAI deck={deck} cards={deckCards} /> */}
                    </div>
                </div>




                {/* Modals moved outside to prevent transform context issues */}
                {/* Mobile FAB / Action Bar if needed */}

                {/* Share Modal */}
                <ShareModal
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    deck={deck}
                    onUpdateDeck={(updates) => {
                        // Optimistically update sharing state if needed
                        if (updates.is_public !== undefined) deck.is_public = updates.is_public;
                        if (updates.shareSlug !== undefined) deck.shareSlug = updates.shareSlug;
                    }}
                />


                {/* Doctor Modal */}
                <DeckDoctorModal
                    isOpen={isDoctorOpen}
                    onClose={() => setIsDoctorOpen(false)}
                    deck={deck}
                    cards={deckCards}
                    isOwner={canEdit}
                />

                {/* Moved Modals */}
                {/* Search Modal */}
                <CardSearchModal
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                    onAddCard={handleAddToDeck}
                    onOpenForgeLens={() => {
                        setIsSearchOpen(false);
                        setIsForgeLensOpen(true);
                    }}
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
                >
                    {renderDeleteCheckbox && (
                        <div className="flex items-center gap-2 mb-4 bg-white/5 p-3 rounded-lg border border-white/10">
                            <input
                                type="checkbox"
                                id="deleteCardsCheckbox"
                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-red-600 focus:ring-red-500"
                                onChange={(e) => deleteCardsRef.current = e.target.checked}
                            />
                            <label htmlFor="deleteCardsCheckbox" className="text-gray-300 text-sm select-none">
                                Also remove these cards from my {deck.is_mockup ? 'wishlist' : 'collection binder'}
                            </label>
                        </div>
                    )}
                </ConfirmationModal>

                {/* Strategy Blueprint Modal */}
                <DeckStrategyModal
                    isOpen={isStrategyModalOpen}
                    onClose={() => setIsStrategyModalOpen(false)}
                    deck={deck}
                    cards={deckCards}
                    onStrategyUpdate={() => refreshDeck(true)}
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

                <ForgeLensModal
                    isOpen={isForgeLensOpen}
                    onClose={() => setIsForgeLensOpen(false)}
                    onFinish={async (scannedBatch, options = {}) => {
                        if (!scannedBatch.length) return;
                        try {
                            const { targetDeckId, additionMode } = options;
                            const payload = scannedBatch.map(item => ({
                                name: item.name,
                                scryfall_id: item.scryfall_id,
                                set_code: item.set_code,
                                collector_number: item.collector_number,
                                image_uri: item.data.image_uris?.normal || item.data.card_faces?.[0]?.image_uris?.normal,
                                count: item.quantity,
                                data: item.data,
                                finish: item.finish || 'nonfoil',
                                is_wishlist: item.is_wishlist,
                                tags: []
                            }));

                            const apiMode = additionMode === 'transfer' ? 'transfer_to_deck' : 'merge';
                            // Use the targetDeckId from options if provided, otherwise fallback to current deckId
                            const finalDeckId = targetDeckId || deckId;

                            await deckService.batchAddCardsToDeck(currentUser.uid, finalDeckId, payload, apiMode);

                            const destination = targetDeckId ? (targetDeckId === deckId ? 'this deck' : 'another deck') : 'your collection';
                            addToast(`Successfully ${additionMode === 'transfer' ? 'moved' : 'added'} ${scannedBatch.length} cards to ${destination}!`, 'success');

                            if (finalDeckId === deckId) refreshDeck();
                        } catch (err) {
                            console.error("Forge Lens Add Failed", err);
                            addToast("Failed to add scanned cards.", "error");
                        }
                    }}
                />

                <TokenModal
                    isOpen={isTokenModalOpen}
                    onClose={() => setIsTokenModalOpen(false)}
                    deckCards={deckCards}
                />

                <PrintSettingsModal
                    isOpen={isPrintModalOpen}
                    onClose={() => setIsPrintModalOpen(false)}
                    cards={deckCards}
                    deckName={deck?.name || 'Proxy Deck'}
                />
            </div>
        </div>
    );
};

export default DeckDetailsPage;
