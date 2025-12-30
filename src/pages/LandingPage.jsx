import React from 'react';
import { Link } from 'react-router-dom';
import FeaturesSection from '../components/FeaturesSection';

// Note: In a real app, you might lazily load the image or use an optimized version.
// For now, we assume the artifact image is placed in/mapped to public or src/assets.
// Since we generated it as an artifact, we'll need to move it or Reference it.
// For this MVP step, I'll use a placeholder or CSS gradient if the image isn't moved yet.
// But I will write the code to assume it's available as a background class or style.

const LandingPage = () => {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Alpha Warning Banner */}
            <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 text-white text-center py-2 px-4 shadow-lg z-50 relative animate-pulse-slow">
                <p className="font-bold text-sm tracking-wide flex items-center justify-center gap-2">
                    <span className="text-lg">🚧</span>
                    ALPHA TEST - Feature Complete but Experimental
                    <span className="text-lg">🚧</span>
                </p>
            </div>

            {/* Hero Section */}
            <div className="relative bg-gray-900 border-b border-gray-800">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-black/60 z-10"></div>
                    <img
                        src="/MTG-Forge_Logo_Background_80.png"
                        alt="Background"
                        className="w-full h-full object-cover object-center absolute inset-0 z-0 opacity-80"
                    />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 flex flex-col items-center text-center">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
                        <span className="block">Master Your Collection</span>
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                            Build Powerful Decks
                        </span>
                    </h1>
                    <p className="mt-4 max-w-2xl text-xl text-gray-300 mx-auto">
                        The ultimate tool for Magic: The Gathering players. Organize your cards, analyze your mana curves, and playtest your strategies in one modern interface.
                    </p>
                    <div className="mt-10 flex gap-4 justify-center">
                        <Link to="/dashboard" className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-all shadow-lg shadow-indigo-500/30 transform hover:-translate-y-1">
                            Get Started
                        </Link>
                        <button className="px-8 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-lg border border-gray-700 transition-all">
                            Learn More
                        </button>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <FeaturesSection />

            {/* Footer */}
            <footer className="bg-black py-12 border-t border-gray-900 mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-gray-500">© 2025 MTG-Forge. Not affiliated with Wizards of the Coast.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
