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
        <div className="w-full max-w-5xl animate-fade-in-up px-4">
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
                        className="group relative bg-gray-800/50 hover:bg-gray-800 border-2 border-transparent hover:border-indigo-500 rounded-3xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col h-full"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <PlusSquare size={32} className="text-indigo-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Add Manually</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Have loose cards or a custom binder? Use our fast search to add them one by one.
                        </p>
                        <div className="mt-auto flex items-center text-indigo-400 font-bold text-sm tracking-wide">
                            GO TO COLLECTION →
                        </div>
                    </button>

                    {/* Option 2: Precon */}
                    <button
                        onClick={() => {
                            setView('precon');
                            setTimeout(() => setIsTourOpen(true), 1000); // Start tour after transition
                        }}
                        className="group relative bg-gray-800/50 hover:bg-gray-800 border-2 border-transparent hover:border-purple-500 rounded-3xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col h-full"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Search size={32} className="text-purple-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Import Precon</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Bought a Commander deck or Structure Deck? Find it and add all 100 cards instantly.
                        </p>
                        <div className="mt-auto flex items-center text-purple-400 font-bold text-sm tracking-wide">
                            SEARCH DATABASE →
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
