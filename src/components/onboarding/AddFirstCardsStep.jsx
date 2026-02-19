import React, { useState } from 'react';
import { Search, PlusSquare } from 'lucide-react';
import OnboardingPreconSearch from './OnboardingPreconSearch';
import FeatureTour from '../common/FeatureTour';

export const AddFirstCardsStep = ({ onNext, onManualEntry }) => {
    const [view, setView] = useState('selection'); // 'selection' | 'precon'
    const [isTourOpen, setIsTourOpen] = useState(false);

    const TOUR_STEPS = [
        {
            target: '#precon-search-input',
            title: 'Search Database',
            content: 'Type the name of any official Magic: The Gathering product. Try "Commander" or a set name.'
        },
        {
            target: '#precon-import-btn',
            title: 'One-Click Import',
            content: 'Once you select a deck, click here to instantly add all valid cards (and prints!) to your collection.'
        }
    ];

    const handlePreconSuccess = (deck) => {
        // Delay slightly for effect
        setTimeout(() => {
            onNext();
        }, 1500);
    };

    return (
        <div className="w-full max-w-5xl animate-fade-in-up px-4 mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-2 text-center tracking-tight">
                {view === 'selection' ? "Start Your Collection" : "Find Your Deck"}
            </h2>
            <p className="text-gray-400 text-center mb-10 max-w-2xl mx-auto">
                {view === 'selection'
                    ? "Your vault is empty. Let's add your first cards."
                    : "Search our database of official preconstructed decks."}
            </p>

            {view === 'selection' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                    {/* Option 1: Manual */}
                    <button
                        onClick={onManualEntry}
                        className="group relative overflow-hidden bg-gradient-to-br from-gray-900 to-[#0c0d15] border border-gray-800 hover:border-primary-500 rounded-3xl p-8 text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(79,70,229,0.2)] flex flex-col h-full"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative z-10 w-20 h-20 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary-500/20 group-hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all duration-300">
                            <PlusSquare size={40} className="text-primary-400 group-hover:text-primary-300 drop-shadow-lg" />
                        </div>

                        <div className="relative z-10">
                            <h3 className="text-3xl font-black text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-primary-400 group-hover:to-cyan-300 transition-all">
                                Add Manually
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed mb-8 font-medium">
                                Have loose cards or a custom binder? Use our fast search to add them one by one.
                            </p>
                        </div>

                        <div className="mt-auto relative z-10 flex items-center gap-2 text-primary-400 font-bold text-sm tracking-widest uppercase group-hover:gap-4 transition-all duration-300">
                            Go to Collection <span>→</span>
                        </div>
                    </button>

                    {/* Option 2: Precon */}
                    <button
                        onClick={() => {
                            setView('precon');
                            setTimeout(() => setIsTourOpen(true), 1000);
                        }}
                        className="group relative overflow-hidden bg-gradient-to-br from-gray-900 to-[#120a15] border border-gray-800 hover:border-purple-500 rounded-3xl p-8 text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(168,85,247,0.2)] flex flex-col h-full"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative z-10 w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-purple-500/20 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-300">
                            <Search size={40} className="text-purple-400 group-hover:text-purple-300 drop-shadow-lg" />
                        </div>

                        <div className="relative z-10">
                            <h3 className="text-3xl font-black text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-300 transition-all">
                                Import Precon
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed mb-8 font-medium">
                                Bought a Commander deck or Structure Deck? Find it and add all 100 cards instantly.
                            </p>
                        </div>

                        <div className="mt-auto relative z-10 flex items-center gap-2 text-purple-400 font-bold text-sm tracking-widest uppercase group-hover:gap-4 transition-all duration-300">
                            Search Database <span>→</span>
                        </div>
                    </button>
                </div>
            )}

            {view === 'selection' && (
                <div className="mt-12 text-center">
                    <button
                        onClick={onNext}
                        className="text-gray-500 hover:text-white transition-colors text-sm font-medium hover:underline underline-offset-4"
                    >
                        Skip for now, I'll figure it out later
                    </button>
                </div>
            )}

            {
                view === 'precon' && (
                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
                        <button
                            onClick={() => {
                                setView('selection');
                                setIsTourOpen(false);
                            }}
                            className="mb-6 flex items-center text-gray-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider"
                        >
                            ← Back to Options
                        </button>

                        <OnboardingPreconSearch onDeckAdded={handlePreconSuccess} />
                    </div>
                )
            }

            <FeatureTour
                steps={TOUR_STEPS}
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                tourId="onboarding_precon_tour"
            />
        </div >
    );
};
