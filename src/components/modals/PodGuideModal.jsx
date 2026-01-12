import React from 'react';
import { createPortal } from 'react-dom';

const PodGuideModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose} />
            <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-gradient-to-r from-purple-900 to-gray-900 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Access Control Guide</h2>
                            <p className="text-gray-400 text-xs flex items-center gap-2">
                                For Pods & Permissions.
                                <span className="text-[9px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded uppercase tracking-wider border border-purple-500/30">Requires Wizard Tier</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                    {/* Section 1: What is a Pod? */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</span>
                            What is a "Pod"?
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4">
                            In Magic: The Gathering, a "Pod" is your local playgroup. On Forge, it represents your list of <strong className="text-white">Trusted Connections</strong>. Linking accounts with someone in your Pod allows you to share digital resources instantly.
                        </p>
                        <div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/20 flex items-center gap-3">
                            <span className="text-lg">💡</span>
                            <p className="text-xs text-indigo-300 font-bold">Pro Tip: Only add people you actually know and trust to your Pod.</p>
                        </div>
                    </section>

                    {/* Section 2: Permissions */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">2</span>
                            Permission Levels
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Viewer */}
                            <div className="bg-gray-800/40 p-4 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all">
                                <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider mb-2 block">Default</span>
                                <h4 className="text-white font-bold text-lg mb-4">Viewer</h4>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-xs text-gray-300">
                                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        View Private Decks
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-300">
                                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        View Collection
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-300">
                                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Download/Clone Decks
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-500 opacity-60">
                                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        Edit Decks
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-500 opacity-60">
                                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        Change Settings
                                    </li>
                                </ul>
                            </div>

                            {/* Editor */}
                            <div className="bg-gray-800/40 p-4 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all">
                                <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider mb-2 block">Advanced</span>
                                <h4 className="text-white font-bold text-lg mb-4">Editor</h4>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-xs text-gray-300">
                                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Everything in Viewer
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-white font-bold">
                                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Add/Remove Cards <span className="font-normal text-gray-400 ml-1">from Decks</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-green-300">
                                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Add Cards to Collection
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-500 opacity-60">
                                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        Delete Decks
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-500 opacity-60">
                                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        Manage Account
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Shared Collections */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs">3</span>
                            Shared Collections
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4">
                            When building a deck, you can choose to see cards from your friends' collections. This is perfect for brewing "Team Decks" or borrowing cards you don't own.
                        </p>
                        <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white ring-2 ring-indigo-500">You</div>
                                <div className="h-px bg-gray-600 w-8" />
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">P2</div>
                                <div className="h-px bg-gray-600 w-8" />
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">P3</div>
                            </div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Collaborative Deck Building</p>
                        </div>
                    </section>

                </div>

                <div className="p-6 bg-gray-950 border-t border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all font-black text-sm shadow-xl shadow-indigo-900/20 active:scale-95"
                    >
                        Got it, thanks!
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PodGuideModal;
