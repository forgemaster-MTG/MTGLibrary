import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { FunnelIcon } from '@heroicons/react/24/solid';

const CommanderSearchModal = ({ isOpen, onClose, onAdd }) => {
    const { addToast } = useToast();

    // Search State
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [addingInfo, setAddingInfo] = useState(null);

    // Advanced Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [colors, setColors] = useState([]); // ['W', 'U', etc]
    const [colorLogic, setColorLogic] = useState('and');
    const [oracleText, setOracleText] = useState('');
    const [cmcString, setCmcString] = useState('');

    const toggleColor = (c) => {
        setColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    };

    const handleSearch = async (e) => {
        e.preventDefault();

        // Allow empty name if filters are present
        const hasFilters = colors.length > 0 || oracleText.trim() || cmcString.trim();
        if (!query.trim() && !hasFilters) return;

        setSearching(true);
        try {
            // Parse CMC (simple parsing)
            let mvParam = null;
            if (cmcString.trim()) {
                const match = cmcString.trim().match(/^([<>]=?|=)?\s*(\d+)$/);
                if (match) {
                    mvParam = { operator: match[1] || '=', value: parseInt(match[2], 10) };
                }
            }

            const payload = {
                query: query,
                type: 'legendary creature', // Enforce
                text: oracleText,
                colors: colors.length > 0 ? colors : undefined,
                colorIdentity: true, // Identify as ID for commander search usually
                colorLogic: colorLogic, // 'and' means MUST have these colors
                mv: mvParam
            };

            const response = await api.post('/api/cards/search', payload);
            setResults(response.data || []);
        } catch (err) {
            console.error(err);
            addToast('Search failed. The Oracle is unreachable.', 'error');
        } finally {
            setSearching(false);
        }
    };

    const handleAdd = async (card) => {
        setAddingInfo({ id: card.id, name: card.name });
        try {
            const payload = {
                scryfall_id: card.id,
                name: card.name,
                set_code: card.set,
                collector_number: card.collector_number,
                finish: 'nonfoil',
                count: 1,
                data: card,
                is_wishlist: true
            };

            await api.post('/api/collection', payload);
            addToast(`"${card.name}" added to Wishlist!`, 'success');
            if (onAdd) onAdd();
            onClose();
        } catch (err) {
            console.error(err);
            addToast('Failed to add to wishlist.', 'error');
        } finally {
            setAddingInfo(null);
        }
    };

    if (!isOpen) return null;

    const colorMap = {
        W: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', symbol: 'https://svgs.scryfall.io/card-symbols/W.svg' },
        U: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', symbol: 'https://svgs.scryfall.io/card-symbols/U.svg' },
        B: { bg: 'bg-gray-300', text: 'text-gray-800', border: 'border-gray-400', symbol: 'https://svgs.scryfall.io/card-symbols/B.svg' },
        R: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', symbol: 'https://svgs.scryfall.io/card-symbols/R.svg' },
        G: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', symbol: 'https://svgs.scryfall.io/card-symbols/G.svg' }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-gray-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col border border-white/10 overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-gray-950/50 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <span className="text-purple-400">Summon Legend</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 uppercase tracking-wider border border-purple-500/30">
                                Wishlist
                            </span>
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Search the multiverse for a commander you don't own yet.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Search & Filters Container */}
                <div className="bg-gray-900 border-b border-white/5 flex flex-col shrink-0">
                    <form onSubmit={handleSearch} className="p-6">
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search by name..."
                                    className="w-full bg-gray-950 border border-white/10 rounded-2xl py-4 pl-14 pr-14 text-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-inner"
                                    autoFocus={!showFilters}
                                />
                                <svg className="absolute left-5 top-5 w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                {query && (
                                    <button
                                        type="button"
                                        onClick={() => setQuery('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-4 rounded-2xl border border-white/10 flex items-center gap-2 font-bold transition-all ${showFilters ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-950 text-gray-400 hover:text-white hover:bg-gray-800'}`}
                            >
                                <FunnelIcon className="w-5 h-5" />
                                Filters
                            </button>
                            <button
                                type="submit"
                                disabled={searching}
                                className="px-8 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
                            >
                                {searching ? 'Searching...' : 'Search'}
                            </button>
                        </div>

                        {/* Advanced Filters */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showFilters ? 'max-h-96 opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                            <div className="bg-gray-950/50 rounded-2xl p-6 border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">

                                {/* Colors */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Color Identity</label>
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
                                    <div className="flex items-center gap-4 text-sm mt-2">
                                        <span className={`cursor-pointer ${colorLogic === 'or' ? 'text-purple-400 font-bold' : 'text-gray-600'}`} onClick={() => setColorLogic('or')}>Includes any (OR)</span>
                                        <div
                                            className="w-10 h-5 bg-gray-800 rounded-full relative cursor-pointer border border-white/10"
                                            onClick={() => setColorLogic(prev => prev === 'or' ? 'and' : 'or')}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-purple-500 transition-all ${colorLogic === 'and' ? 'left-5.5' : 'left-0.5'}`} />
                                        </div>
                                        <span className={`cursor-pointer ${colorLogic === 'and' ? 'text-purple-400 font-bold' : 'text-gray-600'}`} onClick={() => setColorLogic('and')}>Exact match (AND)</span>
                                    </div>
                                </div>

                                {/* Text & Type */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Oracle Text</label>
                                    <input
                                        type="text"
                                        value={oracleText}
                                        onChange={(e) => setOracleText(e.target.value)}
                                        placeholder="e.g. 'draw cards', 'counter'"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm"
                                    />
                                    <p className="text-[10px] text-gray-600">Searches abilities and rules text.</p>
                                </div>

                                {/* Stats */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mana Value (CMC)</label>
                                    <input
                                        type="text"
                                        value={cmcString}
                                        onChange={(e) => setCmcString(e.target.value)}
                                        placeholder="e.g. '4' or '<= 3'"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Results Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-950/30 custom-scrollbar">
                    {/* Empty State */}
                    {!searching && results.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                            <svg className="w-24 h-24 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                            <p className="text-xl font-bold text-gray-400">No legends found.</p>
                            <p className="text-sm text-gray-500">Try adjusting your filters.</p>
                        </div>
                    )}

                    {/* Results */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {results.map(card => {
                            const image = card.image_uris?.art_crop || card.image_uris?.normal || card.data?.image_uris?.art_crop || card.data?.image_uris?.normal;
                            const isAdding = addingInfo?.id === card.id;

                            return (
                                <div key={card.id} className="group relative bg-gray-900 rounded-2xl border border-white/5 overflow-hidden hover:border-purple-500/50 transition-all hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1">
                                    {/* Image */}
                                    <div className="h-60 w-full bg-black relative">
                                        {image ? (
                                            <img src={image} alt={card.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold">No Art</div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                                    </div>

                                    {/* Content */}
                                    <div className="p-4 relative">
                                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-300 transition-colors line-clamp-1">{card.name}</h3>
                                        <p className="text-xs text-gray-500 mb-4 line-clamp-1">{card.type_line}</p>

                                        <button
                                            onClick={() => handleAdd(card)}
                                            disabled={isAdding}
                                            className="w-full py-2 bg-white/5 hover:bg-purple-600 text-gray-300 hover:text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 group-hover:bg-purple-600 group-hover:text-white"
                                        >
                                            {isAdding ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                    Add to Wishlist
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.2); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(168, 85, 247, 0.4); }
            `}} />
        </div>,
        document.body
    );
};

export default CommanderSearchModal;
