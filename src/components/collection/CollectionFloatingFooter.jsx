import React from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';

const CollectionFloatingFooter = ({
    isVisible,
    searchTerm,
    setSearchTerm,
    showFilters,
    setShowFilters,
    isSelectionMode,
    toggleSelectionMode,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    totalCount,
    selectedCount,
    scrollToTop
}) => {
    const { userProfile } = useAuth();

    if (!isVisible) return null;

    return createPortal(
        <div className="fixed bottom-[84px] left-0 right-0 z-[100] p-4 animate-slide-up-fast pointer-events-none">
            <div className="max-w-4xl mx-auto bg-gray-900/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-3 flex items-center gap-3 pointer-events-auto">

                {/* Search (Compact) */}
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-950/50 border border-gray-700 text-white pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder-gray-500"
                    />
                    <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>

                {/* Sort Toggle (Compact) */}
                <div className="flex bg-gray-950/50 rounded-xl border border-gray-700 p-0.5">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-transparent border-none text-white text-xs font-bold px-2 py-1.5 focus:ring-0 cursor-pointer"
                    >
                        <option value="added_at">Date</option>
                        <option value="name">Name</option>
                        <option value="price">Price</option>
                        <option value="cmc">CMC</option>
                        <option value="power">Power</option>
                        <option value="toughness">Tough</option>
                        <option value="rarity">Rarity</option>
                        <option value="set">Set</option>
                    </select>
                    <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="px-2 border-l border-gray-700 text-gray-400 hover:text-white transition-colors"
                    >
                        {sortOrder === 'asc' ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
                        ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                        )}
                    </button>
                </div>

                {/* Filters Toggle */}
                <button
                    onClick={() => {
                        setShowFilters(!showFilters);
                        if (!showFilters) scrollToTop();
                    }}
                    className={`p-2 rounded-xl border transition-all ${showFilters
                            ? 'bg-primary-600 border-primary-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                        }`}
                    title="Toggle Filters"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                </button>

                {/* Selection Mode */}
                <button
                    onClick={() => {
                        toggleSelectionMode();
                        if (!isSelectionMode) scrollToTop();
                    }}
                    className={`p-2 rounded-xl border transition-all ${isSelectionMode
                            ? 'bg-primary-600 border-primary-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                        }`}
                    title="Select Cards"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </button>

                {/* Scroll Top */}
                <button
                    onClick={scrollToTop}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 hover:text-white border border-gray-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                </button>

            </div>
            {/* Count Badge (Floating above) */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border border-primary-400 pointer-events-auto">
                {selectedCount > 0 ? `${selectedCount} Selected` : `${totalCount} Cards`}
            </div>
        </div>,
        document.body
    );
};

export default CollectionFloatingFooter;
