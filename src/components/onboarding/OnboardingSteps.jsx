import React, { useState } from 'react';
import SubscriptionSelection from './SubscriptionSelection';
import { TIERS } from '../../config/tiers';

export const SubscriptionStep = ({ onNext, onBack, currentTier }) => {
    const [billingInterval, setBillingInterval] = useState('monthly');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubscribe = async (tierId) => {
        setIsLoading(true);
        // We pass the tierId and interval up to the page controller
        await onNext(tierId, billingInterval);
        setIsLoading(false);
    };

    return (
        <div className="max-w-7xl w-full text-center space-y-8 animate-fade-in-up">
            <div className="space-y-4 mb-8">
                <div className="w-20 h-20 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                    <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h2 className="text-4xl font-extrabold text-white">Choose Your Power Level</h2>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                    Unlock advanced deck building tools, unlimited storage, and AI-powered insights.
                </p>
            </div>

            <SubscriptionSelection
                billingInterval={billingInterval}
                setBillingInterval={setBillingInterval}
                onSubscribe={handleSubscribe}
                isLoading={isLoading}
                currentTier={currentTier || 'free'}
                showIntervalSelector={true}
            />

            <div className="flex justify-center pt-8">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="text-gray-500 hover:text-white transition-colors flex items-center gap-2"
                        disabled={isLoading}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Back
                    </button>
                )}
            </div>
        </div>
    );
};

export const WelcomeStep = ({ onNext }) => (
    <div className="max-w-2xl w-full text-center space-y-8 animate-fade-in-up">
        <div className="w-24 h-24 mx-auto bg-primary-500/20 rounded-full flex items-center justify-center ring-1 ring-primary-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
            <svg className="w-12 h-12 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
        </div>
        <div>
            <h2 className="text-4xl font-extrabold text-white mb-4">Welcome to MTG-Forge</h2>
            <p className="text-xl text-gray-300 leading-relaxed">
                Your ultimate companion for deck building, collection management, and magical optimization.
                <br />Let's get everything set up in just a few clicks.
            </p>
        </div>
        <button onClick={onNext} className="px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-primary-500/25 transition-all transform hover:-translate-y-1">
            Let's Go
        </button>
    </div>
);

export const SupportStep = ({ onNext, onBack }) => {
    return (
        <div className="max-w-4xl w-full space-y-8 animate-fade-in-up">
            <div className="text-center">
                <div className="w-20 h-20 mx-auto bg-pink-500/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
                    <svg className="w-10 h-10 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                </div>
                <h2 className="text-4xl font-black text-white mb-3">Support the Forge</h2>
                <p className="text-gray-400 max-w-lg mx-auto text-lg">
                    MTG-Forge is free for everyone during Alpha. If you love what we're building, consider a small donation to help us keep the servers running.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                <div className="bg-gray-800/40 border border-gray-700 rounded-3xl p-8 flex flex-col justify-between hover:border-pink-500/50 transition-colors group">
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <span className="text-primary-400">✨</span> Community Power
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Every donation goes directly towards API costs (Scryfall, Gemini) and server maintenance. You help us stay independent and ad-free.
                        </p>
                    </div>
                    <button
                        onClick={() => onNext('donate')}
                        className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl font-bold shadow-lg shadow-pink-500/20 transition-all transform hover:-translate-y-1"
                    >
                        Donate to Project
                    </button>
                </div>

                <div className="bg-gray-800/20 border border-gray-800 rounded-3xl p-8 flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-300 mb-4 flex items-center gap-2">
                            <span className="text-gray-500">🛡️</span> Free Access
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            You can still access all features for free. We value your feedback as an Alpha tester just as much as financial support.
                        </p>
                    </div>
                    <button
                        onClick={() => onNext('skip')}
                        className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-bold transition-all border border-gray-600"
                    >
                        Skip for Now
                    </button>
                </div>
            </div>

            <div className="flex justify-center pt-8">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="text-gray-500 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Back
                    </button>
                )}
            </div>
        </div>
    );
};

export const AISetupStep = ({ onNext, onBack }) => {
    const [apiKey, setApiKey] = useState('');
    // In future, this updates settings. For now just info/opt-in visually.
    return (
        <div className="max-w-3xl w-full space-y-8 animate-fade-in-up">
            <div className="text-center">
                <div className="w-20 h-20 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-purple-500/50">
                    <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Enable AI Architect</h2>
                <p className="text-gray-400 max-w-lg mx-auto">
                    Our AI analyzes your cards to suggest synergies, optimal mana curves, and complete deck strategies.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                    <h3 className="font-bold text-lg text-white mb-2 flex items-center gap-2">
                        <span className="text-green-400">✓</span> Automated Building
                    </h3>
                    <p className="text-sm text-gray-400">Generate entire commander decks from a single prompt or theme using your own collection.</p>
                </div>
                <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                    <h3 className="font-bold text-lg text-white mb-2 flex items-center gap-2">
                        <span className="text-green-400">✓</span> Synergy Scouting
                    </h3>
                    <p className="text-sm text-gray-400">Find hidden gems in your binder that perfectly match your commander's strategy.</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl text-left">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">ℹ️</span>
                        <div>
                            <h4 className="font-bold text-blue-200 mb-1">Why do I need my own API Key?</h4>
                            <p className="text-sm text-blue-100/80 leading-relaxed">
                                MTG-Forge connects directly to Google's Gemini AI to power its deck architect features.
                                To ensure usage, privacy, and zero rampingsubscription fees, we ask users to provide their own free API key.
                                Your key is stored locally on your device and is never shared with us.
                            </p>
                            <div className="mt-4 p-3 bg-primary-900/40 border border-primary-500/30 rounded-lg">
                                <h4 className="font-bold text-primary-200 mb-1 flex items-center gap-2">
                                    <span className="text-amber-400">⚠️</span> AI is Experimental
                                </h4>
                                <p className="text-sm text-gray-300">
                                    Our AI Architect is a powerful assistant, but <strong>YOU</strong> are the true deck builder.
                                    AI can suggest amazing synergies, but it can also make mistakes or suggest suboptimal cards.
                                    Always review and refine the suggestions to match your personal playstyle and meta.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 space-y-4 text-left">
                    <label className="block text-sm font-medium text-gray-300">
                        Enter your Gemini API Key
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    />
                    <div className="text-sm text-gray-400">
                        Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">Get a free key from Google AI Studio →</a>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="nav-button px-10 py-3 rounded-lg font-bold transition-all border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800/50"
                    >
                        Back
                    </button>
                )}
                <button
                    onClick={() => onNext(apiKey)}
                    disabled={!apiKey}
                    className={`nav-button px-10 py-3 rounded-lg font-bold transition-all shadow-lg transform hover:-translate-y-0.5 ${apiKey ? 'bg-purple-600 hover:bg-purple-500 text-white hover:shadow-purple-500/25' : 'bg-gray-700 text-gray-400 cursor-not-allowed shadow-none'}`}
                >
                    Save & Enable AI
                </button>
                <button
                    onClick={() => onNext(null)}
                    className="text-gray-500 text-sm hover:text-gray-300 underline transition-colors"
                >
                    Skip (Features Disabled)
                </button>
            </div>
        </div>
    );
};

export const WalkthroughStep = ({ onNext, onBack }) => {
    // Simple carousel or static guide
    const [slide, setSlide] = React.useState(0);
    const [showDetails, setShowDetails] = React.useState(false);

    const slides = [
        {
            title: "Manage Your Collection",
            desc: "Import cards, track values, and organize your entire library in one place.",
            details: [
                "Navigate to the 'Collection' page via the top navigation bar.",
                "Click the 'Add Cards' button to bulk add cards from CSV, text, or card scanner.",
                "Use the 'Binder' view to visually organize your cards by Set, Color, or Rarity.",
                "More organizational features coming soon, as in folders and custom groupings."
            ],
            icon: (
                <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            )
        },
        {
            title: "Build & Analyze Decks",
            desc: "Use the Architect Wizard to construct powerful decks with real-time stats and mana analysis.",
            details: [
                "Go to 'Decks' and click 'Create New Deck'.",
                "Choose your format: 'Commander' or 'Standard'.",
                "Select a Commander or Spotlight Card to anchor your strategy.",
                "Use the 'AI Architect' to generate suggested cards based on your themes.",
                "Review mana curves, color distribution, and type breakdowns in the 'Stats' tab."
            ],
            icon: (
                <svg className="w-16 h-16 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            )
        },
        {
            title: "Wishlist & Tracking",
            desc: "Keep track of cards you need and plan your next purchases directly from deck builds.",
            details: [
                "Search for any card in the database, even ones you don't own.",
                "Click the 'Heart' icon to add it to your Wishlist.",
                "When building decks, enable 'Theorycraft Mode' to include wishlist cards.",
                "View your shopping list in the 'Wishlist' tab of your Collection."
            ],
            icon: (
                <svg className="w-16 h-16 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            )
        }
    ];

    const current = slides[slide];

    const handleNextSlide = () => {
        if (slide < slides.length - 1) {
            setSlide(slide + 1);
            setShowDetails(false);
        } else {
            onNext();
        }
    };

    return (
        <div className="max-w-2xl w-full text-center space-y-10 animate-fade-in relative">
            <div className="h-80 flex flex-col items-center justify-center bg-gray-800/30 rounded-2xl border border-gray-700/50 p-8 relative overflow-hidden group">
                {/* Details Overlay */}
                <div className={`absolute inset-0 bg-gray-900/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 transition-all duration-300 ${showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span>📝</span> How it Works
                    </h3>
                    <ul className="space-y-4 text-left w-full max-w-md">
                        {current.details.map((step, idx) => (
                            <li key={idx} className="flex gap-3 text-gray-300 text-sm">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center font-bold text-xs border border-primary-500/30">{idx + 1}</span>
                                <span className="leading-relaxed">{step}</span>
                            </li>
                        ))}
                    </ul>
                    <button
                        onClick={() => setShowDetails(false)}
                        className="mt-8 text-sm text-gray-500 hover:text-white underline"
                    >
                        Close Details
                    </button>
                </div>

                <div key={slide} className="animate-fade-in-up flex flex-col items-center">
                    <div className="mb-6 opacity-90 transform group-hover:scale-110 transition-transform duration-500">{current.icon}</div>
                    <h2 className="text-3xl font-bold text-white mb-4">{current.title}</h2>
                    <p className="text-lg text-gray-400 max-w-md mb-6">{current.desc}</p>
                    <button
                        onClick={() => setShowDetails(true)}
                        className="text-sm font-bold text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors px-4 py-2 rounded-lg hover:bg-primary-500/10"
                    >
                        <span>View Walkthrough</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                </div>
            </div>

            <div className="flex flex-col items-center gap-6">
                <div className="flex gap-2">
                    {slides.map((_, i) => (
                        <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === slide ? 'w-8 bg-primary-500' : 'w-2 bg-gray-700'}`} />
                    ))}
                </div>

                <div className="flex gap-4 w-full sm:w-auto">
                    {onBack && (
                        <button
                            onClick={() => {
                                if (slide > 0) {
                                    setSlide(slide - 1);
                                    setShowDetails(false);
                                }
                                else onBack();
                            }}
                            className="px-6 py-3 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg font-bold transition-colors w-full sm:w-auto"
                        >
                            Back
                        </button>
                    )}
                    <button onClick={handleNextSlide} className="px-10 py-3 bg-white text-gray-900 hover:bg-gray-100 rounded-lg font-bold transition-colors w-full sm:w-auto">
                        {slide === slides.length - 1 ? "Finish Setup" : "Next Feature"}
                    </button>
                </div>
            </div>
        </div>
    );
};
