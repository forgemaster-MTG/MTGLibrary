import React, { useState } from 'react';

const BADGES = [
    { id: 'alpha_tester', label: 'Alpha Tester', icon: '🧪', description: 'Restoring balance to the multiverse.' },
    { id: 'bug_hunter', label: 'Bug Hunter', icon: '🕷️', description: 'Tracking down pests in the code.' },
    { id: 'architect', label: 'Architect', icon: '🏛️', description: 'Building the foundation of the future.' },
    { id: 'spark_ignited', label: 'Spark Ignited', icon: '✨', description: 'First to walk the planes.' },
    { id: 'data_scryer', label: 'Data Scryer', icon: '🔮', description: 'Analyzing the meta streams.' },
    { id: 'stress_tester', label: 'Stress Tester', icon: '🔨', description: 'Breaking things so we can fix them.' },
    { id: 'feedback_loop', label: 'Feedback Loop', icon: '🔄', description: 'Iterating towards perfection.' },
    { id: 'void_gazer', label: 'Void Gazer', icon: '👁️', description: 'Staring into the console logs.' }
];

const BadgeSelectionModal = ({ isOpen, onClose, currentBadgeId, onSelect, isMaster }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto w-full h-full flex items-center justify-center md:pl-[250px]">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-scale-in">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500">🛡️</span> Customize Your Badge
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">Select a badge to display next to your profile.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {BADGES.filter(b => b.id !== 'architect' || isMaster).map(badge => (
                            <button
                                key={badge.id}
                                onClick={() => onSelect(badge)}
                                className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${currentBadgeId === badge.id
                                    ? 'bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500/50'
                                    : 'bg-gray-800/30 border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                                    }`}
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-2xl shadow-inner border border-gray-700">
                                    {badge.icon}
                                </div>
                                <div>
                                    <h3 className={`font-bold ${currentBadgeId === badge.id ? 'text-indigo-300' : 'text-white'}`}>
                                        {badge.label}
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1">{badge.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-gray-800/50 border-t border-gray-800 text-center text-xs text-gray-500">
                    Thank you for being an early supporter of MTG-Forge.
                </div>
            </div>
        </div>
    );
};

export default BadgeSelectionModal;
