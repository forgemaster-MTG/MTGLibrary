import React from 'react';

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
    return (
        <section id="features" className="py-20 bg-gray-900 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-20 animate-fade-in-up">
                    <span className="text-indigo-400 font-bold tracking-widest uppercase text-sm mb-2 block">Why Choose The Forge?</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
                        More Than Just A Deck Builder
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                        Experience the next generation of Magic: The Gathering tools. Powered by AI, designed for Commander players.
                    </p>
                </div>

                {/* Feature 1: AI Deck Building */}
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

                {/* Feature 2: Collection Management */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-12 mb-24">
                    <div className="flex-1 space-y-6 animate-fade-in-right">
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
                    <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 animate-fade-in-left">
                        <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                            <img
                                src="/images/features/collection-dashboard.jpg"
                                alt="Collection Dashboard showing card grid"
                                className="w-full h-full object-cover rounded-2xl opacity-90 hover:opacity-100 transition-opacity"
                            />
                        </div>
                    </div>
                </div>

                {/* Feature 3: Commander Intelligence */}
                <div className="flex flex-col md:flex-row items-center gap-12 mb-24">
                    <div className="flex-1 space-y-6 animate-fade-in-left">
                        <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-4 text-orange-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        </div>
                        <h3 className="text-3xl font-bold text-white">Commander-Centric Design</h3>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Built specially for EDH. Browse legends by guild, shard, or wedge. Filter by color identity rules. Manage partners and backgrounds seamlessly.
                        </p>
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

                {/* Feature 4: Custom AI Personas */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-12">
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

            </div>
        </section>
    );
};

export default FeaturesSection;
