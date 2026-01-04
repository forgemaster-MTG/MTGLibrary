import React from 'react';
import { createPortal } from 'react-dom';

const BinderGuideModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose} />
            <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-gradient-to-r from-indigo-900 to-gray-900 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Binder Management Guide</h2>
                            <p className="text-gray-400 text-xs">Organize your collection like a pro.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                    {/* Section 1: Creation Methods */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</span>
                            Two Ways to Build
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-800/40 p-4 rounded-2xl border border-white/5">
                                <h4 className="text-white font-bold mb-1 flex items-center gap-2">📁 Manual Binder</h4>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Classic storage. You drag and drop exactly which cards go inside. Great for mirroring your physical binders.
                                </p>
                            </div>
                            <div className="bg-indigo-900/10 p-4 rounded-2xl border border-indigo-500/20">
                                <h4 className="text-indigo-300 font-bold mb-1 flex items-center gap-2">✨ Smart Binder</h4>
                                <p className="text-xs text-indigo-200/60 leading-relaxed">
                                    Live automation. You set rules (like "Price &gt; $10"), and the binder automatically grabs matching cards from your collection.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: AI Smart Creator */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">2</span>
                            AI Smart Creator
                        </h3>
                        <p className="text-gray-300 text-sm leading-relaxed mb-4">
                            Don't want to build rules manually? Just describe what you want in plain English!
                        </p>
                        <div className="bg-black/40 p-4 rounded-xl border border-indigo-500/30 mb-4">
                            <p className="font-mono text-xs text-gray-400 mb-2">Try prompts like:</p>
                            <ul className="space-y-2 text-sm text-indigo-300 font-medium">
                                <li>"All my red goblins over $5"</li>
                                <li>"Cards to trade that I have duplicates of"</li>
                                <li>"High value commanders not in any decks"</li>
                            </ul>
                        </div>
                        <p className="text-xs text-gray-500">
                            The AI detects price, color, type, quantity, rarity, and even whether a card is currently used in a deck.
                        </p>
                    </section>

                    {/* Section 3: Rules & Filters */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs">3</span>
                            Advanced Logic (In Deck, Quantity)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-800/40 p-3 rounded-xl border border-white/5">
                                <h5 className="text-green-400 font-bold text-xs uppercase mb-1">In Deck Status</h5>
                                <p className="text-xs text-gray-400">
                                    Filter cards based on usage. Create a "Trade Binder" by excluding cards that are currently <span className="text-white font-mono">In Deck = True</span>.
                                </p>
                            </div>
                            <div className="bg-gray-800/40 p-3 rounded-xl border border-white/5">
                                <h5 className="text-green-400 font-bold text-xs uppercase mb-1">Quantity Control</h5>
                                <p className="text-xs text-gray-400">
                                    Filter by how many copies you own. Great for finding <span className="text-white font-mono">Count &gt; 4</span> (Duplicates).
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 4: Pro Tips */}
                    <section className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 p-6 rounded-3xl border border-indigo-500/20">
                        <h3 className="text-lg font-bold text-white mb-2">💡 Pro Tips</h3>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="text-xl">🎨</div>
                                <div>
                                    <h5 className="text-white font-bold text-xs uppercase tracking-wider">Custom Style</h5>
                                    <p className="text-xs text-gray-300">Use any Hex Code color and pick from hundreds of icons (including MTG Mana Symbols) to make your binder pop.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="text-xl">⚡</div>
                                <div>
                                    <h5 className="text-white font-bold text-xs uppercase tracking-wider">Live Updates</h5>
                                    <p className="text-xs text-gray-300">Smart Binders are alive. When you add a new card to your collection that matches the rules, it instantly appears in the binder.</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-6 bg-gray-950 border-t border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all font-black text-sm shadow-xl shadow-indigo-900/20 active:scale-95"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BinderGuideModal;
