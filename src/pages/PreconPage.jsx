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
    const [precons, setPrecons] = useState([]);

    // UI States
    const [viewMode, setViewMode] = useState('types'); // 'types' | 'sets'
    const [loading, setLoading] = useState(true);
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
            // Only fetch if we don't have them
            if (types.length === 0) await fetchTypes();
            if (sets.length === 0) await fetchSets();
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
                    // Index Mode - nothing to fetch, just rendering types/sets
                    setPrecons([]);
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
    const getTypeStyle = (type) => {
        const colors = [
            'from-purple-500/20 to-blue-500/5 hover:border-purple-500',
            'from-emerald-500/20 to-teal-500/5 hover:border-emerald-500',
            'from-amber-500/20 to-orange-500/5 hover:border-amber-500',
            'from-rose-500/20 to-red-500/5 hover:border-rose-500',
            'from-cyan-500/20 to-blue-500/5 hover:border-cyan-500',
        ];
        let hash = 0;
        for (let i = 0; i < type.length; i++) hash = type.charCodeAt(i) + ((hash << 5) - hash);
        const idx = Math.abs(hash) % colors.length;
        return colors[idx];
    };

    const isListView = !!(paramType || paramSet || debouncedSearch);

    return (
        <div className="min-h-screen bg-gray-950 p-6 md:p-8 pt-24">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-800 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Precon <span className="text-purple-500">Database</span></h1>
                        <p className="text-gray-400">
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

                    <div className="flex gap-4">
                        {!isListView && (
                            <div className="bg-gray-900 rounded-lg p-1 border border-gray-700 flex text-sm font-bold">
                                <button
                                    onClick={() => setViewMode('types')}
                                    className={`px-4 py-2 rounded-md transition-colors ${viewMode === 'types' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Types
                                </button>
                                <button
                                    onClick={() => setViewMode('sets')}
                                    className={`px-4 py-2 rounded-md transition-colors ${viewMode === 'sets' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Sets
                                </button>
                            </div>
                        )}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search decks or commanders..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none w-64 md:w-80 pl-10 pr-10"
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

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
                                    className={`group cursor-pointer bg-gray-900 border border-gray-800 rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-xl bg-gradient-to-br ${getTypeStyle(type)}`}
                                >
                                    <h3 className="text-xl font-bold text-white text-center group-hover:scale-105 transition-transform">{type}</h3>
                                </div>
                            ))}
                        </div>
                    ) : (
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
                    )
                ) : (
                    /* DECKS LIST GRID */
                    precons.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">
                            No precons found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {precons.map(p => (
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
