import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const PreconPage = () => {
    const navigate = useNavigate();
    const { type: paramType, set: paramSet } = useParams();
    const { addToast } = useToast();

    // Data States
    const [types, setTypes] = useState([]);
    const [sets, setSets] = useState([]);
    const [precons, setPrecons] = useState([]); // Filtered list for search/categories
    const [fullPrecons, setFullPrecons] = useState([]); // Global list for Banner/Dates view

    // UI States
    const [viewMode, setViewMode] = useState('types'); // 'types' | 'sets' | 'dates'
    const [loading, setLoading] = useState(true);
    const [recentPrecons, setRecentPrecons] = useState([]);
    const [expandedDates, setExpandedDates] = useState(new Set());
    const [expandedSets, setExpandedSets] = useState(new Set());
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Initial Load of Metadata (Types/Sets)
    useEffect(() => {
        const loadInitial = async () => {
            setLoading(true);
            try {
                const [typesData, setsData, allPrecons] = await Promise.all([
                    api.get('/api/precons/types'),
                    api.get('/api/precons/sets'),
                    api.get('/api/precons')
                ]);
                setTypes(typesData);
                setSets(setsData);

                // For "Dates" mode and "Recently Released", we need the full list
                setFullPrecons(allPrecons);
                setPrecons(allPrecons);

                // Latest 5 for banner - Sort by date descending, nulls at bottom
                const sorted = [...allPrecons].sort((a, b) => {
                    const da = a.release_date ? new Date(a.release_date) : new Date(0);
                    const db = b.release_date ? new Date(b.release_date) : new Date(0);
                    if (isNaN(da)) return 1;
                    if (isNaN(db)) return -1;
                    return db - da;
                });
                setRecentPrecons(sorted.slice(0, 5));
            } catch (err) {
                console.error(err);
                addToast('Failed to load database', 'error');
            } finally {
                setLoading(false);
            }
        };
        loadInitial();
    }, []);

    // Main Logic when Params or Search Change
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (debouncedSearch) {
                    await fetchPrecons({ search: debouncedSearch });
                } else if (paramType) {
                    await fetchPrecons({ type: paramType });
                } else if (paramSet) {
                    await fetchPrecons({ set_code: paramSet });
                } else {
                    // Index Mode - no specific filter, but we might want to show everything?
                    // Actually, let's keep precons reflecting the full list when no filter active
                    // setPrecons(fullPrecons); // This might be redundant if we use fullPrecons directly for Dates view
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [debouncedSearch, paramType, paramSet]);

    const fetchTypes = async () => {
        try {
            const data = await api.get('/api/precons/types');
            setTypes(data);
        } catch (err) {
            console.error(err);
            addToast('Failed to load types', 'error');
        }
    };

    const fetchSets = async () => {
        try {
            const data = await api.get('/api/precons/sets');
            setSets(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchPrecons = async (params) => {
        try {
            const query = new URLSearchParams(params).toString();
            const data = await api.get(`/api/precons?${query}`);
            setPrecons(data);
        } catch (err) {
            console.error(err);
            addToast('Failed to load precons', 'error');
        }
    };

    // Helper Styles
    const getTypeColor = (type) => {
        const lower = (type || '').toLowerCase();
        if (lower.includes('commander')) return 'purple';
        if (lower.includes('jumpstart')) return 'emerald';
        if (lower.includes('challenger')) return 'rose';
        if (lower.includes('starter')) return 'amber';
        if (lower.includes('box set')) return 'cyan';
        return 'blue';
    };

    const getTypeStyle = (type) => {
        const color = getTypeColor(type);
        const schemes = {
            purple: 'from-purple-600/60 to-blue-600/20 hover:border-purple-400 border-purple-500/30',
            emerald: 'from-emerald-600/60 to-teal-600/20 hover:border-emerald-400 border-emerald-500/30',
            rose: 'from-rose-600/60 to-red-600/20 hover:border-rose-400 border-rose-500/30',
            amber: 'from-amber-600/60 to-orange-600/20 hover:border-amber-400 border-amber-500/30',
            cyan: 'from-cyan-600/60 to-blue-600/20 hover:border-cyan-400 border-cyan-500/30',
            blue: 'from-blue-600/60 to-indigo-600/20 hover:border-blue-400 border-blue-500/30'
        };
        return schemes[color] || schemes.blue;
    };

    // Grouping Logic for "Dates" Mode
    const groupPreconsByDate = () => {
        const groups = {};
        const sourceList = fullPrecons.length > 0 ? fullPrecons : precons;
        sourceList.forEach(p => {
            const date = p.release_date || 'Unknown Date';
            if (!groups[date]) groups[date] = { date, sets: {} };

            const set = p.set_code || '???';
            if (!groups[date].sets[set]) groups[date].sets[set] = { code: set, types: {} };

            const type = p.type || 'Other';
            if (!groups[date].sets[set].types[type]) groups[date].sets[set].types[type] = [];

            groups[date].sets[set].types[type].push(p);
        });

        // Sort dates descending, "Unknown" at bottom
        return Object.values(groups).sort((a, b) => {
            if (a.date === 'Unknown Date') return 1;
            if (b.date === 'Unknown Date') return -1;
            return new Date(b.date) - new Date(a.date);
        });
    };

    const toggleDate = (date) => {
        setExpandedDates(prev => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
    };

    const toggleSetExpand = (setCode) => {
        setExpandedSets(prev => {
            const next = new Set(prev);
            if (next.has(setCode)) next.delete(setCode);
            else next.add(setCode);
            return next;
        });
    };

    const isListView = !!(paramType || paramSet || debouncedSearch);
    const displayPrecons = isListView ? precons : fullPrecons;

    return (
        <div className="min-h-screen bg-gray-950 p-6 md:p-8 pt-24">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-gray-800 pb-8">
                    <div className="space-y-2 w-full lg:w-auto text-center lg:text-left">
                        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight uppercase italic">Precon <span className="text-purple-500">Database</span></h1>
                        <p className="text-sm md:text-lg text-gray-400 max-w-2xl mx-auto lg:mx-0">
                            {isListView ? (
                                <>
                                    <Link
                                        to="/precons"
                                        onClick={() => { setSearch(''); }}
                                        className="hover:text-white transition-colors underline decoration-dotted"
                                    >
                                        Database
                                    </Link>
                                    {' > '}
                                    <span className="text-white font-bold">
                                        {debouncedSearch ? `Search: "${debouncedSearch}"` : (paramType || paramSet)}
                                    </span>
                                </>
                            ) : (
                                "Browse official preconstructed decks."
                            )}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                        {!isListView && (
                            <div className="bg-gray-900/80 rounded-2xl p-1.5 border border-gray-700 flex text-xs md:text-sm font-bold shadow-2xl backdrop-blur-xl shrink-0">
                                <button
                                    onClick={() => setViewMode('types')}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl transition-all duration-300 ${viewMode === 'types' ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Types
                                </button>
                                <button
                                    onClick={() => setViewMode('sets')}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl transition-all duration-300 ${viewMode === 'sets' ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Sets
                                </button>
                                <button
                                    onClick={() => setViewMode('dates')}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl transition-all duration-300 ${viewMode === 'dates' ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Dates
                                </button>
                            </div>
                        )}
                        <div className="relative w-full sm:w-auto lg:min-w-[400px]">
                            <input
                                type="text"
                                placeholder="Search decks or commanders..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-gray-900/80 border border-gray-700 text-white px-4 py-4 md:py-3 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none w-full pl-12 pr-10 shadow-2xl backdrop-blur-xl text-base"
                            />
                            <svg className="w-6 h-6 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recently Released Banner */}
                {!isListView && recentPrecons.length > 0 && (
                    <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl md:rounded-3xl p-4 md:p-8 relative overflow-hidden group shadow-2xl">
                        <div className="absolute top-0 right-0 p-12 opacity-5">
                            <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-600 p-2 rounded-lg shadow-lg shadow-purple-500/20">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">Recently Released</h2>
                                        <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">The Latest Additions to the Database</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {Object.entries(recentPrecons.reduce((acc, p) => {
                                    if (!acc[p.type]) acc[p.type] = [];
                                    acc[p.type].push(p);
                                    return acc;
                                }, {})).map(([typeName, decks]) => {
                                    const color = getTypeColor(typeName);
                                    const colors = {
                                        purple: { text: 'text-purple-400', bg: 'bg-purple-500/20', border: 'hover:border-purple-500/50' },
                                        emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'hover:border-emerald-500/50' },
                                        rose: { text: 'text-rose-400', bg: 'bg-rose-500/20', border: 'hover:border-rose-500/50' },
                                        amber: { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'hover:border-amber-500/50' },
                                        cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'hover:border-cyan-500/50' },
                                        blue: { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'hover:border-blue-500/50' }
                                    };
                                    const cls = colors[color] || colors.blue;

                                    return (
                                        <div key={typeName} className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${cls.text}`}>
                                                    {typeName}s
                                                </h3>
                                                <div className={`h-px flex-1 ${cls.bg}`}></div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                                {decks.map(p => (
                                                    <Link
                                                        key={p.id}
                                                        to={`/precons/deck/${p.id}`}
                                                        className={`bg-gray-900/40 hover:bg-gray-800/60 border border-gray-800 rounded-2xl p-4 transition-all hover:scale-[1.02] flex items-center gap-4 group/item ${cls.border}`}
                                                    >
                                                        <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-inner group-hover/item:scale-110 transition-transform">
                                                            {p.image_uri ? (
                                                                <img src={p.image_uri} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[10px] font-black text-gray-600 uppercase">{p.set_code}</span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-xs font-bold text-white truncate group-hover/item:text-white transition-colors">{p.name}</h3>
                                                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">{p.release_date}</p>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                    </div>
                ) : !isListView ? (
                    viewMode === 'types' ? (
                        /* TYPES GRID */
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {types.map(type => (
                                <div
                                    key={type}
                                    onClick={() => navigate(`/precons/type/${encodeURIComponent(type)}`)}
                                    className={`group cursor-pointer bg-white/5 border rounded-2xl p-6 md:p-10 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] bg-gradient-to-br backdrop-blur-md ${getTypeStyle(type)}`}
                                >
                                    <h3 className="text-xl md:text-2xl font-black text-white text-center group-hover:scale-110 transition-transform uppercase tracking-tight">{type}</h3>
                                </div>
                            ))}
                        </div>
                    ) : viewMode === 'sets' ? (
                        /* SETS GRID */
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {sets.map(set => (
                                <div
                                    key={set}
                                    onClick={() => navigate(`/precons/set/${set}`)}
                                    className="group cursor-pointer bg-gray-900 border border-gray-800 rounded-xl p-6 transition-all hover:-translate-y-1 hover:border-purple-500 flex flex-col items-center justify-center gap-2"
                                >
                                    <span className="text-2xl font-black text-gray-700 group-hover:text-white transition-colors uppercase">{set}</span>
                                    <span className="text-xs text-purple-400 font-bold">Set Code</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* DATES GROUPED VIEW */
                        <div className="space-y-6">
                            {groupPreconsByDate().map(group => (
                                <div key={group.date} className="bg-gray-900/50 border border-gray-800 rounded-3xl overflow-hidden">
                                    <div
                                        onClick={() => toggleDate(group.date)}
                                        className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-purple-600/20 text-purple-400 px-4 py-2 rounded-xl font-black italic">
                                                {group.date}
                                            </div>
                                            <h3 className="text-xl font-bold text-white">
                                                {Object.keys(group.sets).length} Set{Object.keys(group.sets).length > 1 ? 's' : ''} • {Object.values(group.sets).reduce((acc, s) => acc + Object.values(s.types).flat().length, 0)} Decks
                                            </h3>
                                        </div>
                                        <svg className={`w-6 h-6 text-gray-500 transition-transform ${expandedDates.has(group.date) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>

                                    {expandedDates.has(group.date) && (
                                        <div className="p-6 pt-0 space-y-4">
                                            {Object.values(group.sets).map(set => (
                                                <div key={set.code} className="border border-gray-800 rounded-2xl overflow-hidden bg-black/20">
                                                    <div
                                                        onClick={() => toggleSetExpand(set.code)}
                                                        className="p-4 flex items-center justify-between bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="bg-gray-800 text-white font-black px-2 py-1 rounded text-xs uppercase">{set.code}</span>
                                                            <span className="text-gray-400 font-bold">{Object.values(set.types).flat().length} Decks</span>
                                                        </div>
                                                        <svg className={`w-4 h-4 text-gray-500 transition-transform ${expandedSets.has(set.code) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </div>

                                                    {expandedSets.has(set.code) && (
                                                        <div className="p-4 space-y-6">
                                                            {Object.entries(set.types).map(([typeName, decks]) => (
                                                                <div key={typeName} className="space-y-3">
                                                                    <h4 className="text-xs font-black text-purple-500 uppercase tracking-widest flex items-center gap-2">
                                                                        {typeName} <div className="h-px flex-1 bg-purple-500/20"></div>
                                                                    </h4>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                        {decks.map(p => (
                                                                            <Link
                                                                                key={p.id}
                                                                                to={`/precons/deck/${p.id}`}
                                                                                className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-purple-500/50 transition-all flex items-center gap-4 group"
                                                                            >
                                                                                <div className="w-12 h-12 bg-gray-800 rounded group-hover:scale-110 transition-transform overflow-hidden shrink-0">
                                                                                    {p.image_uri ? (
                                                                                        <img src={p.image_uri} alt="" className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-600">DECK</div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <h5 className="font-bold text-white text-sm truncate group-hover:text-purple-400 transition-colors">{p.name}</h5>
                                                                                    <p className="text-[10px] text-gray-500 font-medium truncate">{p.commander_name || p.type || 'Generic'}</p>
                                                                                </div>
                                                                            </Link>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    /* DECKS LIST GRID */
                    displayPrecons.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">
                            No precons found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {displayPrecons.map(p => (
                                <Link
                                    key={p.id}
                                    to={`/precons/deck/${p.id}`}
                                    className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all hover:shadow-xl group flex flex-col cursor-pointer hover:-translate-y-1"
                                >
                                    <div className="p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-2">{p.name}</h3>
                                            <span className="text-xs font-bold bg-gray-800 text-gray-400 px-2 py-1 rounded uppercase tracking-wider">
                                                {p.data?.code || '???'}
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-sm text-gray-400">
                                            <div className="flex justify-between">
                                                <span>Commander</span>
                                                <span className="text-gray-200 font-medium truncate ml-2 max-w-[150px] text-right">
                                                    {p.data?.commander?.[0]?.name || 'Unknown'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Cards</span>
                                                <span className="text-gray-200">
                                                    {(p.data?.mainBoard?.length || 0) + (p.data?.sideBoard?.length || 0) + (p.data?.commander?.length || 0)}
                                                </span>
                                            </div>
                                            {/* Price Calculation for Tile */}
                                            {p.total_price > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Market Price</span>
                                                    <span className="text-green-400 font-bold">
                                                        ${p.total_price.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Action Bar */}
                                    <div className="bg-gray-800/50 p-4 border-t border-gray-800 flex justify-center text-purple-400 font-bold text-sm group-hover:bg-purple-900/20 transition-colors">
                                        View Deck List
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default PreconPage;
