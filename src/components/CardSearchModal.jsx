import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useScryfall } from '../hooks/useScryfall';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { useDebounce } from '../hooks/useDebounce';
import { collectionService } from '../services/collectionService';
import { communityService } from '../services/communityService';
import InteractiveCard from './common/InteractiveCard';
import { FunnelIcon } from '@heroicons/react/24/solid';

const OperatorSelect = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const options = [
        { label: '=', value: '=' },
        { label: '≥', value: '>=' },
        { label: '≤', value: '<=' }
    ];

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = options.find(opt => opt.value === value) || options[0];

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-3 bg-gray-900/50 hover:bg-gray-800 text-indigo-400 font-bold rounded-l-xl border-r border-white/10 transition-colors min-w-[50px] justify-center"
            >
                {selected.label}
                <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-20 bg-gray-900 border border-white/10 rounded-lg shadow-2xl z-[70] overflow-hidden backdrop-blur-xl">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm font-bold transition-colors ${value === opt.value ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const CardSearchModal = ({ isOpen, onClose, onAddCard, onOpenForgeLens }) => {
    // Basic Search
    const [query, setQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [setCode, setSetCode] = useState('');
    const [collectorNumber, setCollectorNumber] = useState('');

    // Multi-Collection State
    const [targetUserId, setTargetUserId] = useState(null); // null = My Collection
    const [writableCollections, setWritableCollections] = useState([]);

    // UI State
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Advanced Filters
    const [colors, setColors] = useState([]);
    const [colorLogic, setColorLogic] = useState('or');
    const [colorIdentity, setColorIdentity] = useState(false);
    const [colorExcluded, setColorExcluded] = useState(false);
    const [rarities, setRarities] = useState([]);
    const [type, setType] = useState('');
    const [oracleText, setOracleText] = useState('');
    const [manaValue, setManaValue] = useState({ operator: '=', value: '' });
    const [power, setPower] = useState({ operator: '=', value: '' });
    const [toughness, setToughness] = useState({ operator: '=', value: '' });
    const [flavor, setFlavor] = useState('');
    const [artist, setArtist] = useState('');

    const { results, loading, error, searchCards, getSuggestions, setResults } = useScryfall();
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    // Pass targetUserId to useCollection to view that user's counts
    const { cards: collectionCards, refresh } = useCollection({ userId: targetUserId || undefined });
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
        if (debouncedQuery.length >= 2 && isTyping) {
            fetchSuggestions(debouncedQuery);
        } else if (debouncedQuery.length < 2) {
            setSuggestions([]);
        }
    }, [debouncedQuery]);

    const fetchSuggestions = async (q) => {
        const found = await getSuggestions(q);
        setSuggestions(found);
        setShowSuggestions(found.length > 0);
    };

    // Fetch writable collections
    useEffect(() => {
        const loadCollections = async () => {
            try {
                const perms = await communityService.fetchIncomingPermissions();
                // Filter for editor/admin/contributor access
                const writable = perms.filter(p => ['editor', 'admin', 'contributor'].includes(p.permission_level) && !p.target_deck_id);
                setWritableCollections(writable);
            } catch (err) {
                console.error('Failed to load writable collections', err);
            }
        };
        if (isOpen) loadCollections();
    }, [isOpen]);

    const collectionMap = useMemo(() => {
        const map = new Map();
        if (collectionCards) {
            collectionCards.forEach(c => {
                const scryfallId = c.scryfall_id || c.id;
                if (!map.has(scryfallId)) map.set(scryfallId, []);
                map.get(scryfallId).push(c);
            });
        }
        return map;
    }, [collectionCards]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        setShowSuggestions(false);

        const options = {
            set: setCode,
            cn: collectorNumber,
            colors: colors.length > 0 ? colors : undefined,
            colorLogic,
            colorIdentity,
            colorExcluded,
            rarity: rarities.length > 0 ? rarities : undefined,
            type,
            text: oracleText,
            flavor,
            artist,
            mv: manaValue.value !== '' ? { operator: manaValue.operator, value: Number(manaValue.value) } : undefined,
            power: power.value !== '' ? { operator: power.operator, value: Number(power.value) } : undefined,
            toughness: toughness.value !== '' ? { operator: toughness.operator, value: Number(toughness.value) } : undefined,
        };

        searchCards(query, options);
    };

    const clearFilters = () => {
        setQuery('');
        setSetCode('');
        setCollectorNumber('');
        setColors([]);
        setColorExcluded(false);
        setRarities([]);
        setType('');
        setOracleText('');
        setManaValue({ operator: '=', value: '' });
        setPower({ operator: '=', value: '' });
        setToughness({ operator: '=', value: '' });
        setFlavor('');
        setArtist('');
    };

    const toggleColor = (c) => {
        setColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    };

    const toggleRarity = (r) => {
        setRarities(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
    };

    const handleUpdateCount = async (card, type, delta) => {
        if (!currentUser) return addToast("Please log in", "error");
        try {
            const scryfallId = card.id;
            const userCopies = collectionMap.get(scryfallId) || [];
            const finish = type === 'foil' ? 'foil' : 'nonfoil';
            const existing = userCopies.find(c => c.finish === finish && !c.deck_id && !c.is_wishlist);

            if (delta > 0) {
                if (existing) {
                    await collectionService.updateCard(existing.id, { count: existing.count + 1 });
                    addToast(`Added ${finish} ${card.name}`, 'success');
                    // For update, we might want to notify properly too, but "Undo Add" acts on New Card.
                    // "Undo Update" is harder. 
                    // Let's focus on New Card for now, or assume existing update is just refresh.
                } else {
                    const res = await collectionService.addCardToCollection(currentUser.uid, card, 1, finish, false, targetUserId);
                    addToast(`Added new ${finish} ${card.name}`, 'success');

                    if (onAddCard && res && res.id) {
                        const addedCard = {
                            ...card,
                            firestoreId: res.id,
                            id: card.id, // Scryfall ID
                            finish: finish,
                            count: 1,
                            is_wishlist: false
                        };
                        onAddCard(addedCard);
                    }
                }
            } else {
                if (existing) {
                    if (existing.count > 1) {
                        await collectionService.updateCard(existing.id, { count: existing.count - 1 });
                        addToast(`Removed ${finish} ${card.name}`, 'info');
                    } else {
                        await collectionService.removeCard(existing.id);
                        addToast(`Removed last ${finish} ${card.name}`, 'info');
                    }
                }
            }
            refresh();
        } catch (err) {
            console.error("Update failed", err);
            addToast("Failed to update collection", "error");
        }
    };

    const handleUpdateWishlistCount = async (card, delta) => {
        if (!currentUser) return addToast("Please log in", "error");
        try {
            const scryfallId = card.id;
            const userCopies = collectionMap.get(scryfallId) || [];
            const existing = userCopies.find(c => c.is_wishlist && !c.deck_id);

            if (delta > 0) {
                if (existing) {
                    await collectionService.updateCard(existing.id, { count: existing.count + 1 });
                    addToast(`Increased ${card.name} in wishlist`, 'success');
                } else {
                    await collectionService.addCardToCollection(currentUser.uid, card, 1, 'nonfoil', true, targetUserId);
                    addToast(`Added ${card.name} to wishlist`, 'success');
                }
            } else {
                if (existing) {
                    if (existing.count > 1) {
                        await collectionService.updateCard(existing.id, { count: existing.count - 1 });
                        addToast(`Decreased ${card.name} in wishlist`, 'info');
                    } else {
                        await collectionService.removeCard(existing.id);
                        addToast(`Removed ${card.name} from wishlist`, 'info');
                    }
                }
            }
            refresh();
        } catch (err) {
            console.error("Wishlist update failed", err);
            addToast("Failed to update wishlist", "error");
        }
    };

    if (!isOpen) return null;

    const colorMap = {
        W: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', symbol: 'https://svgs.scryfall.io/card-symbols/W.svg' },
        U: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', symbol: 'https://svgs.scryfall.io/card-symbols/U.svg' },
        B: { bg: 'bg-gray-300', text: 'text-gray-800', border: 'border-gray-400', symbol: 'https://svgs.scryfall.io/card-symbols/B.svg' },
        R: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', symbol: 'https://svgs.scryfall.io/card-symbols/R.svg' },
        G: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', symbol: 'https://svgs.scryfall.io/card-symbols/G.svg' },
        C: { bg: 'bg-gray-400', text: 'text-gray-900', border: 'border-gray-500', symbol: 'https://svgs.scryfall.io/card-symbols/C.svg' }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in group">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>

            {/* Modal Container - Glassy Look */}
            <div className="relative bg-gray-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-white/5">

                {/* Header Compact */}
                <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/5 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-3">
                            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Card Library</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 uppercase tracking-wider border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                                Database
                            </span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Collection Selector Moved to Header */}
                        {writableCollections.length > 0 && (
                            <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1 border border-white/5">
                                <span className="text-[10px] font-bold text-gray-500 uppercase px-2">Target:</span>
                                <select
                                    value={targetUserId || ''}
                                    onChange={(e) => setTargetUserId(e.target.value || null)}
                                    className="bg-transparent text-xs text-white focus:outline-none font-bold cursor-pointer hover:text-indigo-300 transition-colors"
                                >
                                    <option value="" className="bg-gray-900">My Collection</option>
                                    {writableCollections.map(c => (
                                        <option key={c.owner_id} value={c.owner_id} className="bg-gray-900">
                                            {c.owner_username}'s Collection ({c.permission_level})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Forge Lens Promo Bar - Sleek & Glassy */}
                {onOpenForgeLens && (
                    <div className="relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-indigo-600/20 opacity-50 blur-xl group-hover:opacity-75 transition-opacity"></div>
                        <div className="relative px-6 py-2 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white">Have the physical card?</span>
                                    <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-gray-600"></span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider hidden sm:block">Scan instantly with Forge Lens AI</span>
                                </div>
                            </div>
                            <button
                                onClick={onOpenForgeLens}
                                className="px-5 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 hover:text-white text-indigo-300 border border-indigo-500/30 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(99,102,241,0.1)] hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center gap-2"
                            >
                                <span>Launch Scanner</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Scrollable Body Contents */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-black/20">
                    {/* Search & Filters */}
                    <div className="p-6 space-y-4 relative z-[60]">
                        <form onSubmit={handleSearch} className="relative flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="relative flex-1 group">
                                    <input
                                        id="card-search-input"
                                        ref={inputRef}
                                        type="text"
                                        placeholder="Search cards..."
                                        className="w-full bg-white/5 text-white border border-white/10 rounded-xl py-4 px-6 pl-14 pr-12 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder-gray-500 backdrop-blur-sm"
                                        value={query}
                                        onChange={(e) => {
                                            setQuery(e.target.value);
                                            setIsTyping(true);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                                    />
                                    <svg className="absolute left-5 top-5 w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>

                                    {query && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setQuery('');
                                                setSuggestions([]);
                                                inputRef.current?.focus();
                                            }}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}

                                    {/* Autocomplete Dropdown */}
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-[100] py-2 max-h-60 overflow-y-auto custom-scrollbar">
                                            {suggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => {
                                                        setQuery(s);
                                                        setIsTyping(false);
                                                        setShowSuggestions(false);
                                                        searchCards(s, { set: setCode, cn: collectorNumber });
                                                    }}
                                                    className="w-full text-left px-6 py-3 hover:bg-white/5 text-gray-400 hover:text-white transition-colors border-b border-white/5 last:border-0"
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    id="card-search-advanced-toggle"
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className={`px-6 rounded-2xl border border-white/10 flex items-center gap-2 font-bold transition-all ${showAdvanced ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-950 text-gray-400 hover:text-white hover:bg-gray-800'}`}
                                >
                                    <FunnelIcon className="w-5 h-5" />
                                    Advanced Search
                                </button>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl text-lg font-bold transition-all disabled:opacity-50 min-w-[120px] shadow-lg shadow-indigo-500/20 active:scale-95 border border-indigo-500/50"
                                >
                                    {loading ? 'Searching...' : 'Search'}
                                </button>
                            </div>

                            {/* Advanced Panel */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showAdvanced ? 'max-h-[800px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                                <div className="bg-gray-950/50 rounded-2xl p-6 border border-white/5 space-y-6">
                                    <div className="flex justify-between">
                                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Advanced Configuration</h3>
                                        <button onClick={clearFilters} className="text-orange-500 hover:text-orange-400 text-[10px] font-black uppercase tracking-widest hover:underline">Reset Filters</button>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Colors */}
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Colors</label>
                                            <div className="flex flex-wrap gap-4">
                                                <div className="flex gap-2">
                                                    {Object.entries(colorMap).map(([key, style]) => (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => toggleColor(key)}
                                                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 ${colors.includes(key) ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}
                                                            style={{ backgroundColor: colors.includes(key) ? 'transparent' : '' }}
                                                        >
                                                            <img src={style.symbol} alt={key} className={`w-full h-full ${colors.includes(key) ? 'drop-shadow-md' : 'grayscale'}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm bg-gray-900 border border-white/10 rounded-lg p-1">
                                                    {['or', 'and'].map(l => (
                                                        <button
                                                            key={l}
                                                            type="button"
                                                            onClick={() => setColorLogic(l)}
                                                            className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${colorLogic === l ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                                        >
                                                            {l}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rarity */}
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rarity</label>
                                            <div className="flex gap-3">
                                                {['common', 'uncommon', 'rare', 'mythic'].map(r => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() => toggleRarity(r)}
                                                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-all ${rarities.includes(r) ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-gray-900 border-white/10 text-gray-500 hover:text-gray-300'}`}
                                                    >
                                                        {r.charAt(0)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Type</label>
                                            <input type="text" placeholder="Creature, Artifact..." className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" value={type} onChange={e => setType(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Text</label>
                                            <input type="text" placeholder="Rules text..." className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" value={oracleText} onChange={e => setOracleText(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Mana Value</label>
                                            <div className="flex items-center bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
                                                <OperatorSelect value={manaValue.operator} onChange={v => setManaValue({ ...manaValue, operator: v })} />
                                                <input type="number" className="w-full bg-transparent p-2 text-sm outline-none" value={manaValue.value} onChange={e => setManaValue({ ...manaValue, value: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="space-y-2 flex-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Set</label>
                                                <input type="text" placeholder="ABC" maxLength={5} className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none uppercase" value={setCode} onChange={e => setSetCode(e.target.value)} />
                                            </div>
                                            <div className="space-y-2 flex-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">CN</label>
                                                <input type="text" placeholder="#" className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" value={collectorNumber} onChange={e => setCollectorNumber(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Results Area */}
                    <div id="card-search-results" className="p-6">
                        {error && (
                            <div className="flex items-center justify-center p-8 text-red-400 bg-red-500/10 rounded-2xl border border-red-500/20">
                                <p className="font-bold">{error}</p>
                            </div>
                        )}

                        {!loading && results.length === 0 && (query || showAdvanced) && !error && (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-500 opacity-60">
                                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <p className="text-lg font-bold">No matches found</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {results.map((card, index) => {
                                const userCopies = collectionMap.get(card.id) || [];
                                const normalCount = userCopies.filter(c => c.finish === 'nonfoil' && !c.deck_id && !c.is_wishlist).reduce((sum, c) => sum + (c.count || 1), 0);
                                const foilCount = userCopies.filter(c => c.finish === 'foil' && !c.deck_id && !c.is_wishlist).reduce((sum, c) => sum + (c.count || 1), 0);
                                const wishlistCount = userCopies.filter(c => c.is_wishlist && !c.deck_id).reduce((sum, c) => sum + (c.count || 1), 0);

                                return (
                                    <InteractiveCard
                                        key={card.id || index}
                                        card={card}
                                        normalCount={normalCount}
                                        foilCount={foilCount}
                                        wishlistCount={wishlistCount}
                                        onUpdateCount={handleUpdateCount}
                                        onUpdateWishlistCount={handleUpdateWishlistCount}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
            `}} />
        </div>,
        document.body
    );
};

export default CardSearchModal;
