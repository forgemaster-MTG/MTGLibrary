import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useScryfall } from '../hooks/useScryfall';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { useDebounce } from '../hooks/useDebounce';
import { collectionService } from '../services/collectionService';
import InteractiveCard from './common/InteractiveCard';

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
                className="flex items-center gap-2 px-3 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold rounded-l-xl border-r border-white/10 transition-colors min-w-[50px] justify-center"
            >
                {selected.label}
                <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-20 bg-[#1a1c23] border border-white/10 rounded-lg shadow-2xl z-[70] overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
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

const CardSearchModal = ({ isOpen, onClose, onAddCard }) => {
    // Basic Search
    const [query, setQuery] = useState('');
    const [setCode, setSetCode] = useState('');
    const [collectorNumber, setCollectorNumber] = useState('');

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
    const { cards: collectionCards, refresh } = useCollection();
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
        if (debouncedQuery.length >= 2) {
            fetchSuggestions(debouncedQuery);
        } else {
            setSuggestions([]);
        }
    }, [debouncedQuery]);

    const fetchSuggestions = async (q) => {
        const found = await getSuggestions(q);
        setSuggestions(found);
        setShowSuggestions(found.length > 0);
    };

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
                } else {
                    await collectionService.addCardToCollection(currentUser.uid, card, 1, finish);
                    addToast(`Added new ${finish} ${card.name}`, 'success');
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
                    await collectionService.addCardToCollection(currentUser.uid, card, 1, 'nonfoil', true);
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

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}></div>

            {/* Modal Container */}
            <div className="relative bg-[#0d0f14] border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/5">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20 flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Add Cards</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Scrollable Body Contents */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {/* Search & Suggestions */}
                    <div className="p-6 bg-black/20 space-y-4 relative z-[60] border-b border-white/5">
                        <form onSubmit={handleSearch} className="relative flex flex-col md:flex-row gap-4">
                            <div className="relative flex-grow-[3]">
                                <div className="relative group">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="Search by card name..."
                                        className="w-full bg-black/40 text-white border border-white/10 rounded-xl py-3 px-6 pl-12 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder-gray-500 shadow-inner"
                                        value={query}
                                        onChange={(e) => {
                                            setQuery(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                                    />
                                    <svg className="absolute left-4 top-4 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>

                                    {/* Autocomplete Dropdown */}
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-2 bg-[#1a1c23]/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] py-2 max-h-60 overflow-y-auto ring-1 ring-white/10">
                                            {suggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => {
                                                        setQuery(s);
                                                        setShowSuggestions(false);
                                                        searchCards(s, { set: setCode, cn: collectorNumber });
                                                    }}
                                                    className="w-full text-left px-6 py-3 hover:bg-indigo-500/20 text-gray-300 hover:text-white transition-colors border-b border-white/5 last:border-0"
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-4 flex-grow-[1]">
                                <input
                                    type="text"
                                    placeholder="SET"
                                    className="w-1/2 bg-black/40 text-white border border-white/10 rounded-xl py-3 px-4 text-center uppercase text-base focus:ring-2 focus:ring-indigo-500 placeholder-gray-600"
                                    value={setCode}
                                    onChange={(e) => setSetCode(e.target.value)}
                                    maxLength={5}
                                />
                                <input
                                    type="text"
                                    placeholder="CN #"
                                    className="w-1/2 bg-black/40 text-white border border-white/10 rounded-xl py-3 px-4 text-center text-base focus:ring-2 focus:ring-indigo-500 placeholder-gray-600"
                                    value={collectorNumber}
                                    onChange={(e) => setCollectorNumber(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl text-lg font-bold transition-all disabled:opacity-50 min-w-[120px] shadow-lg hover:shadow-indigo-500/25 active:scale-95"
                            >
                                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div> : 'Search'}
                            </button>
                        </form>

                        {/* Advanced Toggle */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs font-black uppercase tracking-[0.2em]"
                            >
                                <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                Advanced Filters
                            </button>
                            {showAdvanced && (
                                <button onClick={clearFilters} className="text-orange-500 hover:text-orange-400 text-[10px] font-black tracking-widest bg-orange-500/10 px-4 py-1.5 rounded-full transition-all border border-orange-500/20 hover:border-orange-500/40">
                                    RESET
                                </button>
                            )}
                        </div>

                        {/* Advanced Panel */}
                        {showAdvanced && (
                            <div className="space-y-6 p-6 bg-white/5 border border-white/5 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                                {/* Logic & Colors */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Color Filters</span>
                                        <div className="flex flex-wrap items-center gap-6">
                                            <div className="flex items-center p-1 bg-black/40 rounded-lg border border-white/5">
                                                {['or', 'and'].map(l => (
                                                    <button
                                                        key={l}
                                                        type="button"
                                                        onClick={() => setColorLogic(l)}
                                                        className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${colorLogic === l ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                                    >
                                                        {l}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {[
                                                    { k: 'W', bg: 'bg-[#f8e7b9]', text: 'text-gray-800' },
                                                    { k: 'U', bg: 'bg-[#0e68ab]', text: 'text-white' },
                                                    { k: 'B', bg: 'bg-[#150b00]', text: 'text-white' },
                                                    { k: 'R', bg: 'bg-[#d3202a]', text: 'text-white' },
                                                    { k: 'G', bg: 'bg-[#00733e]', text: 'text-white' },
                                                    { k: 'C', bg: 'bg-[#949694]', text: 'text-white' }
                                                ].map(({ k, bg, text }) => (
                                                    <button
                                                        key={k}
                                                        type="button"
                                                        onClick={() => toggleColor(k)}
                                                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border-2 font-black shadow-md ${colors.includes(k)
                                                            ? `${bg} ${text} border-white scale-110 ring-2 ring-indigo-500/30`
                                                            : 'border-transparent bg-white/5 text-gray-500 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {k}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex items-center p-1 bg-black/40 rounded-lg border border-white/5">
                                                {['Color', 'Identity'].map(opt => (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setColorIdentity(opt === 'Identity')}
                                                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${(opt === 'Identity') === colorIdentity ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setColorExcluded(!colorExcluded)}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${colorExcluded ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'}`}
                                            >
                                                Exclude Others
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Card Rarity</span>
                                        <div className="flex gap-4">
                                            {[
                                                { k: 'common', s: 'C', c: 'bg-[#150b00] border-white/40' },
                                                { k: 'uncommon', s: 'U', c: 'bg-gray-400 border-white' },
                                                { k: 'rare', s: 'R', c: 'bg-[#af9111] border-[#fce982]' },
                                                { k: 'mythic', s: 'M', c: 'bg-[#d1111d] border-[#fde982]' },
                                                { k: 'special', s: 'S', c: 'bg-purple-600 border-purple-300' }
                                            ].map(({ k, s, c }) => (
                                                <button
                                                    key={k}
                                                    type="button"
                                                    onClick={() => toggleRarity(k)}
                                                    className={`group relative flex flex-col items-center transition-all ${rarities.includes(k) ? 'scale-110' : 'opacity-40 hover:opacity-100 grayscale-[0.5]'}`}
                                                >
                                                    <div className={`w-10 h-10 rounded-md border-2 rotate-45 transform flex items-center justify-center transition-all ${rarities.includes(k) ? c : 'border-white/10 bg-white/5'}`}>
                                                        <span className={`-rotate-45 font-black text-sm ${rarities.includes(k) ? 'text-white' : 'text-gray-500'}`}>{s}</span>
                                                    </div>
                                                    <span className="text-[10px] mt-2 font-bold text-gray-500 group-hover:text-gray-300 capitalize">{k}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Rows of Inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Card Type</label>
                                        <input
                                            type="text"
                                            placeholder="eg: Legendary Creature"
                                            className="w-full bg-black/40 text-sm border border-white/10 rounded-xl p-3 focus:border-indigo-500 outline-none transition-colors placeholder-gray-700"
                                            value={type}
                                            onChange={(e) => setType(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Oracle Text</label>
                                        <input
                                            type="text"
                                            placeholder="eg: flying, haste"
                                            className="w-full bg-black/40 text-sm border border-white/10 rounded-xl p-3 focus:border-indigo-500 outline-none transition-colors placeholder-gray-700"
                                            value={oracleText}
                                            onChange={(e) => setOracleText(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Mana Value</label>
                                        <div className="flex items-center bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                                            <OperatorSelect
                                                value={manaValue.operator}
                                                onChange={(val) => setManaValue({ ...manaValue, operator: val })}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Value"
                                                className="bg-transparent w-full text-sm p-3 outline-none placeholder-gray-700"
                                                value={manaValue.value}
                                                onChange={(e) => setManaValue({ ...manaValue, value: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2 lg:col-span-1 grid grid-cols-2 gap-2">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Power</label>
                                            <div className="flex items-center bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                                                <OperatorSelect
                                                    value={power.operator}
                                                    onChange={(val) => setPower({ ...power, operator: val })}
                                                />
                                                <input type="number" placeholder="P" className="bg-transparent w-full text-sm p-3 outline-none placeholder-gray-700" value={power.value} onChange={(e) => setPower({ ...power, value: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Tough</label>
                                            <div className="flex items-center bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                                                <OperatorSelect
                                                    value={toughness.operator}
                                                    onChange={(val) => setToughness({ ...toughness, operator: val })}
                                                />
                                                <input type="number" placeholder="T" className="bg-transparent w-full text-sm p-3 outline-none placeholder-gray-700" value={toughness.value} onChange={(e) => setToughness({ ...toughness, value: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Flavor Text</label>
                                        <input type="text" placeholder="eg: In the beginning..." className="w-full bg-black/40 text-sm border border-white/10 rounded-xl p-3 focus:border-indigo-500 outline-none transition-colors placeholder-gray-700" value={flavor} onChange={(e) => setFlavor(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Artist</label>
                                        <input type="text" placeholder="eg: Rebecca Guay" className="w-full bg-black/40 text-sm border border-white/10 rounded-xl p-3 focus:border-indigo-500 outline-none transition-colors placeholder-gray-700" value={artist} onChange={(e) => setArtist(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results Area */}
                    <div className="p-6 transition-all duration-300">
                        {error && (
                            <div className="flex flex-col items-center justify-center h-64 text-red-400 bg-red-500/5 rounded-xl border border-red-500/10 mx-auto max-w-2xl animate-in shake duration-300">
                                <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                <p className="font-medium text-center px-4">{error}</p>
                            </div>
                        )}

                        {!loading && results.length === 0 && (query || showAdvanced) && !error && (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400 animate-in fade-in zoom-in-95 duration-300">
                                <svg className="w-16 h-16 mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                <p className="text-lg">No cards found matching your filters</p>
                            </div>
                        )}

                        {!loading && results.length === 0 && !query && !showAdvanced && (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                <svg className="w-16 h-16 mb-4 text-gray-700 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <p>Enter search terms or use advanced filters</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
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
        </div>,
        document.body
    );
};

export default CardSearchModal;
