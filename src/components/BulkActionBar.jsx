import React, { useState } from 'react';

const BulkActionBar = ({
    selectedCount,
    totalCount,
    onSelectAll,
    onDeselectAll,
    onDelete,
    onMove,
    onExport,
    decks = [],
    isAllSelected
}) => {
    const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);

    if (selectedCount === 0 && !isAllSelected) return null;

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[60] bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4 animate-bounce-in">
            <div className="flex items-center gap-2 border-r border-gray-700 pr-4">
                <span className="text-white font-bold bg-primary-600 px-2 py-0.5 rounded-full text-xs">
                    {selectedCount}
                </span>
                <span className="text-gray-300 text-sm font-medium">Selected</span>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={isAllSelected ? onDeselectAll : onSelectAll}
                    className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors text-xs uppercase font-bold tracking-wider"
                >
                    {isAllSelected ? 'Deselect All' : 'Select All'}
                </button>

                <div className="h-4 w-px bg-gray-700 mx-2" />

                {/* Move Action */}
                <div className="relative">
                    <button
                        onClick={() => setIsMoveMenuOpen(!isMoveMenuOpen)}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all text-sm font-bold"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        Move to Deck
                    </button>
                    {isMoveMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto z-50">
                            {decks.length > 0 ? (
                                decks.map(deck => (
                                    <button
                                        key={deck.id}
                                        onClick={() => {
                                            onMove(deck.id);
                                            setIsMoveMenuOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-primary-900/30 text-gray-300 hover:text-primary-300 border-b border-gray-800 last:border-0 text-sm transition-colors"
                                    >
                                        {deck.name}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-3 text-gray-500 text-sm italic">No decks found</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Export Action */}
                <button
                    onClick={onExport}
                    className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all"
                    title="Export JSON"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>

                {/* Delete Action */}
                <button
                    onClick={onDelete}
                    className="p-2 bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all border border-red-500/20 hover:border-red-500/50"
                    title="Delete Selected"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
    );
};

export default BulkActionBar;
