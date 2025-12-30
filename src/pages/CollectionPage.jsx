import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';
import { useDecks } from '../hooks/useDecks';
import { getIdentity } from '../data/mtg_identity_registry';
import MultiSelect from '../components/MultiSelect';
import CardSkeleton from '../components/CardSkeleton';
import CardGridItem from '../components/common/CardGridItem';
import AddFromCollectionModal from '../components/modals/AddFromCollectionModal';
import CollectionTable from '../components/CollectionTable';
import ViewToggle from '../components/ViewToggle';
import BulkCollectionImportModal from '../components/modals/BulkCollectionImportModal';
import BinderWizardModal from '../components/modals/BinderWizardModal';

const CollectionPage = () => {
    // Parse query params for wishlist mode
    const location = useLocation();
    const isWishlistMode = new URLSearchParams(location.search).get('wishlist') === 'true';

    const { cards, loading, error } = useCollection({ wishlist: isWishlistMode });
    const { decks } = useDecks();
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // View States (Persisted)
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('collection_viewMode') || 'folder');
    const [groupingMode, setGroupingMode] = useState('smart'); // 'smart' | 'custom'
    const [activeFolder, setActiveFolder] = useState(null); // ID of open folder

    // Modals
    const [isAddCardOpen, setIsAddCardOpen] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [isBinderWizardOpen, setIsBinderWizardOpen] = useState(false);

    // Filter State (Persisted)
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('collection_filters');
        return saved ? JSON.parse(saved) : {
            colors: [],
            rarity: [],
            types: [],
            sets: [],
            decks: []
        };
    });

    // Persistence Effects
    React.useEffect(() => {
        localStorage.setItem('collection_viewMode', viewMode);
    }, [viewMode]);

    React.useEffect(() => {
        localStorage.setItem('collection_filters', JSON.stringify(filters));
    }, [filters]);

    // Derived Options
    const setOptions = useMemo(() => {
        const sets = new Set();
        cards.forEach(c => {
            if (c.set && c.set_name) {
                sets.add(JSON.stringify({ value: c.set, label: c.set_name }));
            }
        });
        return Array.from(sets).map(s => JSON.parse(s)).sort((a, b) => a.label.localeCompare(b.label));
    }, [cards]);

    const deckOptions = useMemo(() => {
        return decks.map(d => ({ value: d.id, label: d.name }));
    }, [decks]);

    // Filtering Logic (Applies to all cards initially)
    const filteredCards = useMemo(() => {
        return cards.filter(card => {
            // Search Term
            const name = card.name || '';
            if (searchTerm && !name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

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

            return true;
        });
    }, [cards, searchTerm, filters]);


    // Grouping Logic
    const groups = useMemo(() => {
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
                id: `tag-${tag}`,
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

        // Smart Mode: Sets, Decks, Colors
        const setGroups = {};
        const deckGroups = {};
        const colorGroups = {};

        filteredCards.forEach(card => {
            // By Set
            if (card.set_name) {
                if (!setGroups[card.set_name]) setGroups[card.set_name] = [];
                setGroups[card.set_name].push(card);
            }

            // By Deck
            if (card.deck_id) {
                const deckName = decks.find(d => d.id === card.deck_id)?.name || 'Unknown Deck';
                if (!deckGroups[deckName]) deckGroups[deckName] = [];
                deckGroups[deckName].push(card);
            }

            // By Color
            let colors = card.color_identity;
            if (typeof colors === 'string') {
                try { colors = JSON.parse(colors); } catch (e) { colors = []; }
            }
            if (!Array.isArray(colors)) colors = [];

            // Normalize: Filter valid colors, sort, and handle Colorless
            const wubrgOrder = { 'W': 0, 'U': 1, 'B': 2, 'R': 3, 'G': 4 };
            const validColors = colors.filter(c => wubrgOrder[c] !== undefined);

            const sortedKey = validColors
                .sort((a, b) => wubrgOrder[a] - wubrgOrder[b])
                .join('');

            const key = sortedKey.length === 0 ? 'C' : sortedKey;

            if (!colorGroups[key]) colorGroups[key] = [];
            colorGroups[key].push(card);
        });

        const result = [];

        // Push Decks first
        Object.entries(deckGroups).forEach(([name, cards]) => {
            result.push({ id: `deck-${name}`, label: name, type: 'deck', cards, icon: '♟️', color: 'purple', sub: 'Deck' });
        });

        // Push Colors (Sorted by color count, then name)
        Object.entries(colorGroups)
            .sort(([codeA], [codeB]) => {
                const countA = codeA === 'C' ? 0 : codeA.length;
                const countB = codeB === 'C' ? 0 : codeB.length;
                if (countA !== countB) return countA - countB;
                const identityA = getIdentity(codeA);
                const identityB = getIdentity(codeB);
                return (identityA.name || '').localeCompare(identityB.name || '');
            })
            .forEach(([code, cards]) => {
                if (cards.length > 0) {
                    const identity = getIdentity(code);
                    result.push({
                        id: `color-${code}`,
                        label: identity.name,
                        type: 'color',
                        cards,
                        icon: '🎨',
                        pips: identity.pips,
                        flavor: identity.flavor,
                        theme: identity.theme,
                        color: identity.bg?.replace('bg-', '')?.split(' ')[0] || 'blue',
                        sub: 'Color Identity'
                    });
                }
            });

        // Push Sets (Sorted alphabetically)
        Object.entries(setGroups)
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
            .forEach(([name, cards]) => {
                result.push({ id: `set-${name}`, label: name, type: 'set', cards, icon: '📦', color: 'emerald', sub: 'Set' });
            });

        return result;

    }, [filteredCards, groupingMode, viewMode, decks]);

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
        return groups.find(g => g.id === activeFolder);
    }, [groups, activeFolder]);

    return (
        <div className="relative min-h-screen">
            {/* Immersive Background */}
            <div
                className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000"
                style={{ backgroundImage: 'url(/MTG-Forge_Logo_Background.png)' }}
            >
                <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" />
            </div>

            <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-8 space-y-8 animate-fade-in pb-24">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-gray-950/40 p-6 rounded-3xl backdrop-blur-md border border-white/5 shadow-xl">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                            {isWishlistMode ? 'My Wishlist' : 'My Collection'}
                        </h1>
                        <p className="text-gray-400 font-medium">
                            {filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'} found • <span className="text-indigo-400">${filteredCards.reduce((acc, c) => acc + (parseFloat(c.prices?.usd || 0) * (c.count || 1)), 0).toFixed(2)}</span> total value
                        </p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto items-center">
                        <ViewToggle mode={viewMode} onChange={(m) => { setViewMode(m); setActiveFolder(null); }} />

                        <div className="h-8 w-px bg-gray-700 mx-2" />

                        <button
                            onClick={() => setIsBinderWizardOpen(true)}
                            className="bg-gray-800 hover:bg-gray-700 text-indigo-400 hover:text-white px-4 py-3 rounded-xl transition-all border border-gray-700 hover:border-indigo-500/50 flex items-center justify-center gap-2 group mr-2"
                            title="Create New Binder"
                        >
                            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="text-[10px] font-bold uppercase tracking-widest hidden xl:inline-block">New Binder</span>
                        </button>

                        <button
                            onClick={() => setIsBulkImportOpen(true)}
                            className="text-gray-400 hover:text-white font-bold py-3 px-4 rounded-xl hover:bg-gray-800 transition-all flex items-center gap-2 text-xs uppercase tracking-widest"
                            title="Bulk Paste"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </button>

                        <button
                            onClick={() => setIsAddCardOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Add Cards
                        </button>
                    </div>
                </div>

                {/* Filters & Grid Container */}
                <div className="bg-gray-950/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-2xl">

                    {/* Search & Toggle Filters */}
                    <div className="flex flex-col lg:flex-row gap-4 mb-6 justify-between">
                        <div className="flex gap-4 flex-1">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Search cards..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-700 text-white px-5 py-3 pl-12 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-500 font-medium"
                                />
                                <svg className="w-5 h-5 text-gray-500 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-5 py-3 rounded-xl border font-bold text-sm flex items-center gap-2 transition-all ${showFilters
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
                                    }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                Filters
                            </button>
                        </div>

                        {/* Grouping Toggle (Only in Folder View) */}
                        {viewMode === 'folder' && !activeFolder && (
                            <div className="bg-gray-900/50 p-1 rounded-xl flex border border-gray-700 self-start">
                                <button
                                    onClick={() => setGroupingMode('smart')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${groupingMode === 'smart' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Smart Groups
                                </button>
                                <button
                                    onClick={() => setGroupingMode('custom')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${groupingMode === 'custom' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                >
                                    My Tags
                                </button>
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
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Rarity */}
                                <div className="col-span-1">
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
                                </div>

                                {/* Types */}
                                <div className="col-span-1">
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
                                </div>

                                {/* Sets & Decks (MultiSelects) */}
                                <div className="col-span-1 space-y-4">
                                    <MultiSelect
                                        label="Filter by Set"
                                        options={setOptions}
                                        selected={filters.sets}
                                        onChange={(val) => setFilters(prev => ({ ...prev, sets: val }))}
                                        placeholder="All Sets"
                                    />
                                    <MultiSelect
                                        label="Filter by Deck"
                                        options={deckOptions}
                                        selected={filters.decks}
                                        onChange={(val) => setFilters(prev => ({ ...prev, decks: val }))}
                                        placeholder="All Decks"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <CardSkeleton key={i} />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-8 rounded-2xl text-center">
                            <h3 className="text-xl font-bold mb-2">Error Loading Collection</h3>
                            <p>{error.message}</p>
                        </div>
                    ) : (
                        <>
                            {/* FOLDER VIEW */}
                            {viewMode === 'folder' && !activeGroup && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
                                    {groups.map(group => (
                                        <div
                                            key={group.id}
                                            onClick={() => setActiveFolder(group.id)}
                                            className="bg-gray-900/40 hover:bg-gray-800/60 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl group flex flex-col items-center text-center gap-3 backdrop-blur-sm relative overflow-hidden"
                                        >
                                            {/* Background Glow */}
                                            <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${group.color}-500/10 rounded-full blur-3xl`} />

                                            <div className="flex gap-1 mb-2 group-hover:scale-110 transition-transform">
                                                {group.pips ? (
                                                    group.pips.map((pip, i) => (
                                                        <img
                                                            key={i}
                                                            src={`https://svgs.scryfall.io/card-symbols/${pip}.svg`}
                                                            alt={pip}
                                                            className="w-8 h-8 drop-shadow-md transition-transform group-hover:scale-110"
                                                        />
                                                    ))
                                                ) : (
                                                    <div className={`w-12 h-12 bg-${group.color}-900/30 text-${group.color}-400 rounded-xl flex items-center justify-center text-2xl`}>
                                                        {group.icon}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="z-10 px-2 mt-4">
                                                <div className="text-[10px] uppercase tracking-tighter text-indigo-400 font-black mb-1">{group.theme || group.sub}</div>
                                                <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors leading-tight">{group.label}</h3>
                                                {group.flavor && <p className="text-[10px] text-gray-500 italic mt-2 font-serif px-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">"{group.flavor}"</p>}
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
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                        {activeGroup.cards.map(card => (
                                            <div key={card.firestoreId || card.id} className="h-full">
                                                <CardGridItem card={card} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* GRID VIEW */}
                            {viewMode === 'grid' && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 animate-fade-in">
                                    {filteredCards.map((card) => (
                                        <div key={card.firestoreId || card.id} className="h-full">
                                            <CardGridItem card={card} />
                                        </div>
                                    ))}
                                    {filteredCards.length === 0 && (
                                        <div className="col-span-full py-20 text-center text-gray-500 italic">
                                            No cards found.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TABLE VIEW */}
                            {viewMode === 'table' && (
                                <div className="animate-fade-in">
                                    <CollectionTable cards={filteredCards} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <AddFromCollectionModal
                isOpen={isAddCardOpen}
                onClose={() => setIsAddCardOpen(false)}
            />
            <BulkCollectionImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
            />
            <BinderWizardModal
                isOpen={isBinderWizardOpen}
                onClose={() => setIsBinderWizardOpen(false)}
            />
            <BulkCollectionImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
            />
        </div>
    );
};

export default CollectionPage;
