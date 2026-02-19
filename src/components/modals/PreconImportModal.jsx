import React from 'react';
import { createPortal } from 'react-dom';

const PreconImportModal = ({ isOpen, onClose, onConfirm, ownership }) => {
    if (!isOpen) return null;

    const { ownedCards, totalCards, percentOwned } = ownership;

    // Create prompt content
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-primary-500/30 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up">

                {/* Header */}
                <div className="p-6 border-b border-gray-800 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        Import Deck Options
                    </h2>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Ownership Status */}
                    <div className="bg-primary-900/10 border border-primary-500/20 rounded-xl p-4">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">Ownership</span>
                            <span className="text-primary-300 font-mono font-bold">{percentOwned}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                            <div
                                className="bg-primary-500 h-2 rounded-full transition-all duration-1000"
                                style={{ width: `${percentOwned}%` }}
                            />
                        </div>
                        <p className="text-gray-300 text-sm">
                            You already own <strong className="text-white">{ownedCards}</strong> of the <strong className="text-white">{totalCards}</strong> cards in this deck.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-white font-bold text-sm">How would you like to proceed?</h3>

                        {/* Option 1: Use Existing */}
                        <button
                            onClick={() => onConfirm(true)}
                            className="w-full flex items-start text-left p-4 rounded-xl border border-primary-500/30 bg-primary-900/10 hover:bg-primary-900/20 transition-all group"
                        >
                            <div className="mt-1 shrink-0 w-6 h-6 rounded-full border-2 border-primary-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white group-hover:text-primary-300 transition-colors">Use Existing Cards</h4>
                                <p className="text-xs text-gray-400 mt-1">
                                    Moves cards from your collection (Binder) into this deck. Best for organizing your physical collection.
                                </p>
                            </div>
                        </button>

                        {/* Option 2: Add New */}
                        <button
                            onClick={() => onConfirm(false)}
                            className="w-full flex items-start text-left p-4 rounded-xl border border-gray-700 bg-gray-800/30 hover:bg-gray-800 hover:border-gray-600 transition-all group"
                        >
                            <div className="mt-1 shrink-0 w-6 h-6 rounded-full border-2 border-gray-600 flex items-center justify-center mr-4 group-hover:border-gray-500 transition-colors">
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-300 group-hover:text-white transition-colors">Add New Copies</h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    Adds fresh copies of all cards to your collection. Select this if you bought a new boxed Precon.
                                </p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PreconImportModal;
