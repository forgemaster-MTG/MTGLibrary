import React, { useState } from 'react';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, targetName }) => {
    const [confirmText, setConfirmText] = useState('');
    const isMatched = confirmText === 'DELETE';

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-red-900/20 transform transition-all scale-100">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">
                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">{title || 'Confirm Deletion'}</h3>
                        <p className="text-red-400 text-sm font-medium">This action cannot be undone.</p>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <p className="text-gray-300 leading-relaxed">
                        {message}
                    </p>
                    {targetName && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <span className="text-red-200 text-sm">Target: </span>
                            <span className="text-white font-mono font-bold">{targetName}</span>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Type <span className="text-white font-mono">DELETE</span> to confirm
                        </label>
                        <input
                            type="text"
                            className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors font-mono"
                            placeholder="DELETE"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!isMatched}
                        className={`flex-1 px-4 py-3 font-bold rounded-xl transition-all shadow-lg ${isMatched
                                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Delete Forever
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;
