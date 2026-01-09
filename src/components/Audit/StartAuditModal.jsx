import React from 'react';
import { createPortal } from 'react-dom';

const StartAuditModal = ({ isOpen, onClose, onConfirm, type, targetId, loading, activeSession }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-gray-900/90 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden">
                {/* Glassy Background Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 pointer-events-none" />

                <div className="p-8 relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl border border-indigo-500/30 text-indigo-400">
                            📋
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Start {type.charAt(0).toUpperCase() + type.slice(1)} Audit</h2>
                            <p className="text-gray-400 text-sm">Verify your physical ownership</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        {activeSession ? (
                            <div className="border border-red-500/30 bg-red-900/20 p-4 rounded-xl">
                                <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    Previous Audit In Progress
                                </h3>
                                <p className="text-sm text-gray-300">
                                    You have an active <strong>{activeSession.type}</strong> audit. Starting this new audit will <strong>cancel and delete</strong> the existing session.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5">
                                <h3 className="text-sm font-bold text-white mb-2">How it works:</h3>
                                <ul className="space-y-2 text-sm text-gray-300">
                                    <li className="flex gap-2">
                                        <span className="text-indigo-400">1.</span>
                                        <span>We'll create a snapshot of your current digital list.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-indigo-400">2.</span>
                                        <span>You'll verify each card physically.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-indigo-400">3.</span>
                                        <span>Finalize to reconcile any differences.</span>
                                    </li>
                                </ul>
                            </div>
                        )}

                        {!activeSession && (
                            <div className="flex items-center gap-3 text-sm text-blue-400 bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>Only one active audit allowed. This will be your active session.</span>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={`px-6 py-2 font-bold rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-50 ${activeSession ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'}`}
                        >
                            {loading ? 'Starting...' : activeSession ? 'Overwrite & Start' : 'Begin Audit'}
                            {!loading && <span className="opacity-70">→</span>}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default StartAuditModal;
