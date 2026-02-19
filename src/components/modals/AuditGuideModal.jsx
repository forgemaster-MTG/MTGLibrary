import React from 'react';
import { createPortal } from 'react-dom';

const AuditGuideModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose} />
            <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-gradient-to-r from-primary-900 to-gray-900 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-500/20 rounded-xl text-primary-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Audit & Verification Guide</h2>
                            <p className="text-gray-400 text-xs flex items-center gap-2">
                                Audit The Forge to verify your collection.
                                <span className="text-[9px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded uppercase tracking-wider border border-green-500/30">Requires Wizard Tier</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

                    {/* Section 1: Neutral Starting State */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</span>
                            Neutral Starting State
                        </h3>
                        <p className="text-gray-300 text-sm leading-relaxed mb-4">
                            Every card starts in a "pending" state. We assume your collection matches your records until you verify it.
                        </p>
                        <div className="bg-gray-800/40 p-4 rounded-2xl border border-white/5">
                            <h4 className="text-white font-bold mb-1 flex items-center gap-2">⚪ Pending</h4>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Gray border. The input is locked. You must choose to Match or flag a Mismatch to continue.
                            </p>
                        </div>
                    </section>

                    {/* Section 2: Quick Verification Actions */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs">2</span>
                            Quick Verification
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-green-900/10 p-4 rounded-2xl border border-green-500/20">
                                <h4 className="text-green-300 font-bold mb-1 flex items-center gap-2">✅ Match (Check)</h4>
                                <p className="text-xs text-green-200/60 leading-relaxed">
                                    Instantly marks the card as reviewed and verified. Confirms you have exactly the expected amount.
                                </p>
                            </div>
                            <div className="bg-red-900/10 p-4 rounded-2xl border border-red-500/20">
                                <h4 className="text-red-300 font-bold mb-1 flex items-center gap-2">❌ Mismatch (X)</h4>
                                <p className="text-xs text-red-200/60 leading-relaxed">
                                    Flags a discrepancy. Sets count to 0 and unlocks the input so you can type the correct physical count.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Finalizing & Syncing */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">3</span>
                            Finalizing Your Audit
                        </h3>
                        <p className="text-gray-300 text-sm leading-relaxed mb-4">
                            Once you've touched every card in a section (Deck or Set), mark it as "Finished".
                        </p>
                        <div className="bg-black/40 p-4 rounded-xl border border-primary-500/30">
                            <p className="text-xs text-primary-300 font-medium">
                                When the entire audit is complete, use the **Finalize Audit** button in the Hub. This will sync all your Mismatches to your actual collection database, ensuring your digital records match your physical boxes.
                            </p>
                        </div>
                    </section>

                    {/* Section 4: Pro Tips */}
                    <section className="bg-gradient-to-br from-primary-900/40 to-purple-900/40 p-6 rounded-3xl border border-primary-500/20">
                        <h3 className="text-lg font-bold text-white mb-2">💡 Pro Tips</h3>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="text-xl">🔍</div>
                                <div>
                                    <h5 className="text-white font-bold text-xs uppercase tracking-wider">Discrepancy Report</h5>
                                    <p className="text-xs text-gray-300">Use the report table in the Audit Hub to see exactly what changed before you finalize.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="text-xl">📱</div>
                                <div>
                                    <h5 className="text-white font-bold text-xs uppercase tracking-wider">Mobile Friendly</h5>
                                    <p className="text-xs text-gray-300">The Audit Wizard is optimized for phone use. Carry your phone to your bulk boxes for easy scanning!</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-6 bg-gray-950 border-t border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl transition-all font-black text-sm shadow-xl shadow-primary-900/20 active:scale-95"
                    >
                        Start Auditing
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AuditGuideModal;
