import React, { useState } from 'react';
import BinderGuideModal from './modals/BinderGuideModal';
import PodGuideModal from './modals/PodGuideModal';
import QRShareModal from './modals/QRShareModal';

const FeatureCard = ({ title, description, icon }) => (
    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 hover:border-indigo-500/50 transition-all hover:bg-gray-800 group">
        <div className="w-12 h-12 bg-indigo-900/50 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{description}</p>
    </div>
);

const FeaturesSection = () => {
    const [activeFeature, setActiveFeature] = useState(null);

    return (
        <section id="features" className="py-20 bg-gray-900 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-20 animate-fade-in-up">
                    <span className="text-indigo-400 font-bold tracking-widest uppercase text-sm mb-2 block">Why Choose The Forge?</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
                        More Than Just A Deck Builder
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                        Experience the next generation of Magic: The Gathering tools. Powered by AI, designed for every player.
                    </p>
                </div>

                {/* 1. Advanced Collection Tracking */}
                <div className="flex flex-col md:flex-row items-center gap-12 mb-24">
                    <div className="flex-1 space-y-6 animate-fade-in-left">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 text-blue-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <h3 className="text-3xl font-bold text-white">Advanced Collection Tracking</h3>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Track every card you own, from foils to promos. Filter by set, rarity, color identity, and price. Manage your "Wishlist" separate from your main binder.
                        </p>
                        <ul className="space-y-3 text-gray-300">
                            <li className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Real-time TCGPlayer Pricing
                            </li>
                            <li className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                CSV Export & Import
                            </li>
                        </ul>
                    </div>
                    <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 animate-fade-in-right">
                        <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                            <img
                                src="/images/features/collection-dashboard.jpg"
                                alt="Collection Dashboard showing card grid"
                                className="w-full h-full object-cover rounded-2xl opacity-90 hover:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Connect & Organize */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-12 mb-24">
                    <div className="flex-1 space-y-6 animate-fade-in-right">
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4 text-indigo-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <h3 className="text-3xl font-bold text-white">Connect & Organize</h3>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Go beyond solo collection. Link accounts with your playgroup ("Pods") to browse friends' trades instantly. Share your builds with the world via dynamic QR Codes.
                        </p>
                        <div className="space-y-4 relative">
                            <p className="absolute -top-6 right-0 text-[10px] text-gray-500 font-medium uppercase tracking-wider animate-pulse">Click to preview guides</p>
                            <button
                                onClick={() => setActiveFeature('smart')}
                                className="w-full bg-gray-800/50 p-4 rounded-xl border border-white/5 flex flex-col items-start gap-2 hover:bg-gray-800 hover:border-indigo-500/30 transition-all cursor-pointer group text-left relative overflow-hidden"
                            >
                                <h4 className="text-white font-bold mb-1 flex items-center gap-2 group-hover:text-indigo-400 transition-colors">
                                    <span className="text-xl">✨</span> Smart Binders
                                </h4>
                                <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors pr-6">AI automatically sorts cards into binders based on your rules.</p>
                                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 text-indigo-500">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                </div>
                            </button>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setActiveFeature('pods')}
                                    className="bg-gray-800/50 p-4 rounded-xl border border-white/5 text-left hover:bg-gray-800 hover:border-purple-500/30 transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    <h4 className="text-white font-bold mb-1 flex items-center gap-2 group-hover:text-purple-400 transition-colors">
                                        <span className="text-xl">🤝</span> Pods
                                    </h4>
                                    <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors pr-4">Link with friends for real-time trading.</p>
                                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 text-purple-500">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveFeature('qr')}
                                    className="bg-gray-800/50 p-4 rounded-xl border border-white/5 text-left hover:bg-gray-800 hover:border-blue-500/30 transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    <h4 className="text-white font-bold mb-1 flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                                        <span className="text-xl">📱</span> QR Share
                                    </h4>
                                    <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors pr-4">Showcase deck lists instantly.</p>
                                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 text-blue-500">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 animate-fade-in-left">
                        <div className="aspect-video bg-gray-800 relative flex items-center justify-center p-8">
                            <div className="grid grid-cols-2 gap-4 w-full h-full opacity-80">
                                <div className="bg-indigo-900/30 rounded-xl border border-indigo-500/20 p-4 flex flex-col items-center justify-center">
                                    <div className="text-4xl mb-2">✨</div>
                                    <div className="text-xs font-bold text-indigo-300 uppercase">Smart Binder</div>
                                </div>
                                <div className="bg-purple-900/30 rounded-xl border border-purple-500/20 p-4 flex flex-col items-center justify-center">
                                    <div className="text-4xl mb-2">🤝</div>
                                    <div className="text-xs font-bold text-purple-300 uppercase">Pod Trade</div>
                                </div>
                                <div className="bg-blue-900/30 rounded-xl border border-blue-500/20 p-4 flex flex-col items-center justify-center">
                                    <div className="text-4xl mb-2">📱</div>
                                    <div className="text-xs font-bold text-blue-300 uppercase">QR Share</div>
                                </div>
                                <div className="bg-gray-800/50 rounded-xl border border-white/5 p-4 flex flex-col items-center justify-center">
                                    <div className="text-4xl mb-2">👥</div>
                                    <div className="text-xs font-bold text-gray-400 uppercase">Friend List</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. AI-Powered Strategy */}
                <div className="flex flex-col md:flex-row items-center gap-12 mb-24">
                    <div className="flex-1 space-y-6 animate-fade-in-left">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-4 text-purple-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-3xl font-bold text-white">AI-Powered Strategy</h3>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Don't just build lists—build strategies. Our Gemini-integrated AI analyzes your commander and suggests synergies, mana curves, and win conditions tailored to your playstyle.
                        </p>
                        <ul className="space-y-3 text-gray-300">
                            <li className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Automated Theme Suggestions
                            </li>
                            <li className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Intelligent Land Base Generation
                            </li>
                        </ul>
                    </div>
                    <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 group animate-fade-in-right">
                        <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                            <img
                                src="/images/features/ai-strategy-modal.png"
                                alt="AI Strategy Modal showing detailed deck analysis"
                                className="w-full h-full object-cover rounded-2xl opacity-90 group-hover:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Custom AI Personas */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-12 mb-24">
                    <div className="flex-1 space-y-6 animate-fade-in-right">
                        <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center mb-4 text-pink-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-3xl font-bold text-white">Custom AI Personas</h3>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Forge your own assistant. Define their personality, tone, and expertise. Whether you need a ruthless "Deity" to optimize your curve or a chaotic "Goblin" to suggest fun jank, your AI companion adapts to <em>your</em> goals.
                        </p>
                    </div>
                    <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 animate-fade-in-left">
                        <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                            <img
                                src="/images/features/custom-ai-persona.png"
                                alt="Custom AI Persona creation interface"
                                className="w-full h-full object-cover rounded-2xl opacity-90 hover:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>
                </div>

                {/* 5. Format Flexible Design */}
                <div className="flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1 space-y-6 animate-fade-in-left">
                        <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-4 text-orange-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <h3 className="text-3xl font-bold text-white">Format Flexible Design</h3>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Built mainly for Commander, but ready for everything else. Full support for <strong>Standard</strong>, <strong>Modern</strong>, and <strong>Pioneer</strong> is built into the core.
                        </p>
                        <ul className="space-y-3 text-gray-300">
                            <li className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Commander Partners & Backgrounds
                            </li>
                            <li className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Sideboard & Companion Support
                            </li>
                            <li className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Future Format Updates Planned
                            </li>
                        </ul>
                    </div>
                    <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 animate-fade-in-right">
                        <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                            <img
                                src="/images/features/commander-centric-design.png"
                                alt="My Decks view showing commanders"
                                className="w-full h-full object-cover rounded-2xl opacity-90 hover:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>
                </div>

            </div>


            <BinderGuideModal
                isOpen={activeFeature === 'smart'}
                onClose={() => setActiveFeature(null)}
            />

            <PodGuideModal
                isOpen={activeFeature === 'pods'}
                onClose={() => setActiveFeature(null)}
            />

            <QRShareModal
                isOpen={activeFeature === 'qr'}
                onClose={() => setActiveFeature(null)}
            />
        </section >
    );
};

export default FeaturesSection;
