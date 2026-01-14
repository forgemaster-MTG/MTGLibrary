import React, { useState, useMemo, useEffect } from 'react';
import { useSets } from '../hooks/useSets';
import { useCollection } from '../hooks/useCollection';
import { Link, useNavigate } from 'react-router-dom';
import CardAutocomplete from '../components/common/CardAutocomplete';
import { api } from '../services/api';

const SetsPage = () => {
    const { sets, loading: setsLoading, error: setsError } = useSets();
    const { cards: collectionCards, loading: collLoading } = useCollection();
    const [searchTerm, setSearchTerm] = useState('');
    const [cardSearchTerm, setCardSearchTerm] = useState(sessionStorage.getItem('mtg_card_search') || '');
    const [setsWithCard, setSetsWithCard] = useState(null); // null means no card search active
    const [searchingCard, setSearchingCard] = useState(false);
    const [showOnlyOwned, setShowOnlyOwned] = useState(false);
    const navigate = useNavigate();

    // Debounced card search to find containing sets
    useEffect(() => {
        const fetchSetsForCard = async () => {
            const term = cardSearchTerm.trim();
            if (!term) {
                setSetsWithCard(null);
                sessionStorage.removeItem('mtg_card_search');
                return;
            }

            sessionStorage.setItem('mtg_card_search', term);
            setSearchingCard(true);
            try {
                // Query local DB for sets containing this card
                const response = await api.get('/api/cards/sets-for-card', { name: term });
                setSetsWithCard(new Set(response.data || []));
            } catch (err) {
                console.error("Local card search failed", err);
                setSetsWithCard(new Set());
            } finally {
                setSearchingCard(false);
            }
        };

        const timer = setTimeout(fetchSetsForCard, 500);
        return () => clearTimeout(timer);
    }, [cardSearchTerm]);

    // Map of Set Code -> Unique Card Name Count
    const setProgressMap = useMemo(() => {
        const map = new Map();
        if (collectionCards) {
            collectionCards.forEach(c => {
                if (c.is_wishlist || c.deck_id) return;
                const setCode = (c.set || c.set_code)?.toLowerCase();
                const cardName = c.name; // Unique by Name

                if (!map.has(setCode)) map.set(setCode, new Set());
                if (cardName) map.get(setCode).add(cardName);
            });
        }

        // Convert sets to counts
        const result = {};
        map.forEach((names, code) => {
            result[code] = names.size;
        });
        return result;
    }, [collectionCards]);

    // Grouping Logic
    const groupedSets = useMemo(() => {
        if (!sets) return {};

        const groups = {
            'Expansion': [],
            'Core': [],
            'Commander': [],
            'Masters': [],
            'Draft Innovation': [],
            'Other': []
        };

        const typeMapping = {
            'expansion': 'Expansion',
            'core': 'Core',
            'commander': 'Commander',
            'masters': 'Masters',
            'draft_innovation': 'Draft Innovation'
        };

        sets.forEach(set => {
            const progress = setProgressMap[set.code.toLowerCase()] || 0;
            const isOwned = progress > 0;

            // Search filter
            const matchesSearch = !searchTerm ||
                set.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                set.code.toLowerCase().includes(searchTerm.toLowerCase());

            // Card search filter
            const matchesCardSearch = !setsWithCard || setsWithCard.has(set.code.toLowerCase());

            // Owned filter
            const matchesOwned = !showOnlyOwned || isOwned;

            if (!matchesSearch || !matchesOwned || !matchesCardSearch) return;

            const groupName = typeMapping[set.set_type] || 'Other';
            if (groups[groupName]) {
                groups[groupName].push({ ...set, ownedCount: progress });
            } else {
                groups['Other'].push({ ...set, ownedCount: progress });
            }
        });

        // Sort inside groups
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => new Date(b.released_at) - new Date(a.released_at));
        });

        return groups;
    }, [sets, searchTerm, showOnlyOwned, setProgressMap, setsWithCard]);

    const handleSetClick = (setCode) => {
        navigate(`/sets/${setCode}`);
    };

    if (setsLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (setsError) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center text-red-500 bg-red-500/10 p-8 rounded-2xl border border-red-500/20 max-w-md">
                    <p className="font-bold text-xl mb-2">Error loading sets</p>
                    <p className="text-sm opacity-80">{setsError.message}</p>
                </div>
            </div>
        );
    }

    const sections = ['Expansion', 'Core', 'Commander', 'Masters', 'Draft Innovation', 'Other'];

    return (
        <div className="min-h-screen bg-gray-900 pb-20">
            {/* Action Bar */}
            <div className="bg-gray-950/80 backdrop-blur-xl border-b border-white/10 sticky top-16 z-30 py-3 md:py-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4 w-full lg:w-auto">
                            <div className="flex flex-col">
                                <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none">
                                    Set <span className="text-indigo-500">Library</span>
                                </h1>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1 opacity-70">Browse Collections</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto lg:flex-1 lg:justify-end">
                            <div className="relative flex-grow max-w-xs group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-3.5 w-3.5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-9 pr-10 py-2 bg-gray-900/50 border border-white/5 rounded-lg text-xs text-gray-300 placeholder-gray-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none"
                                    placeholder="Search sets..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>

                            <div className="relative flex-grow max-w-sm">
                                <CardAutocomplete
                                    value={cardSearchTerm}
                                    onChange={setCardSearchTerm}
                                    placeholder="Find card in sets..."
                                />
                            </div>

                            <button
                                onClick={() => setShowOnlyOwned(!showOnlyOwned)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${showOnlyOwned
                                    ? 'bg-indigo-600 text-white shadow-lg'
                                    : 'bg-gray-800/80 text-gray-400 border border-white/5 hover:bg-gray-700'
                                    }`}
                            >
                                {showOnlyOwned ? 'Owned' : 'Show All'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
                {sections.map(section => (
                    groupedSets[section] && groupedSets[section].length > 0 && (
                        <div key={section} className="animate-fade-in">
                            <div className="flex items-center gap-4 mb-8">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                    {section}
                                    <div className="h-[2px] w-12 bg-indigo-500/50" />
                                </h2>
                                <span className="text-[10px] font-black text-gray-500 bg-gray-800/50 border border-white/5 px-3 py-1 rounded-full uppercase tracking-widest">
                                    {groupedSets[section].length} Sets
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                {groupedSets[section].map(set => {
                                    const percent = Math.min(100, Math.round((set.ownedCount / set.card_count) * 100));
                                    const isComplete = percent >= 100;

                                    return (
                                        <div
                                            key={set.id}
                                            onClick={() => handleSetClick(set.code)}
                                            className="relative bg-gray-800/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:border-indigo-500/30 overflow-hidden min-h-[160px] flex flex-col justify-between"
                                        >
                                            {/* Progress Background Layer */}
                                            <div
                                                className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out z-0`}
                                                style={{
                                                    height: `${percent}%`,
                                                    background: isComplete
                                                        ? 'linear-gradient(to top, rgba(34, 197, 94, 0.15) 0%, transparent 100%)'
                                                        : 'linear-gradient(to top, rgba(79, 70, 229, 0.15) 0%, transparent 100%)'
                                                }}
                                            />

                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="w-10 h-10 bg-gray-900/80 rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
                                                        {set.icon_svg_uri ? (
                                                            <img src={set.icon_svg_uri} alt={set.name} className="w-6 h-6 filter invert opacity-60 group-hover:opacity-100 transition-opacity" />
                                                        ) : (
                                                            <span className="text-xs font-black text-gray-500">{set.code.toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-gray-500 block uppercase tracking-widest leading-none mb-1">Code</span>
                                                            <span className="text-xs font-bold text-indigo-400 mb-2">{set.code.toUpperCase()}</span>
                                                            <span className="text-[10px] font-black text-gray-500 block uppercase tracking-widest leading-none mb-1">Release</span>
                                                            <span className="text-xs font-bold text-gray-400">{set.released_at?.split('-')[0]}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <h3 className="text-sm font-black text-white leading-snug group-hover:text-indigo-400 transition-colors">
                                                    {set.name}
                                                </h3>
                                            </div>

                                            <div className="relative z-10 pt-4 mt-4 border-t border-white/5 flex items-end justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Collected</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`text-lg font-black tabular-nums ${isComplete ? 'text-green-400' : 'text-indigo-400'}`}>
                                                            {set.ownedCount}
                                                        </span>
                                                        <span className="text-gray-600 text-[10px] font-bold">/ {set.card_count}</span>
                                                    </div>
                                                </div>

                                                <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${isComplete ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-950/80 text-gray-400 border border-white/5'}`}>
                                                    {percent}%
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
};

export default SetsPage;
