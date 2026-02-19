import React from 'react';
import Navbar from '../components/Navbar';

const AboutPage = () => {
    return (
        <div className="min-h-screen bg-gray-900 pb-20">
            {/* Hero Section */}
            <div className="relative py-20 overflow-hidden">
                <div className="absolute inset-0 bg-primary-900/10"></div>
                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
                        About The Forge
                    </h1>
                    <p className="text-xl text-gray-400 leading-relaxed">
                        Built by players, for players. The Forge is designed to be the ultimate companion for Magic: The Gathering deck building and collection management.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-6 space-y-16">

                {/* AI Philosophy Section */}
                <section className="space-y-6 animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="w-8 h-1 bg-amber-500 rounded-full"></span>
                        The Human Factor
                    </h2>
                    <div className="bg-gray-800/50 p-8 rounded-3xl border border-amber-500/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <svg className="w-64 h-64 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        </div>
                        <div className="relative z-10 space-y-4">
                            <h3 className="text-xl font-bold text-white">AI is a Tool, Not a Replacement</h3>
                            <div className="space-y-4 text-gray-300 leading-relaxed">
                                <p>
                                    At The Forge, we believe AI can be an incredible creative partner. It can scan thousands of cards
                                    in seconds, find obscure combos, and suggest perfectly curved land bases.
                                </p>
                                <p>
                                    <strong className="text-amber-400">However, AI is still a work in progress.</strong> It can hallucinate interactions,
                                    suggest banned cards, or miss the subtle "fun factor" that makes a Commander deck truly special.
                                </p>
                                <p>
                                    We built these tools to get you 80% of the way there. The final 20%—the soul of the deck—comes from you.
                                    Use our suggestions as a starting point, but trust your intuition and knowledge to build something truly unique.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Credits Section */}
                <section className="space-y-8 animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="w-8 h-1 bg-primary-500 rounded-full"></span>
                        Powered By
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Scryfall */}
                        <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer" className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 hover:border-primary-500 hover:bg-gray-800 transition-all group">
                            <div className="text-primary-400 mb-4 group-hover:scale-110 transition-transform origin-left">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Scryfall</h3>
                            <p className="text-gray-400 text-sm">
                                The best MTG card database in the world. All card data and imagery is provided by their incredible API.
                            </p>
                        </a>

                        {/* TCGPlayer */}
                        <a href="https://tcgplayer.com" target="_blank" rel="noopener noreferrer" className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 hover:border-green-500 hover:bg-gray-800 transition-all group">
                            <div className="text-green-400 mb-4 group-hover:scale-110 transition-transform origin-left">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">TCGPlayer</h3>
                            <p className="text-gray-400 text-sm">
                                Real-time pricing data for card values. Keeping your collection valuation accurate and up to date.
                            </p>
                        </a>

                        {/* WotC */}
                        <a href="https://magic.wizards.com" target="_blank" rel="noopener noreferrer" className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 hover:border-orange-500 hover:bg-gray-800 transition-all group">
                            <div className="text-orange-400 mb-4 group-hover:scale-110 transition-transform origin-left">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Wizards of the Coast</h3>
                            <p className="text-gray-400 text-sm">
                                Creators of Magic: The Gathering. All mana symbols, card names, and art are copyright WotC.
                            </p>
                        </a>
                    </div>
                </section>

                {/* Contact Section */}
                <section className="space-y-8 animate-fade-in-up delay-100">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="w-8 h-1 bg-purple-500 rounded-full"></span>
                        Get in Touch
                    </h2>
                    <div className="bg-gradient-to-br from-primary-900/20 to-purple-900/20 p-8 rounded-3xl border border-white/5 relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="space-y-4 text-center md:text-left">
                                <h3 className="text-2xl font-bold text-white">Join the Community</h3>
                                <p className="text-gray-400 max-w-md">
                                    Have a feature request? Found a bug? Or just want to show off your latest brew?
                                    Come chat with us on Discord.
                                </p>
                            </div>
                            <a
                                href="https://discord.gg/your-discord-link" // Replace with actual link from user request or placeholder if not provided
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-primary-500/25 flex items-center gap-3 transform hover:-translate-y-1"
                            >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" /></svg>
                                Join Discord
                            </a>
                        </div>
                    </div>
                </section>

                {/* Legal Footer */}
                <div className="text-center text-gray-600 text-xs pt-20">
                    <p>
                        The Forge is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards.
                        Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
                    </p>
                </div>

            </div>
        </div>
    );
};

export default AboutPage;
