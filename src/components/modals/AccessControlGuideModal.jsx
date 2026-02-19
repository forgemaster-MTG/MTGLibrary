import React from 'react';
import { createPortal } from 'react-dom';
import { Disclosure } from '@headlessui/react';
import { ChevronUpIcon } from '@heroicons/react/24/solid';

const AccessControlGuideModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose} />
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-gradient-to-r from-primary-900 to-gray-900 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-500/20 rounded-lg text-primary-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Access Control Guide</h2>
                            <p className="text-gray-400 text-xs">Everything you need to know about Pods & Permissions.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                    {/* Section 1: The Pod */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</span>
                            What is a "Pod"?
                        </h3>
                        <p className="text-gray-300 text-sm leading-relaxed mb-4">
                            In Magic: The Gathering, a "Pod" is your local playgroup. On Forge, it represents your list of <strong>Trusted Connections</strong>.
                            Linking accounts with someone in your Pod allows you to share digital resources instantly.
                        </p>
                        <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl">
                            <p className="text-blue-200 text-sm font-medium">
                                💡 Pro Tip: Only add people you actually know and trust to your Pod.
                            </p>
                        </div>
                    </section>

                    {/* Section 2: Permission Levels */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">2</span>
                            Permission Levels
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                <span className="text-primary-400 font-black uppercase text-xs tracking-wider">Default</span>
                                <h4 className="text-white font-bold text-lg mb-2">Viewer</h4>
                                <ul className="space-y-2 text-sm text-gray-400">
                                    <li className="flex gap-2"><span className="text-green-400">✓</span> View Private Decks</li>
                                    <li className="flex gap-2"><span className="text-green-400">✓</span> View Collection</li>
                                    <li className="flex gap-2"><span className="text-green-400">✓</span> Download/Clone Decks</li>
                                    <li className="flex gap-2"><span className="text-red-400">✗</span> Edit Decks</li>
                                    <li className="flex gap-2"><span className="text-red-400">✗</span> Change Settings</li>
                                </ul>
                            </div>
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                <span className="text-purple-400 font-black uppercase text-xs tracking-wider">Advanced</span>
                                <h4 className="text-white font-bold text-lg mb-2">Editor</h4>
                                <ul className="space-y-2 text-sm text-gray-400">
                                    <li className="flex gap-2"><span className="text-green-400">✓</span> Everything in Viewer</li>
                                    <li className="flex gap-2"><span className="text-green-400">✓</span> <strong>Add/Remove Cards</strong> from Decks</li>
                                    <li className="flex gap-2"><span className="text-green-400">✓</span> Add Cards to Collection</li>
                                    <li className="flex gap-2"><span className="text-red-400">✗</span> Delete Decks</li>
                                    <li className="flex gap-2"><span className="text-red-400">✗</span> Manage Account</li>
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
                        <p className="text-gray-300 text-sm leading-relaxed mb-4">
                            When building a deck, you can choose to see cards from your friends' collections.
                            This is perfect for brewing "Team Decks" or borrowing cards you don't own.
                        </p>
                        <div className="bg-gray-800 p-4 rounded-lg text-sm text-gray-400 border border-gray-700">
                            <strong>How to use:</strong> In the Deck Builder, open the "Sources" dropdown and select a friend's collection to see their cards alongside yours.
                        </div>
                    </section>

                    {/* Section 4: Safety */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs">4</span>
                            Safety & Revoking
                        </h3>
                        <p className="text-gray-300 text-sm leading-relaxed">
                            You are always in control. You can revoke access at any time from this menu or the Settings page.
                            Revoking access is <strong>immediate</strong>. The other user will be disconnected from your session instantly.
                        </p>
                        <div className="mt-4 flex gap-4">
                            <div className="flex-1 p-3 bg-red-900/10 border border-red-500/10 rounded-lg">
                                <h5 className="font-bold text-red-400 text-xs uppercase mb-1">They Cannot</h5>
                                <p className="text-xs text-gray-400">Delete your account, change your password, or permanently delete your cards/decks.</p>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-6 bg-gray-950 border-t border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors font-bold text-sm shadow-lg"
                    >
                        Got it, thanks!
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AccessControlGuideModal;
