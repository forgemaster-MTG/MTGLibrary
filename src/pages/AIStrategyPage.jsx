import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Sparkles, Target, Zap, Users, BarChart3, ChevronRight, ArrowLeft } from 'lucide-react';

const AIStrategyPage = () => {
    return (
        <div className="min-h-screen bg-gray-950 text-white relative flex flex-col pt-16">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(30,27,75,0.2)_0%,transparent_70%)]"></div>
            </div>

            {/* Navigation / Header */}
            <div className="relative z-20 max-w-7xl mx-auto px-4 w-full py-8">
                <Link to="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors gap-2 group mb-12">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-bold uppercase tracking-widest text-xs">Back to The Forge</span>
                </Link>

                <div className="max-w-4xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 mb-6 text-primary-400">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Actionable Intelligence</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight">
                        The AI Strategic<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-500 to-orange-500">
                            Companion Guide
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-400 leading-relaxed font-medium max-w-2xl">
                        Stop tracking data. Start forging strategy. Explore the neural engines that give you the edge in every brew and every match.
                    </p>
                </div>
            </div>

            {/* Core Sections */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 py-24 space-y-48">

                {/* 0. The Neural Architect (NEW FLAGSHIP) */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-primary-600/30 blur-[80px] rounded-full scale-75 group-hover:scale-100 transition-transform duration-1000"></div>
                        <div className="relative bg-black/60 border border-white/10 rounded-[3rem] p-12 backdrop-blur-3xl shadow-2xl">
                            <div className="space-y-8">
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Neural Synthesis Engine</div>
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                </div>
                                <div className="space-y-4">
                                    <div className="text-sm font-bold text-gray-400 italic">"Architect, build me a Bracket 4 competitive deck around [Selected Commander], prioritize my collection first..."</div>
                                    <div className="h-[1px] w-full bg-white/10"></div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {[
                                            { l: "Analyzing Archetype...", s: "100%" },
                                            { l: "Mapping Collection Staples...", s: "84%" },
                                            { l: "Optimizing Mana Curve...", s: "92%" },
                                            { l: "Finalizing Deck List...", s: "Processing" }
                                        ].map((step, i) => (
                                            <div key={i} className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-gray-500">
                                                <span>{step.l}</span>
                                                <span className={step.s === '100%' ? 'text-green-400' : 'text-primary-400'}>{step.s}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-6 bg-primary-500/10 rounded-2xl border border-primary-500/20">
                                    <div className="text-white font-black text-lg mb-2">The Neural Architect</div>
                                    <div className="text-gray-400 text-sm leading-relaxed">
                                        Generating 100-card Commander list... <br />
                                        <span className="text-primary-300">62/100 Cards found in your collection.</span> <br />
                                        <span className="text-orange-300">38/100 Cards required for purchase.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-8">
                        <div className="w-20 h-20 bg-primary-500/20 rounded-3xl flex items-center justify-center text-primary-400 border border-primary-500/20 shadow-[0_0_40px_rgba(79,70,229,0.3)]">
                            <Zap className="w-10 h-10" />
                        </div>
                        <h2 className="text-5xl font-black leading-tight">Zero-to-Brews:<br />The Neural Architect</h2>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            While other sites give you a search bar, we give you a brain. The **Neural Architect** is the world's first AI engine that doesn't just suggest cards—it synthesizes entire, playable decks from your Commander selection.
                        </p>
                        <ul className="space-y-6">
                            {[
                                { t: "Commander-Centric Synthesis", d: "Select your Commander and target a specific power bracket for a precision brew." },
                                { t: "Collection-Aware logic", d: "The AI builds around what you own, drastically reducing the cost of new brews." },
                                { t: "Bracket-Targeting", d: "Specify exactly which pod power level you want to compete in." }
                            ].map((item, i) => (
                                <li key={i} className="flex gap-4">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-[10px] font-black border border-primary-500/30 shrink-0">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <div className="text-white font-bold">{item.t}</div>
                                        <div className="text-gray-500 text-sm">{item.d}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* 1. The Deck Doctor */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8 order-2 lg:order-1">
                        <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-400 border border-orange-500/20">
                            <Brain className="w-8 h-8" />
                        </div>
                        <h2 className="text-4xl font-black">The AI Deck Doctor</h2>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Traditional deck-building tools treat your list like a static file. The **Deck Doctor** treats it like a living strategy. It uses advanced neural analysis to evaluate not just individual cards, but the synergistic web they form.
                        </p>

                        <div className="space-y-6">
                            <h3 className="text-xl font-bold flex items-center gap-3">
                                <Target className="w-5 h-5 text-primary-400" />
                                The 1-5 Bracket System
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { t: "Bracket 1", d: "Casual/Precon: Narrative focus." },
                                    { t: "Bracket 3", d: "High Power: Efficient execution." },
                                    { t: "Bracket 5", d: "Maximum Power: Competitive meta." },
                                    { t: "0.01 PL Step", d: "Precision tracking of deck shifts." }
                                ].map((item, i) => (
                                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="font-black text-primary-400 text-sm mb-1 uppercase tracking-wider">{item.t}</div>
                                        <div className="text-sm text-gray-400">{item.d}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="relative order-1 lg:order-2 group">
                        <div className="absolute inset-0 bg-primary-600/20 blur-[60px] rounded-full scale-75 group-hover:scale-100 transition-transform duration-1000"></div>
                        <div className="relative bg-gray-900/80 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl">
                            <div className="space-y-6">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Power Level</div>
                                        <div className="text-5xl font-black text-white">7.42</div>
                                    </div>
                                    <div className="px-4 py-2 bg-primary-500/20 rounded-lg border border-primary-500/30 text-primary-400 font-bold uppercase tracking-widest text-xs">
                                        Bracket 3
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-primary-500 via-purple-500 to-orange-500 w-[74%]"></div>
                                </div>
                                <div className="p-4 bg-black/40 rounded-2xl border border-white/5 italic text-gray-400 text-sm leading-relaxed">
                                    "Your deck is highly efficient but lacks sufficient early-game interaction. At Bracket 3, you are vulnerable to faster combo strategies."
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Surgical Swaps */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-orange-600/20 blur-[60px] rounded-full scale-75 group-hover:scale-100 transition-transform duration-1000"></div>
                        <div className="relative bg-gray-900/80 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl">
                            <div className="space-y-4">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Recommended Adjustments</div>
                                {[
                                    { out: "Murder", in: "Assassin's Trophy", reason: "Broadened threat coverage" },
                                    { out: "Sol Ring", in: "Mana Crypt", reason: "Maximum acceleration" }
                                ].map((swap, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl border border-white/5">
                                        <div className="flex-1">
                                            <div className="text-red-400 text-xs font-bold line-through">OUT: {swap.out}</div>
                                            <div className="text-green-400 text-sm font-bold mt-1">IN: {swap.in}</div>
                                        </div>
                                        <div className="text-[10px] text-gray-500 uppercase font-black">{swap.reason}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-8">
                        <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-400 border border-primary-500/20">
                            <Zap className="w-8 h-8" />
                        </div>
                        <h2 className="text-4xl font-black">Surgical Swaps</h2>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Stop buying proxies you don't need or spending money on cards that clash with your goals. Our AI scans your **available collection** in real-time to suggest surgical changes.
                        </p>
                        <ul className="space-y-4">
                            {[
                                "Find hidden staples already in your binders",
                                "Optimize curve without increasing budget",
                                "Identify over-committed resources"
                            ].map((text, i) => (
                                <li key={i} className="flex items-center gap-3 text-white font-medium">
                                    <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                                    {text}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* 3. AI Personas */}
                <section className="space-y-16">
                    <div className="text-center max-w-3xl mx-auto">
                        <h2 className="text-4xl font-black mb-6">Tactical Advisor Personas</h2>
                        <p className="text-xl text-gray-400">Different archetypes for different goals. Choose who critiques your brew.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { n: "Ruthless Optimizer", t: "Cedh Meta", icon: <BarChart3 className="w-6 h-6" />, color: "text-red-400", bg: "hover:border-red-500/30" },
                            { n: "Flavor Specialist", t: "Vorthos/Lore", icon: <Users className="w-6 h-6" />, color: "text-blue-400", bg: "hover:border-blue-500/30" },
                            { n: "Budget Engineer", t: "Cost Neutral", icon: <Sparkles className="w-6 h-6" />, color: "text-green-400", bg: "hover:border-green-500/30" },
                            { n: "Chaos Librarian", t: "Unique Tech", icon: <Brain className="w-6 h-6" />, color: "text-purple-400", bg: "hover:border-purple-500/30" }
                        ].map((p, i) => (
                            <div key={i} className={`p-8 bg-white/5 border border-white/10 rounded-3xl transition-all ${p.bg} group`}>
                                <div className={`w-12 h-12 mb-6 flex items-center justify-center bg-gray-900 rounded-xl ${p.color} border border-white/5 group-hover:scale-110 transition-transform`}>
                                    {p.icon}
                                </div>
                                <h4 className="text-lg font-black mb-1">{p.n}</h4>
                                <div className="text-xs font-bold uppercase tracking-widest text-gray-500">{p.t}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Final CTA */}
                <section className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-primary-600 to-purple-800 p-12 md:p-24 text-center">
                    <div className="absolute inset-0 bg-[url(/MTG-Forge_Logo_Background.png)] bg-cover bg-center mix-blend-overlay opacity-20"></div>
                    <div className="relative z-10 max-w-2xl mx-auto space-y-8">
                        <h2 className="text-4xl md:text-6xl font-black text-white leading-tight">Ready to Forge Your Legends?</h2>
                        <p className="text-xl text-primary-100 font-medium">Join the new generation of brewers using Actionable Intelligence to dominate their pods.</p>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
                            <Link to="/dashboard" className="px-10 py-5 bg-white text-primary-900 font-black rounded-2xl shadow-xl hover:scale-105 transition-all">
                                Enter The Forge
                            </Link>
                            <Link to="/pricing" className="px-10 py-5 bg-black/30 backdrop-blur-md text-white border border-white/20 font-black rounded-2xl hover:bg-black/40 transition-all">
                                View Pricing
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="relative z-10 py-24 border-t border-white/5 bg-gray-950 mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
                    <p className="text-gray-500 text-sm">© 2025 MTG-Forge. Not affiliated with Wizards of the Coast.</p>
                    <div className="flex justify-center gap-8 text-xs font-bold uppercase tracking-widest text-gray-600">
                        <Link to="/about" className="hover:text-white transition-colors">About</Link>
                        <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                        <Link to="/settings" className="hover:text-white transition-colors">Settings</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default AIStrategyPage;
