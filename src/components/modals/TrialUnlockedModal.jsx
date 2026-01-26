import React from 'react';
import { createPortal } from 'react-dom';

const TrialUnlockedModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-fade-in" />

            {/* Modal Content */}
            <div className="relative bg-gray-900 border border-yellow-500/30 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(234,179,8,0.2)] animate-bounce-in text-center overflow-hidden">

                {/* Background Effects */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-yellow-500/10 to-transparent" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700" />

                <div className="relative z-10 space-y-6">
                    {/* Icon */}
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <span className="text-4xl">🎉</span>
                    </div>

                    {/* Title */}
                    <div>
                        <h2 className="text-3xl font-black text-white mb-2">
                            Wizard Trial <span className="text-yellow-400">Unlocked!</span>
                        </h2>
                        <p className="text-gray-300">
                            Welcome to the inner circle. You have full access for the next <strong className="text-white">7 days</strong>.
                        </p>
                    </div>

                    {/* Features List */}
                    <div className="bg-gray-800/50 rounded-xl p-4 text-left space-y-3 border border-gray-700">
                        <div className="flex items-center gap-3">
                            <span className="text-green-400">✓</span>
                            <span className="text-gray-200 text-sm">Unlimited Deck Building</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-green-400">✓</span>
                            <span className="text-gray-200 text-sm">AI Deck Doctor & Strategy</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-green-400">✓</span>
                            <span className="text-gray-200 text-sm">Custom AI Companion</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-green-400">✓</span>
                            <span className="text-gray-200 text-sm">Collection Price Tracking</span>
                        </div>
                    </div>

                    {/* Button */}
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Ignite Your Spark &rarr;
                    </button>

                    <p className="text-xs text-gray-500">
                        Don't worry, we won't charge you automatically.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TrialUnlockedModal;
