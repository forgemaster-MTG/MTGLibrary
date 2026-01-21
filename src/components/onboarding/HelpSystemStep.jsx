import React from 'react';
import { HelpCircle, Map, BookOpen } from 'lucide-react';

export const HelpSystemStep = ({ onNext, onBack }) => {
    return (
        <div className="text-center max-w-4xl animate-fade-in-up w-full px-4">
            <h2 className="text-4xl font-black text-white mb-6 tracking-tight">Master the Forge</h2>
            <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
                We've built a powerful system, but you don't have to learn it alone.
                Our integrated help tools are always one click away.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {/* Feature 1: Contextual Help */}
                <div className="bg-gray-800/40 border border-gray-700/50 p-8 rounded-3xl hover:bg-gray-800/60 transition-all hover:-translate-y-1 group">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform">
                        <HelpCircle size={32} className="text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">The Oracle</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        Click the <span className="inline-block p-1 bg-gray-700 rounded mx-1">?</span> icon anywhere to ask questions about the current page or your collection.
                    </p>
                </div>

                {/* Feature 2: Tours */}
                <div className="bg-gray-800/40 border border-gray-700/50 p-8 rounded-3xl hover:bg-gray-800/60 transition-all hover:-translate-y-1 group">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform">
                        <Map size={32} className="text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Interactive Tours</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        Lost? Launch a <strong>Tour</strong> from the help menu to get a step-by-step walkthrough of any page's features.
                    </p>
                </div>

                {/* Feature 3: Documentation */}
                <div className="bg-gray-800/40 border border-gray-700/50 p-8 rounded-3xl hover:bg-gray-800/60 transition-all hover:-translate-y-1 group">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform">
                        <BookOpen size={32} className="text-amber-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Expert Guides</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        Access detailed guides and strategies directly within the app. No need to open a thousand tabs.
                    </p>
                </div>
            </div>

            <div className="flex justify-between items-center max-w-md mx-auto">
                <button
                    onClick={onBack}
                    className="px-6 py-3 text-gray-500 font-bold hover:text-white transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    className="px-10 py-4 bg-white text-black rounded-xl font-black text-lg tracking-wide hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)]"
                >
                    Let's Build Decks →
                </button>
            </div>
        </div>
    );
};
