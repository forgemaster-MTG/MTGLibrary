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
        <div className="flex flex-col min-h-screen relative">
            {/* Immersive Background (Fixed) */}
            <div className="fixed inset-0 z-0 overflow-hidden">
                {/* Desktop Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center hidden md:block"
                    style={{ backgroundImage: 'url(/MTG-Forge_Logo_Background.png)' }}
                ></div>
                {/* Mobile Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center md:hidden"
                    style={{ backgroundImage: 'url(/MTG-Forge_Logo_Background_mobile.png)' }}
                ></div>

                {/* 
                    Gradient layers to ensure readability:
                    - Black overlay at the very top for the banner area
                    - Semi-transparent gray-950/80 for the main content area (more viewable than before)
                    - Fades into the footer at the bottom
                */}
                <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950/80 to-black z-10"></div>

                {/* Growing Ethereal Accents (Subtle movement or fixed glow) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] bg-indigo-600/10 blur-[150px] rounded-full z-0 opacity-40"></div>
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-orange-500/5 blur-[120px] rounded-full z-0 opacity-20"></div>
            </div>


            {/* Alpha Warning Banner */}
            <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 text-white text-center py-2 px-4 shadow-lg z-50 relative animate-pulse-slow">
                <p className="font-bold text-sm tracking-wide flex items-center justify-center gap-2">
                    <span className="text-lg">🚧</span>
                    ALPHA TEST - Feature Complete but Experimental
                    <span className="text-lg">🚧</span>
                </p>
            </div>

            {/* Hero Section */}
            <div className="relative z-10 bg-transparent min-h-[80vh] flex flex-col items-center">

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 md:py-48 flex flex-col items-center text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8 animate-fade-in">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest leading-none">The Future of MTG Strategy</span>
                    </div>

                    <h1 className="text-5xl md:text-8xl font-black tracking-tight text-white mb-8 leading-tight">
                        The Forge: Where Decks<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 filter drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                            Become Legends
                        </span>
                    </h1>

                    <p className="max-w-2xl text-xl md:text-2xl text-gray-400 mx-auto font-medium leading-relaxed mb-12">
                        Brew Smarter. Play Harder. Your <span className="text-white">AI-Powered Strategic Edge</span>.
                        Join the next generation of Magic: The Gathering intelligence.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-6 justify-center w-full max-w-lg">
                        <Link to="/dashboard" className="group relative px-10 py-5 rounded-2xl bg-indigo-600 text-white font-black text-xl transition-all shadow-[0_20px_40px_-15px_rgba(79,70,229,0.5)] hover:shadow-[0_25px_50px_-12px_rgba(79,70,229,0.6)] transform hover:-translate-y-1 hover:scale-[1.02] flex items-center justify-center gap-3">
                            <span>Enter The Forge</span>
                            <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </Link>
                        <button className="px-10 py-5 rounded-2xl bg-white/5 backdrop-blur-xl hover:bg-white/10 text-white font-bold text-lg border border-white/10 transition-all hover:border-white/20">
                            Watch AI Demo
                        </button>
                    </div>

                    {/* Meta Stats or Quick Info */}
                    <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-4xl border-t border-white/5 pt-12">
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-white mb-1">99.8%</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Analysis Accuracy</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-white mb-1">25k+</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Decks Optimized</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-white mb-1">5</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Bracket Tiers</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-white mb-1">AI</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Driven Meta</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Features & Content (Scrolls over background) */}
            <div className="relative z-10">
                <FeaturesSection />
            </div>

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
