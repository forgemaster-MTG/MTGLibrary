
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';
import { useDecks } from '../hooks/useDecks';
import { useBinders } from '../hooks/useBinders';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { communityService } from '../services/communityService';
import { collectionService } from '../services/collectionService'; // Import Service
import HistoryService from '../services/HistoryService'; // Import History
import useUndo from '../hooks/useUndo'; // Import Hook
import { useToast } from '../contexts/ToastContext';
import { getIdentity } from '../data/mtg_identity_registry';
import { getTierConfig, TIER_CONFIG, TIERS } from '../config/tiers';
import MultiSelect from '../components/MultiSelect';
import CardSkeleton from '../components/CardSkeleton';
import CardGridItem from '../components/common/CardGridItem';
import StartAuditButton from '../components/Audit/StartAuditButton';
import CardSearchModal from '../components/CardSearchModal';
import CollectionTable from '../components/CollectionTable';
import ViewToggle from '../components/ViewToggle';
import BulkCollectionImportModal from '../components/modals/BulkCollectionImportModal';
import BinderWizardModal from '../components/modals/BinderWizardModal';
import BinderGuideModal from '../components/modals/BinderGuideModal';
import OrganizationWizardModal from '../components/modals/OrganizationWizardModal';
import ForgeLensModal from '../components/modals/ForgeLensModal';
import { evaluateRules } from '../services/ruleEvaluator';



const CollapsibleSection = ({ title, defaultOpen = false, children, count }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-white/5 bg-gray-900/40 rounded-xl overflow-hidden mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <svg
                        className={`w - 4 h - 4 text - gray - 500 transition - transform ${isOpen ? 'rotate-90' : ''} `}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="font-bold text-gray-200">{title}</h3>
                    {count !== undefined && (
                        <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                            {count}
                        </span>
                    )}
                </div>
            </button>
            {isOpen && (
                <div className="p-4 pt-0 animate-fade-in border-t border-white/5">
                    {children}
                </div>
            )}
        </div>
    );
};

const CollectionPage = () => {
    const { userProfile } = useAuth();
    const { addToast } = useToast();
    // Parse query params for wishlist mode
    const location = useLocation();
    const isWishlistMode = new URLSearchParams(location.search).get('wishlist') === 'true';


    // Shared Collection Logic
    const [sharedSources, setSharedSources] = useState([]);
    const [selectedSource, setSelectedSource] = useState('me'); // 'me' or userId

    useEffect(() => {
        communityService.fetchIncomingPermissions()
            .then(data => {
                // data is array of perms. Extract unique owners.
                const unique = [];
                const seen = new Set();
                // Check if data is array or data.data (axios) - usually api returns data directly in this codebase helper?
                // api.js returns response.data usually.
                // communityService returns api.get result.
                const perms = Array.isArray(data) ? data : (data.data || []);

                perms.forEach(p => {
                    if (p.owner_id && !seen.has(p.owner_id)) {
                        seen.add(p.owner_id);
                        unique.push({ id: p.owner_id, name: p.owner_username || 'Unknown' });
                    }
                });
                setSharedSources(unique);
            })
            .catch(err => console.error("Failed to fetch shared sources", err));
    }, []);

    const isSharedView = selectedSource !== 'me' && selectedSource !== 'all';
    const isMixedView = selectedSource === 'all';

    const { cards, loading, error, refresh, removeCard, updateCard, setCards } = useCollection({
        wishlist: isWishlistMode,
        userId: selectedSource === 'me' ? null : selectedSource
    });
    const { binders, refreshBinders } = useBinders();
    const { decks, loading: decksLoading } = useDecks(selectedSource === 'me' ? null : selectedSource); // Decks hook may not support 'all' yet but we'll leave as is for now or fix if needed. 
    // Actually Decks hook probably needs update if we want mixed decks too, but task focused on collection. Let's pass 'all' and if deckService fails gracefully or we update it later.
    // For now assuming CollectionTable handles the mixed cards.
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const [syncLoading, setSyncLoading] = useState(false);

    // History & Undo Integration
    const { undo, redo, recordAction, canUndo, canRedo } = useUndo(cards, setCards);

    // Initialize History with loaded cards once
    useEffect(() => {
        if (!loading && cards.length > 0 && HistoryService.pointer < 0) {
            HistoryService.init(cards);
        }
    }, [loading, cards]);

    // Undo-Aware Handlers
    const handleRemoveWithUndo = async (cardId, cardName) => {
        const prevCards = [...cards];
        const cardToRemove = cards.find(c => c.id === cardId || c.firestoreId === cardId);

        if (!cardToRemove) return;

        const newCards = cards.filter(c => c.id !== cardId && c.firestoreId !== cardId);

        // Optimistic UI Update
        setCards(newCards);

        // API Call
        try {
            // We use direct API to avoid full refresh, but removeCard hook wrapper might call refresh().
            // Since we exposed setCards, we can manage state manually.
            await api.delete(`/ api / collection / ${cardId} `);
        } catch (err) {
            console.error(err);
            setCards(prevCards); // Revert
            addToast("Failed to delete card", "error");
            return;
        }

        // Record History with Command Pattern (Inverse Actions)
        recordAction(
            `Deleted ${cardName} `,
            newCards,
            async () => { // Undo: Add Back
                try {
                    await collectionService.addCardToCollection(
                        userProfile.uid,
                        cardToRemove,
                        cardToRemove.count || 1,
                        cardToRemove.finish,
                        cardToRemove.is_wishlist
                    );
                    // Note: We don't need to manually setCards here because HistoryService.undo() returns the old state 
                    // and useUndo calls setCards(oldState). 
                    // HOWEVER, the new card from API has a NEW ID. The old state has OLD ID.
                    // This creates a divergence. Next refresh fixes it. 
                    // Ideally we should replace the old ID in the restored state with the new ID, 
                    // but we can't easily modify the history snapshot.
                    // For now, allow divergence (Risk: Redo will fail if ID mismatch).
                } catch (e) {
                    console.error("Undo Add failed", e);
                }
            },
            async () => { // Redo: Delete Again
                // We typically use the ID from the state. 
                // If ID changed during Undo-Add, Redo-Delete will fail.
                // Best effort.
                try {
                    await api.delete(`/ api / collection / ${cardId} `);
                } catch (e) {
                    console.error("Redo Delete failed", e);
                }
            }
        );

        addToast(`Deleted ${cardName} `, 'success', 3000, { label: 'Undo', onClick: () => HistoryService.undo() });
    };

    const handleAddWithUndo = async (newCardData) => {
        // newCardData comes from CardSearchModal (optimistic or after API?)
        // Usually CardSearchModal calls API then tells us.
        // So this is AFTER API.
        // We just need to update UI and History.

        const prevCards = [...cards];
        const newCards = [...cards, newCardData];
        setCards(newCards);

        recordAction(
            `Added ${newCardData.name} `,
            newCards,
            async () => { // Undo: Remove newly added card
                await api.delete(`/api/collection/${newCardData.firestoreId || newCardData.id}`);
            },
            async () => { // Redo: Add back
                await collectionService.addCardToCollection(
                    userProfile.uid,
                    newCardData,
                    newCardData.count,
                    newCardData.finish,
                    newCardData.is_wishlist
                );
            }
        );
    };

    const handleSyncPrices = async () => {
        setSyncLoading(true);
        try {
            await api.post('/api/sync/prices');
            await refresh();
        } catch (err) {
            console.error("Sync failed", err);
        } finally {
            setSyncLoading(false);
        }
    };

    // View States (Persisted)
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('collection_viewMode') || 'grid');
    const [groupingMode, setGroupingMode] = useState(() => localStorage.getItem('collection_groupingMode') || 'binders'); // 'smart' | 'custom' | 'binders'
    const [activeFolder, setActiveFolder] = useState(null); // ID of open folder
    const [binderCards, setBinderCards] = useState([]);
    const [binderLoading, setBinderLoading] = useState(false);

    // Modals
    const [isAddCardOpen, setIsAddCardOpen] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isOrganizationWizardOpen, setIsOrganizationWizardOpen] = useState(false);
    const [isForgeLensOpen, setIsForgeLensOpen] = useState(false);
    const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
    const [isToolsMenuLocked, setIsToolsMenuLocked] = useState(false);
    const toolsMenuRef = useRef(null);
    const toolsMenuTimeoutRef = useRef(null);
    const [editingBinder, setEditingBinder] = useState(null);

    // Filter State (Persisted)
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('collection_filters');
        return saved ? JSON.parse(saved) : {
            colors: [],
            rarity: [],
            types: [],
            sets: [],
            decks: [],
            users: []
        };
    });

    const [sortBy, setSortBy] = useState(() => localStorage.getItem('collection_sortBy') || 'added_at');
    const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('collection_sortOrder') || 'desc');

    // Pagination State (Grid View Only)
    const [currentPage, setCurrentPage] = useState(() => parseInt(localStorage.getItem('collection_currentPage')) || 1);
    const [itemsPerPage, setItemsPerPage] = useState(() => parseInt(localStorage.getItem('collection_itemsPerPage')) || 50);

    // Persistence Effects
    React.useEffect(() => {
        localStorage.setItem('collection_viewMode', viewMode);
    }, [viewMode]);

    React.useEffect(() => {
        localStorage.setItem('collection_groupingMode', groupingMode);
    }, [groupingMode]);

    React.useEffect(() => {
        localStorage.setItem('collection_filters', JSON.stringify(filters));
    }, [filters]);

    React.useEffect(() => {
        localStorage.setItem('collection_sortBy', sortBy);
        localStorage.setItem('collection_sortOrder', sortOrder);
    }, [sortBy, sortOrder]);

    React.useEffect(() => {
        localStorage.setItem('collection_currentPage', currentPage);
        localStorage.setItem('collection_itemsPerPage', itemsPerPage);
    }, [currentPage, itemsPerPage]);

    // Reset to page 1 when filters, search, or sort changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filters, sortBy, sortOrder]);

    // Handle outside clicks for Tools menu
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

    // Fetch binder cards when activeFolder changes to a binder
    useEffect(() => {
        if (activeFolder && activeFolder.startsWith('binder-')) {
            const binderId = activeFolder.replace('binder-', '');
            setBinderLoading(true);
            api.getBinderCards(binderId)
                .then(response => setBinderCards(response))
                .catch(err => addToast('Failed to load binder cards', 'error'))
                .finally(() => setBinderLoading(false));
        } else {
            setBinderCards([]);
        }
    }, [activeFolder, addToast]);

    // Derived Options
    const setOptions = useMemo(() => {
        const sets = new Set();
        if (!Array.isArray(cards)) return [];
        cards.forEach(c => {
            if (c.set && c.set_name) {
                sets.add(JSON.stringify({ value: c.set, label: c.set_name }));
            }
        });
        return Array.from(sets).map(s => JSON.parse(s)).sort((a, b) => a.label.localeCompare(b.label));
    }, [cards]);

    const userOptions = useMemo(() => {
        return sharedSources.map(s => ({ value: s.id, label: s.name }));
    }, [sharedSources]);

    const deckOptions = useMemo(() => {
        return decks.map(d => ({ value: d.id, label: d.name }));
    }, [decks]);

    // Advanced Sorting Internal Comparator
    const compareCards = (a, b, criterion) => {
        switch (criterion) {
            case 'color':
            case 'color_identity': {
                // W U B R G M C
                const wubrgOrder = { 'W': 0, 'U': 1, 'B': 2, 'R': 3, 'G': 4 };

                const getSortKey = (card) => {
                    let colors = card.color_identity || [];
                    if (typeof colors === 'string') try { colors = JSON.parse(colors); } catch (e) { }
                    if (colors.length === 0) return 6; // Colorless
                    if (colors.length > 1) return 5; // Multicolor
                    return wubrgOrder[colors[0]] ?? 7;
                };
                return getSortKey(a) - getSortKey(b);
            }
            case 'type': {
                const typePriority = {
                    'Creature': 0,
                    'Instant': 1,
                    'Sorcery': 2,
                    'Enchantment': 3,
                    'Artifact': 4,
                    'Planeswalker': 5,
                    'Land': 6
                };
                const getTypeRank = (card) => {
                    const line = card.type_line || '';
                    for (const [t, rank] of Object.entries(typePriority)) {
                        if (line.includes(t)) return rank;
                    }
                    return 7;
                };
                return getTypeRank(a) - getTypeRank(b);
            }
            case 'cmc':
                return (parseFloat(a.cmc) || 0) - (parseFloat(b.cmc) || 0);
            case 'price':
                return (parseFloat(a.prices?.usd || 0) - parseFloat(b.prices?.usd || 0));
            case 'collector_number': {
                // Handle "123a" strings
                const numA = parseInt(a.collector_number || 0);
                const numB = parseInt(b.collector_number || 0);
                return numA - numB;
            }
            case 'set':
                // Simple atomic compare. Ideally we'd have release date map.
                return (a.set || '').localeCompare(b.set || '');
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'power':
                return (parseFloat(a.power) || 0) - (parseFloat(b.power) || 0);
            case 'toughness':
                return (parseFloat(a.toughness) || 0) - (parseFloat(b.toughness) || 0);
            case 'artist':
                return (a.artist || '').localeCompare(b.artist || '');
            default:
                return 0;
        }
    };

    // Filtered & Sorted Cards
    const filteredCards = useMemo(() => {
        if (!Array.isArray(cards)) return [];
        let result = cards.filter(card => {
            // Search Term
            const name = card.name || '';
            if (debouncedSearchTerm && !name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) return false;

            // Colors
            if (filters.colors.length > 0) {
                const cardColors = card.color_identity || [];
                const isMulti = cardColors.length > 1;
                const isColorless = cardColors.length === 0;

                const matchesColor = filters.colors.some(filterColor => {
                    if (filterColor === 'C') return isColorless;
                    if (filterColor === 'M') return isMulti;
                    return cardColors.includes(filterColor);
                });

                if (!matchesColor) return false;
            }

            // Rarity
            if (filters.rarity.length > 0) {
                if (!filters.rarity.includes(card.rarity)) return false;
            }

            // Types
            if (filters.types.length > 0) {
                const typeLine = (card.type_line || '').toLowerCase();
                const matchesType = filters.types.some(t => typeLine.includes(t.toLowerCase()));
                if (!matchesType) return false;
            }

            // Sets
            if (filters.sets.length > 0) {
                if (!filters.sets.includes(card.set)) return false;
            }

            // Decks
            if (filters.decks.length > 0) {
                if (!filters.decks.includes(card.deckId)) return false;
            }

            // Users
            if (filters.users && filters.users.length > 0) {
                if (!filters.users.includes(card.user_id) && !filters.users.includes(card.owner_id)) return false;
            }

            return true;
        });

        return result.sort((a, b) => {
            // Priority 1: User Defined Hierarchy (from Settings)
            const userHierarchy = userProfile?.settings?.organization?.sortHierarchy;

            // If user has advanced sorting set, use it
            if (userHierarchy && Array.isArray(userHierarchy) && userHierarchy.length > 0) {
                for (const criterion of userHierarchy) {
                    const diff = compareCards(a, b, criterion);
                    if (diff !== 0) return diff;
                }
                // Fallback to name if equal
                return compareCards(a, b, 'name');
            }

            // Priority 2: Standard UI Sort Controls (Legacy)
            if (sortBy === 'added_at') {
                const valA = new Date(a.added_at || 0).getTime();
                const valB = new Date(b.added_at || 0).getTime();
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }

            // Map UI sortBy to our comparator keys for consistency 
            let criterion = sortBy;
            if (sortBy === 'owner') return (a.owner_username || 'ME').localeCompare(b.owner_username || 'ME');

            const diff = compareCards(a, b, criterion);
            return sortOrder === 'asc' ? diff : -diff;
        });
    }, [cards, debouncedSearchTerm, filters, sortBy, sortOrder, userProfile]);


    // Grouping Logic
    const groups = useMemo(() => {
        if (!Array.isArray(cards)) return [];
        if (viewMode !== 'folder') return []; // Only compute if in folder mode

        if (groupingMode === 'custom') {
            const tagGroups = {};
            const unsorted = [];

            filteredCards.forEach(card => {
                const tags = typeof card.tags === 'string' ? JSON.parse(card.tags) : (card.tags || []);
                if (tags.length === 0) {
                    unsorted.push(card);
                } else {
                    tags.forEach(tag => {
                        if (!tagGroups[tag]) tagGroups[tag] = [];
                        tagGroups[tag].push(card);
                    });
                }
            });

            const result = Object.entries(tagGroups).map(([tag, cards]) => ({
                id: `tag - ${tag} `,
                label: tag,
                type: 'tag',
                cards: cards,
                icon: '🏷️',
                color: 'indigo'
            }));

            if (unsorted.length > 0) {
                result.push({
                    id: 'unsorted',
                    label: 'Unsorted',
                    type: 'tag',
                    cards: unsorted,
                    icon: '📦',
                    color: 'gray'
                });
            }
            return result.sort((a, b) => a.label.localeCompare(b.label));
        }

        // Smart Mode: Decks + User Selected Preference
        if (groupingMode === 'smart') {
            const result = [];
            const deckGroups = {};

            // 1. Always Group by Deck first
            filteredCards.forEach(card => {
                if (card.deck_id) {
                    const deckName = decks.find(d => d.id === card.deck_id)?.name || 'Unknown Deck';
                    if (!deckGroups[deckName]) deckGroups[deckName] = [];
                    deckGroups[deckName].push(card);
                }
            });

            // Push Decks
            Object.entries(deckGroups).forEach(([name, cards]) => {
                const ownerName = isMixedView && cards[0]?.owner_username ? cards[0].owner_username : null;
                result.push({
                    id: `deck - ${name} `,
                    label: name,
                    type: 'deck',
                    cards,
                    icon: '♟️',
                    color: 'purple',
                    sub: 'Deck',
                    ownerName
                });
            });

            // 2. Determine Secondary Grouping (from User Settings)
            const pref = userProfile?.settings?.organization?.groupingPreference || 'color';
            const dynamicGroups = {};

            filteredCards.forEach(card => {
                // Skip cards that are already in decks? 
                // Usually Smart View shows deck cards in Deck folders, and non-deck cards in attribute folders?
                // Or duplicates them? The original logic verified:
                // Original logic: "if (card.deck_id) --> deckGroup; and INDEPENDENTLY 'By Color' --> colorGroup"
                // So cards appeared in BOTH Deck folder and Color folder?
                // Looking at old code: yes, it ran sequentially. So a card in a deck was ALSO counted in colorGroups.
                // We will maintain this behavior as it allows browsing by trait even if deck-bound.

                let key = 'Other';
                let label = 'Other';
                let sortValue = 0;
                let meta = {};

                if (pref === 'set') {
                    key = card.set || 'unknown';
                    label = card.set_name || 'Unknown Set';
                    sortValue = card.released_at ? new Date(card.released_at).getTime() : 0;
                    meta = { icon: '📦', color: 'blue' };
                }
                else if (pref === 'type') {
                    // Simple Type Grouping (Main type)
                    const types = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];
                    const line = card.type_line || '';
                    const mainType = types.find(t => line.includes(t)) || 'Other';
                    key = mainType;
                    label = mainType;
                    meta = { icon: '🃏', color: 'emerald' };
                }
                else if (pref === 'rarity') {
                    key = card.rarity || 'common';
                    label = key.charAt(0).toUpperCase() + key.slice(1);
                    const rOrder = { 'common': 0, 'uncommon': 1, 'rare': 2, 'mythic': 3 };
                    sortValue = rOrder[key] || 0;
                    meta = { icon: '💎', color: 'yellow' };
                }
                else {
                    // Default: Color Grouping
                    let colors = card.color_identity;
                    if (typeof colors === 'string') try { colors = JSON.parse(colors); } catch (e) { colors = []; }
                    if (!Array.isArray(colors)) colors = [];

                    const wubrgOrder = { 'W': 0, 'U': 1, 'B': 2, 'R': 3, 'G': 4 };
                    const validColors = colors.filter(c => wubrgOrder[c] !== undefined);
                    const sortedKey = validColors.sort((a, b) => wubrgOrder[a] - wubrgOrder[b]).join('');

                    key = sortedKey.length === 0 ? 'C' : sortedKey;
                    const identity = getIdentity(key);
                    label = identity.name;
                    sortValue = key === 'C' ? -1 : key.length; // Colorless first or last?
                    meta = {
                        icon: '🎨',
                        color: identity.bg?.replace('bg-', '')?.split(' ')[0] || 'blue',
                        pips: identity.pips,
                        flavor: identity.flavor,
                        theme: identity.theme
                    };
                }

                if (!dynamicGroups[key]) dynamicGroups[key] = { label, cards: [], sortValue, ...meta };
                dynamicGroups[key].cards.push(card);
            });

            // Convert dynamicGroups to result array
            const dynamicResult = Object.entries(dynamicGroups).map(([k, g]) => ({
                id: `group - ${k} `,
                label: g.label,
                type: pref,
                cards: g.cards,
                icon: g.icon,
                color: g.color || 'gray',
                sub: pref.charAt(0).toUpperCase() + pref.slice(1),
                pips: g.pips,
                flavor: g.flavor,
                theme: g.theme,
                sortValue: g.sortValue
            }));

            // Sort dynamic groups
            dynamicResult.sort((a, b) => {
                // Custom sorts per type
                if (pref === 'rarity') return b.sortValue - a.sortValue; // Mythic first?
                if (pref === 'set') return b.sortValue - a.sortValue; // Newest sets first
                if (pref === 'color') {
                    // Sort logic from original: Count then Identity Name
                    const countA = a.id.replace('group-', '').length; // approximation
                    // Actually better to rely on sortValue if we set it correctly, strictly speaking WUBRG order is nice.
                    // Let's stick to localeCompare of label for simple types, or special logic for colors.
                    if (a.theme && b.theme) return a.label.localeCompare(b.label);
                    return 0; // fallback
                }
                return a.label.localeCompare(b.label);
            });

            return [...result, ...dynamicResult];
        }

        // Binder Mode (User Binders)
        if (groupingMode === 'binders') {
            return binders.map(b => {
                const binderRules = b.rules ? (typeof b.rules === 'string' ? JSON.parse(b.rules) : b.rules) : null;
                const binderCardsList = binderRules
                    ? cards.filter(c => evaluateRules(c, binderRules))
                    : cards.filter(c => String(c.binder_id) === String(b.id));

                return {
                    id: `binder - ${b.id} `,
                    label: b.name,
                    type: 'binder',
                    cards: binderCardsList,
                    icon: b.icon_value || '📁',
                    color: b.color_preference || 'blue',
                    sub: binderRules ? 'Smart Binder' : 'Collection Binder',
                    isSmart: !!binderRules
                };
            });
        }

        return [];

    }, [filteredCards, groupingMode, viewMode, decks, binders, cards, userProfile, debouncedSearchTerm]);

    // Helpers
    const toggleFilter = (category, value) => {
        setFilters(prev => {
            const current = prev[category];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];
            return { ...prev, [category]: updated };
        });
    };

    // Active Folder Logic
    const activeGroup = useMemo(() => {
        const group = groups.find(g => g.id === activeFolder);
        if (group && group.type === 'binder') {
            return { ...group, cards: binderCards };
        }
        return group;
    }, [groups, activeFolder, binderCards]);

    // Pagination Logic (Grid View Only)
    const paginatedCards = useMemo(() => {
        if (viewMode !== 'grid') return filteredCards;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredCards.slice(startIndex, endIndex);
    }, [filteredCards, currentPage, itemsPerPage, viewMode]);

    const totalPages = useMemo(() => {
        if (viewMode !== 'grid') return 1;
        return Math.ceil(filteredCards.length / itemsPerPage);
    }, [filteredCards.length, itemsPerPage, viewMode]);

    // Verify View Permissions on Load
    useEffect(() => {
        const canAccessBinders = getTierConfig(userProfile?.subscription_tier).features.binders;
        // If in folder view, grouping by binders, and not allowed -> force grid
        if (viewMode === 'folder' && groupingMode === 'binders' && !canAccessBinders) {
            setViewMode('grid');
        }
    }, [userProfile, viewMode, groupingMode]);

    return (
        <div className="relative min-h-screen overflow-x-hidden">
            {/* Immersive Background */}
            <div
                className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000"
                style={{ backgroundImage: 'url(/MTG-Forge_Logo_Background.png)' }}
            >
                <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" />
            </div>

            <div className="relative z-10 max-w-[1600px] mx-auto px-4 md:px-6 py-8 space-y-8 animate-fade-in pb-24">

                {/* Header Section */}
                <div className="relative z-50 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gray-950/40 p-4 md:p-6 rounded-3xl backdrop-blur-md border border-white/5 shadow-xl">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight mb-1 md:mb-2">
                            {isWishlistMode ? 'My Wishlist' : 'My Collection'}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-gray-400 font-medium text-xs md:text-sm">
                                {filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'} found • <span className="text-indigo-400">${filteredCards.reduce((acc, c) => acc + (parseFloat(c.prices?.usd || 0) * (c.count || 1)), 0).toFixed(2)}</span>
                            </p>
                            {!canUndo && !canRedo ? (
                                <button
                                    onClick={handleSyncPrices}
                                    disabled={syncLoading}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/20 ${syncLoading ? 'opacity-70 cursor-wait' : ''}`}
                                    title="Update prices from Scryfall"
                                >
                                    <svg className={`w-3 h-3 ${syncLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    {syncLoading ? 'Syncing...' : 'Sync Prices'}
                                </button>
                            ) : (
                                <div className="flex items-stretch bg-indigo-500/10 rounded-full border border-indigo-500/20 overflow-hidden">
                                    <button
                                        onClick={handleSyncPrices}
                                        disabled={syncLoading}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/10 transition-colors ${syncLoading ? 'opacity-70 cursor-wait' : ''}`}
                                        title="Update prices from Scryfall"
                                    >
                                        <svg className={`w-3 h-3 ${syncLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        {syncLoading ? 'Syncing...' : 'Sync Prices'}
                                    </button>

                                    <div className="w-px h-3 bg-indigo-500/20 self-center"></div>

                                    <div className="flex items-stretch">
                                        <button
                                            onClick={undo}
                                            disabled={!canUndo}
                                            className="px-2 flex items-center justify-center hover:bg-indigo-500/10 text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Undo (Ctrl+Z)"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                        </button>
                                        <div className="w-px h-3 bg-indigo-500/20 self-center"></div>
                                        <button
                                            onClick={redo}
                                            disabled={!canRedo}
                                            className="px-2 flex items-center justify-center hover:bg-indigo-500/10 text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Redo (Ctrl+Shift+Z)"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 md:gap-3 w-full md:w-auto items-center justify-between md:justify-end">
                        <ViewToggle
                            mode={viewMode}
                            onChange={(m) => {
                                setViewMode(m);
                                setActiveFolder(null);
                                // If switching to folder and binders restricted, default to smart
                                if (m === 'folder') {
                                    const canAccess = getTierConfig(userProfile?.subscription_tier).features.binders;
                                    if (!canAccess) {
                                        setGroupingMode('smart');
                                    }
                                }
                            }}
                        />

                        {!isSharedView && (
                            <>
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
                                            : 'bg-gray-900 border-white/10 text-gray-400 hover:text-white hover:border-indigo-500/50 hover:bg-gray-800'
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
                                        <div className="absolute right-0 top-full mt-3 w-72 md:w-80 bg-gray-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                            <div className="p-4 space-y-6">
                                                {/* Section: Adding */}
                                                <div className="space-y-2">
                                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Adding Cards</h3>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={() => { setIsAddCardOpen(true); setIsToolsMenuOpen(false); }}
                                                            className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-indigo-500/20 rounded-xl border border-white/5 transition-all group"
                                                        >
                                                            <svg className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                            <span className="text-[10px] font-bold text-gray-300">Manual Add</span>
                                                        </button>

                                                        <button
                                                            onClick={() => { setIsForgeLensOpen(true); setIsToolsMenuOpen(false); }}
                                                            className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-indigo-500/20 rounded-xl border border-white/5 transition-all group lg:min-h-[64px]"
                                                        >
                                                            <svg className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                                            <span className="text-[10px] font-bold text-gray-300">Forge Lens</span>
                                                        </button>

                                                        <button
                                                            onClick={() => { setIsBulkImportOpen(true); setIsToolsMenuOpen(false); }}
                                                            className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-gray-800 rounded-xl border border-white/5 transition-all group col-span-2"
                                                        >
                                                            <svg className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                            <span className="text-[10px] font-bold text-gray-300">Bulk Paste / Import</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Section: Management */}
                                                <div className="space-y-2">
                                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Management</h3>
                                                    <div className="bg-white/5 rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                                                        <button
                                                            onClick={() => {
                                                                const allowed = getTierConfig(userProfile?.subscription_tier).features.binders;
                                                                if (!allowed) {
                                                                    addToast('Custom Binders are available on Wizard tier and above.', 'info');
                                                                    return;
                                                                }
                                                                setIsWizardOpen(true);
                                                                setIsToolsMenuOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-3 text-xs flex items-center justify-between transition-colors group ${getTierConfig(userProfile?.subscription_tier).features.binders ? 'hover:bg-indigo-500/10' : 'opacity-40 cursor-not-allowed'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                <span className="font-bold text-gray-300">New Binder</span>
                                                            </div>
                                                            {!getTierConfig(userProfile?.subscription_tier).features.binders && <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded leading-none">WIZARD</span>}
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                const allowed = getTierConfig(userProfile?.subscription_tier).features.collectionAudit;
                                                                if (!allowed) {
                                                                    addToast('Collection Organization tools are available on Wizard tier.', 'info');
                                                                    return;
                                                                }
                                                                setIsOrganizationWizardOpen(true);
                                                                setIsToolsMenuOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-3 text-xs flex items-center justify-between transition-colors group ${getTierConfig(userProfile?.subscription_tier).features.collectionAudit ? 'hover:bg-purple-500/10' : 'opacity-40 cursor-not-allowed'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                                                                <span className="font-bold text-gray-300">Organize Collection</span>
                                                            </div>
                                                            {!getTierConfig(userProfile?.subscription_tier).features.collectionAudit && <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded leading-none">WIZARD</span>}
                                                        </button>

                                                        <button
                                                            onClick={() => { setIsGuideOpen(true); setIsToolsMenuOpen(false); }}
                                                            className="w-full text-left px-4 py-3 text-xs flex items-center gap-3 hover:bg-gray-800 transition-colors"
                                                        >
                                                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            <span className="font-bold text-gray-300">Binder Guide</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center backdrop-blur-md">
                        <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <h3 className="text-xl font-bold text-white mb-2">Failed to load collection</h3>
                        <p className="text-red-200 mb-6">{error.message || 'Something went wrong while fetching your cards.'}</p>
                        <button
                            onClick={() => refresh()}
                            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Filters & Grid Container */}
                <div className="bg-gray-950/40 border border-white/5 rounded-3xl p-4 md:p-6 backdrop-blur-md shadow-2xl">

                    {/* Search & Toggle Filters */}
                    <div className="flex flex-col lg:flex-row gap-3 md:gap-4 mb-6 justify-between">
                        <div className="flex gap-2 flex-wrap flex-1">
                            <div className="relative flex-1 min-w-[200px]">
                                <input
                                    type="text"
                                    placeholder="Search cards..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-700 text-white px-4 py-2.5 md:py-3 pl-10 md:pl-12 pr-10 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-500 font-medium text-sm h-10 md:h-12"
                                />
                                <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400 absolute left-3 md:left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>

                            <select
                                value={selectedSource}
                                onChange={(e) => {
                                    setSelectedSource(e.target.value);
                                    setActiveFolder(null); // Reset folder when switching source
                                }}
                                className="bg-gray-800 border-gray-700 text-white px-3 py-2 md:px-4 md:py-3 rounded-xl font-bold text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 whitespace-nowrap h-10 md:h-12"
                            >
                                <option value="me">My Collection</option>
                                <option value="all">All Linked Collections</option>
                                {sharedSources.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}'s Collection</option>
                                ))}
                            </select>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-gray-800 border-gray-700 text-white px-3 py-2 md:px-4 md:py-3 rounded-xl font-bold text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 h-10 md:h-12"
                            >
                                <option value="added_at">Date Added</option>
                                <option value="name">Name</option>
                                <option value="price">Price</option>
                                {isMixedView && <option value="owner">Owner</option>}
                            </select>

                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="bg-gray-800 border border-gray-700 text-gray-400 hover:text-white px-3 py-2 md:px-4 md:py-3 rounded-xl transition-all h-10 md:h-12"
                                title={`Sort Order: ${sortOrder.toUpperCase()} `}
                            >
                                {sortOrder === 'asc' ? (
                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
                                ) : (
                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                                )}
                            </button>

                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-4 py-2 md:px-5 md:py-3 rounded-xl border font-bold text-xs md:text-sm flex items-center gap-2 transition-all h-10 md:h-12 ${showFilters
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                <span className="hidden sm:inline">Filters</span>
                            </button>
                        </div>

                        {/* Grouping Toggle (Only in Folder View) */}
                        {viewMode === 'folder' && !activeFolder && (
                            <div className="flex gap-2">
                                <div className="bg-gray-900 border border-gray-700 p-1 rounded-xl flex self-start overflow-hidden">
                                    <button
                                        onClick={() => {
                                            const allowed = getTierConfig(userProfile?.subscription_tier).features.binders;
                                            if (!allowed) {
                                                addToast(`Custom Binders are available on ${TIER_CONFIG[TIERS.TIER_2].name} tier.`, 'info');
                                                return;
                                            }
                                            setGroupingMode('binders');
                                        }}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${groupingMode === 'binders'
                                            ? 'bg-indigo-600 text-white'
                                            : getTierConfig(userProfile?.subscription_tier).features.binders
                                                ? 'text-gray-500 hover:text-gray-300'
                                                : 'text-gray-600 cursor-not-allowed opacity-60'
                                            }`}
                                    >
                                        Binders
                                        {!getTierConfig(userProfile?.subscription_tier).features.binders && (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setGroupingMode('smart')}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupingMode === 'smart' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Smart
                                    </button>
                                    <button
                                        onClick={() => setGroupingMode('custom')}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupingMode === 'custom' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Tags
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Expandable Filter Panel */}
                    {showFilters && (
                        <div className="mb-8 p-6 bg-gray-900/50 rounded-2xl border border-gray-800 space-y-6 animate-fade-in-down">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                {/* Colors */}
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Colors</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['W', 'U', 'B', 'R', 'G', 'C', 'M'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => toggleFilter('colors', color)}
                                                className={`
w-8 h-8 rounded-full border flex items-center justify-center transition-all transform hover:scale-110
                                                    ${filters.colors.includes(color) ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900 shadow-lg scale-110' : 'opacity-60 hover:opacity-100'}
                                                    ${color === 'W' ? 'bg-[#F9FAFB] text-gray-900 border-gray-300' : ''}
                                                    ${color === 'U' ? 'bg-[#3B82F6] text-white border-blue-600' : ''}
                                                    ${color === 'B' ? 'bg-[#1F2937] text-white border-gray-600' : ''}
                                                    ${color === 'R' ? 'bg-[#EF4444] text-white border-red-600' : ''}
                                                    ${color === 'G' ? 'bg-[#10B981] text-white border-green-600' : ''}
                                                    ${color === 'C' ? 'bg-gray-400 text-gray-900 border-gray-500' : ''}
                                                    ${color === 'M' ? 'bg-gradient-to-br from-yellow-400 via-red-500 to-purple-600 text-white border-purple-500' : ''}
`}
                                                title={color === 'C' ? 'Colorless' : color === 'M' ? 'Multicolor' : color}
                                            >
                                                {color !== 'M' && color !== 'C' && (
                                                    <img src={`https://svgs.scryfall.io/card-symbols/${color}.svg`} alt={color} className="w-4 h-4" />
                                                )}
                                                {color === 'M' && <span className="font-bold text-xs">M</span>}
                                                {color === 'C' && <span className="font-bold text-xs">C</span>}
                                            </button >
                                        ))}
                                    </div >
                                </div >

                                {/* Rarity */}
                                < div className="col-span-1" >
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Rarity</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['common', 'uncommon', 'rare', 'mythic'].map(rarity => (
                                            <button
                                                key={rarity}
                                                onClick={() => toggleFilter('rarity', rarity)}
                                                className={`
                                                    px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all hover:-translate-y-0.5
                                                    ${filters.rarity.includes(rarity)
                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}
                                                `}
                                            >
                                                {rarity}
                                            </button>
                                        ))}
                                    </div>
                                </div >

                                {/* Types */}
                                < div className="col-span-1" >
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Types</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => toggleFilter('types', type)}
                                                className={`
                                                     px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all hover:-translate-y-0.5
                                                     ${filters.types.includes(type)
                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}
                                                 `}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div >

                                {/* Sets & Decks (MultiSelects) */}
                                < div className="col-span-1 space-y-4" >
                                    <MultiSelect
                                        label="Sets"
                                        options={setOptions}
                                        selected={filters.sets}
                                        onChange={(vals) => setFilters({ ...filters, sets: vals })}
                                    />
                                    {
                                        isMixedView && (
                                            <MultiSelect
                                                label="Card Owner"
                                                options={userOptions}
                                                selected={filters.users}
                                                onChange={(vals) => setFilters({ ...filters, users: vals })}
                                            />
                                        )
                                    }
                                    <MultiSelect
                                        label="Filter by Deck"
                                        options={deckOptions}
                                        selected={filters.decks}
                                        onChange={(val) => setFilters(prev => ({ ...prev, decks: val }))}
                                        placeholder="All Decks"
                                    />
                                </div >
                            </div >
                        </div >
                    )}

                    {
                        error ? (
                            <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-8 rounded-2xl text-center">
                                <h3 className="text-xl font-bold mb-2">Error Loading Collection</h3>
                                <p>{error.message}</p>
                            </div>
                        ) : (
                            <>
                                {/* FOLDER VIEW */}
                                {viewMode === 'folder' && !activeGroup && (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 animate-fade-in">
                                        {groups.map(group => (
                                            <div
                                                key={group.id}
                                                onClick={() => setActiveFolder(group.id)}
                                                className="bg-gray-900/40 hover:bg-gray-800/60 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-4 md:p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl group flex flex-col items-center text-center gap-2 md:gap-3 backdrop-blur-sm relative overflow-hidden"
                                            >
                                                {/* Background Glow */}
                                                <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${group.color}-500/10 rounded-full blur-3xl`} />

                                                <div className="flex gap-1 mb-1 md:mb-2 group-hover:scale-110 transition-transform">
                                                    {group.pips ? (
                                                        group.pips.map((pip, i) => (
                                                            <img
                                                                key={i}
                                                                src={`https://svgs.scryfall.io/card-symbols/${pip}.svg`}
                                                                alt={pip}
                                                                className="w-6 h-6 md:w-8 md:h-8 drop-shadow-md transition-transform group-hover:scale-110"
                                                            />
                                                        ))
                                                    ) : group.icon && group.icon.startsWith('ms-') ? (
                                                        <div className={`w-10 h-10 md:w-12 md:h-12 bg-${group.color}-900/30 text-${group.color}-400 rounded-xl flex items-center justify-center text-xl md:text-2xl`}>
                                                            <i className={`ms ${group.icon} ms-cost`}></i>
                                                        </div>
                                                    ) : (
                                                        <div className={`w-10 h-10 md:w-12 md:h-12 bg-${group.color}-900/30 text-${group.color}-400 rounded-xl flex items-center justify-center text-xl md:text-2xl`}>
                                                            {group.icon}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="z-10 px-2 mt-4">
                                                    <div className="text-[10px] uppercase tracking-tighter text-indigo-400 font-black mb-1">{group.theme || group.sub}</div>
                                                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors leading-tight">{group.label}</h3>
                                                    {group.flavor && <p className="text-[10px] text-gray-500 italic mt-2 font-serif px-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">"{group.flavor}"</p>}
                                                    {group.ownerName && (
                                                        <div className="mt-2 inline-flex items-center gap-1 bg-gray-950/80 text-gray-300 text-[9px] font-bold px-2 py-1 rounded-full border border-white/10">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                                            {group.ownerName}
                                                        </div>
                                                    )}
                                                </div>

                                                <span className="mt-4 px-3 py-1 bg-black/30 rounded-full text-xs font-mono text-gray-400 border border-white/5">
                                                    {group.cards.length} cards
                                                </span>
                                            </div>
                                        ))}
                                        {groups.length === 0 && (
                                            <div className="col-span-full py-20 text-center text-gray-500 italic">
                                                No cards match your filter criteria.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ACTIVE FOLDER DETAIL */}
                                {viewMode === 'folder' && activeGroup && (
                                    <div className="animate-fade-in">
                                        <div className="flex items-center gap-4 mb-6">
                                            <button
                                                onClick={() => setActiveFolder(null)}
                                                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                            </button>
                                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                                {activeGroup.icon} {activeGroup.label}
                                            </h2>
                                            {activeGroup.type === 'binder' && (
                                                <button
                                                    onClick={() => {
                                                        const binder = binders.find(b => b.id === parseInt(activeFolder.replace('binder-', '')));
                                                        setEditingBinder(binder);
                                                        setIsWizardOpen(true);
                                                    }}
                                                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-indigo-400 hover:text-white transition-colors"
                                                    title="Edit Binder Rules"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                </button>
                                            )}
                                            {activeGroup.type === 'binder' && (
                                                <StartAuditButton
                                                    type="binder"
                                                    targetId={activeFolder.replace('binder-', '')}
                                                    label="Audit"
                                                    className="text-xs bg-gray-800 border-gray-700 hover:bg-gray-700 hover:text-white py-2"
                                                />
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                            {activeGroup.cards.map(card => (
                                                <div key={card.firestoreId || card.id} className="h-full">
                                                    <CardGridItem
                                                        card={card}
                                                        decks={decks}
                                                        currentUser={userProfile}
                                                        showOwnerTag={isMixedView}
                                                        onRemove={handleRemoveWithUndo}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* GRID VIEW */}
                                {viewMode === 'grid' && (
                                    <>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 animate-fade-in">
                                            {paginatedCards.map((card) => (
                                                <div key={card.firestoreId || card.id} className="h-full">
                                                    <CardGridItem
                                                        card={card}
                                                        decks={decks}
                                                        currentUser={userProfile}
                                                        showOwnerTag={isMixedView}
                                                        onRemove={handleRemoveWithUndo}
                                                    />
                                                </div>
                                            ))}
                                            {filteredCards.length === 0 && (
                                                <div className="col-span-full py-20 text-center text-gray-500 italic">
                                                    No cards found.
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* TABLE VIEW */}
                                {viewMode === 'table' && (
                                    <div className="animate-fade-in">
                                        <CollectionTable cards={filteredCards} isMixed={isMixedView} />
                                    </div>
                                )}
                            </>
                        )
                    }
                </div >
            </div >

            <CardSearchModal
                isOpen={isAddCardOpen}
                onClose={() => setIsAddCardOpen(false)}
                onAddCard={handleAddWithUndo}
                onOpenForgeLens={() => {
                    setIsAddCardOpen(false);
                    setIsForgeLensOpen(true);
                }}
            />
            <BulkCollectionImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
            />
            <BinderGuideModal
                isOpen={isGuideOpen}
                onClose={() => setIsGuideOpen(false)}
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
                            image_uri: item.data.image_uri || item.image || item.data.image_uris?.normal || item.data.card_faces?.[0]?.image_uris?.normal,
                            count: item.quantity,
                            data: item.data,
                            is_wishlist: item.is_wishlist,
                            finish: item.finish || 'nonfoil',
                            deck_id: targetDeckId || null,
                            tags: [] // Pass as array, backend handles stringification
                        }));

                        const apiMode = additionMode === 'transfer' ? 'transfer_to_deck' : 'merge';
                        await api.batchAddToCollection(payload, apiMode);

                        const destination = targetDeckId ? 'deck' : 'collection';
                        addToast(`Successfully ${additionMode === 'transfer' ? 'moved' : 'added'} ${scannedBatch.length} cards to ${destination}!`, 'success');
                        refresh();
                    } catch (err) {
                        console.error("Forge Lens Add Failed", err);
                        addToast("Failed to add scanned cards.", "error");
                    }
                }}
            />
            <BinderWizardModal
                isOpen={isWizardOpen}
                editingBinder={editingBinder}
                onClose={() => {
                    setIsWizardOpen(false);
                    setEditingBinder(null);
                    refreshBinders();
                    if (activeFolder && activeFolder.startsWith('binder-')) {
                        // Trigger re-fetch for current folder if it was edited
                        const binderId = activeFolder.replace('binder-', '');
                        setBinderLoading(true);
                        api.getBinderCards(binderId)
                            .then(setBinderCards)
                            .finally(() => setBinderLoading(false));
                    }
                }}
            />

            {/* Fixed Pagination Footer (Responsive, Grid View) */}
            {
                viewMode === 'grid' && filteredCards.length > 0 && (
                    <>
                        {/* Desktop Pagination Footer */}
                        <div className="hidden md:block fixed bottom-0 left-0 right-0 z-[55] bg-gray-950/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                            <div className="max-w-[1600px] mx-auto px-6 pr-24 py-4">
                                <div className="flex items-center justify-between gap-4">
                                    {/* Page Info */}
                                    <div className="text-sm text-gray-400 font-medium whitespace-nowrap">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredCards.length)} of {filteredCards.length} cards
                                    </div>

                                    {/* Page Navigation */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            title="First Page"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            title="Previous Page"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        </button>

                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                // Show pages around current page
                                                let pageNum;
                                                if (totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (currentPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (currentPage >= totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                } else {
                                                    pageNum = currentPage - 2 + i;
                                                }

                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className={`min-w-[2.5rem] px-3 py-2 rounded-lg font-bold text-sm transition-all ${currentPage === pageNum
                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                                            : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            title="Next Page"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            title="Last Page"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                        </button>
                                    </div>

                                    {/* Items Per Page Selector */}
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                        <label className="text-sm text-gray-400 font-medium">Per page:</label>
                                        <select
                                            value={itemsPerPage}
                                            onChange={(e) => {
                                                setItemsPerPage(parseInt(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                            <option value={200}>200</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Pagination Footer */}
                        <div className="md:hidden fixed bottom-16 left-0 right-0 z-[55] bg-gray-950/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                            <div className="px-4 pr-24 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    {/* Compact Page Info */}
                                    <div className="text-xs text-gray-400 font-medium">
                                        Page {currentPage} of {totalPages}
                                    </div>

                                    {/* Compact Navigation */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-2.5 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 active:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            title="Previous"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        </button>

                                        <div className="text-xs font-bold text-white bg-indigo-600 px-3 py-2 rounded-lg min-w-[3rem] text-center">
                                            {currentPage}
                                        </div>

                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-2.5 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 active:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            title="Next"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                    </div>

                                    {/* Compact Per Page Selector */}
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(parseInt(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-gray-800 border border-gray-700 text-white px-2 py-2 rounded-lg font-bold text-xs focus:outline-none"
                                    >
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                        <option value={200}>200</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }

            {/* Organization Wizard */}
            <OrganizationWizardModal
                isOpen={isOrganizationWizardOpen}
                onClose={() => setIsOrganizationWizardOpen(false)}
                onComplete={() => {
                    setIsOrganizationWizardOpen(false);
                    // Force refresh or just let state update do it (since we stick to filters)
                    window.location.reload(); // Simple reload to apply new sort settings fresh
                }}
            />
        </div >
    );
};

export default CollectionPage;
