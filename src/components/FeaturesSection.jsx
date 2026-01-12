import React, { useState } from 'react';
import BinderGuideModal from './modals/BinderGuideModal';
import PodGuideModal from './modals/PodGuideModal';
import QRShareModal from './modals/QRShareModal';
import AuditGuideModal from './modals/AuditGuideModal';

const FeaturesSection = () => {
    const [activeFeature, setActiveFeature] = useState(null);

    return (
        <section id="features" className="py-32 bg-transparent relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-24 animate-fade-in-up">
                    <span className="text-indigo-400 font-bold tracking-widest uppercase text-sm mb-2 block">The Forge Advantage</span>
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                        Actionable Intelligence.<br />Professional Results.
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-xl italic">
                        "Stop tracking cards. Start forging strategy."
                    </p>
                </div>

                {/* 1. The AI Deck Doctor */}
                <div className="flex flex-col md:flex-row items-center gap-16 mb-40">
                    <div className="flex-1 space-y-8 animate-fade-in-left">
                        <div className="w-20 h-20 bg-orange-500/20 rounded-3xl flex items-center justify-center mb-4 text-orange-400 ring-1 ring-orange-500/20">
                            <span className="text-4xl">🩺</span>
                        </div>
                        <h3 className="text-4xl font-black text-white leading-tight">The AI Deck Doctor</h3>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            Precision meets playability. Our surgical analysis engine provides a precise <span className="text-white">1-5 Bracket Rating</span>, a granular 10-point power score, and card-for-card "Surgical Swaps" to optimize your curve.
                        </p>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="p-4 bg-gray-800/30 rounded-2xl border border-white/5">
                                <div className="text-orange-400 font-bold text-sm uppercase tracking-widest mb-1">Brackets</div>
                                <div className="text-white text-lg font-bold">1-5 Scale</div>
                            </div>
                            <div className="p-4 bg-gray-800/30 rounded-2xl border border-white/5">
                                <div className="text-green-400 font-bold text-sm uppercase tracking-widest mb-1">Precision</div>
                                <div className="text-white text-lg font-bold">0.01 PL Step</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(249,115,22,0.3)] border border-orange-500/20 group animate-fade-in-right bg-gray-900/40 p-10 backdrop-blur-md">
                        <div className="space-y-6">
                            <div className="flex justify-between items-end">
                                <div>
                                    <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Calculated Power</div>
                                    <div className="text-5xl font-black text-white italic">7.42</div>
                                </div>
                                <div className="px-4 py-2 bg-orange-500/20 rounded-lg border border-orange-500/30 text-orange-400 font-black uppercase tracking-widest text-xs">
                                    Bracket 3
                                </div>
                            </div>
                            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 w-[74%]"></div>
                            </div>
                            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 italic text-gray-400 text-sm leading-relaxed">
                                "Your deck is highly efficient but lacks sufficient early-game interaction. At Bracket 3, you are vulnerable to faster combo strategies."
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. The Neural Architect (NEW - Deep Dive into building) */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-16 mb-40">
                    <div className="flex-1 space-y-8 animate-fade-in-right">
                        <div className="w-20 h-20 bg-indigo-500/20 rounded-3xl flex items-center justify-center mb-4 text-indigo-400 ring-1 ring-indigo-500/20 shadow-[0_0_30px_rgba(79,70,229,0.2)]">
                            <span className="text-4xl">🧠</span>
                        </div>
                        <h3 className="text-4xl font-black text-white leading-tight">The Neural Architect</h3>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            The first true <span className="text-white">Zero-to-Hero</span> deck builder. Select your Commander, and watch as the Architect synthesizes a full 100-card list while prioritizing the cards you already own.
                        </p>
                        <div className="space-y-4">
                            <div className="p-6 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 flex items-center gap-4 group hover:bg-indigo-600/20 transition-all">
                                <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 text-2xl font-bold">A</div>
                                <div>
                                    <div className="text-white font-black uppercase tracking-wider text-sm">Commander-Centric Synthesis</div>
                                    <div className="text-gray-400 text-sm">From your commander selection to a complete 100-card list in seconds.</div>
                                </div>
                            </div>
                            <div className="p-6 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 flex items-center gap-4 group hover:bg-indigo-600/20 transition-all">
                                <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 text-2xl font-bold">C</div>
                                <div>
                                    <div className="text-white font-black uppercase tracking-wider text-sm">Collection-Aware</div>
                                    <div className="text-gray-400 text-sm">Builds using cards you own first, minimizing proxy needs.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(79,70,229,0.3)] border border-indigo-500/20 group animate-fade-in-left bg-gray-900/40 p-10 backdrop-blur-md">
                        <div className="space-y-4">
                            <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">Neural Blueprint Generation</div>
                            {[
                                { t: "Commander", v: "Selected: Niv-Mizzet, Parun" },
                                { t: "Budget", v: "$50 (Utilizing Collection)" },
                                { t: "Power", v: "Target Bracket 3" }
                            ].map((spec, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{spec.t}</span>
                                    <span className="text-xs font-black text-indigo-400">{spec.v}</span>
                                </div>
                            ))}
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <div className="text-white font-bold mb-4 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                    Blueprint Complete: 100/100 Cards
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {[...Array(8)].map((_, i) => (
                                        <div key={i} className="h-1 bg-indigo-500/40 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-400 w-full animate-shimmer"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. AI Strategy Analyst */}
                <div className="flex flex-col md:flex-row items-center gap-16 mb-40">
                    <div className="flex-1 space-y-8 animate-fade-in-left">
                        <div className="w-20 h-20 bg-blue-500/20 rounded-3xl flex items-center justify-center mb-4 text-blue-400 ring-1 ring-blue-500/20">
                            <span className="text-4xl text-blue-400">📊</span>
                        </div>
                        <h3 className="text-4xl font-black text-white leading-tight">AI Strategy Analyst</h3>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            Don't just build lists—forge legends. Our Gemini-powered AI acts as a dedicated coach, analyzing synergies and suggesting win conditions tailored to your unique playstyle.
                        </p>
                        <div className="p-4 bg-gray-800/30 rounded-2xl border border-white/5">
                            <div className="text-blue-400 font-bold text-sm uppercase tracking-widest mb-1">Advisor Analysis</div>
                            <div className="text-white text-lg font-bold italic">"Your win rate against Aggro pods increases by 14% with these adjustments."</div>
                        </div>
                    </div>
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] border border-blue-500/20 group animate-fade-in-right">
                        <img src="/images/features/ai-strategy-modal.png" alt="AI Strategy Modal" className="w-full h-auto opacity-80 hover:opacity-100 transition-opacity duration-700" />
                    </div>
                </div>

                {/* 4. Collaborative Pods */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-16 mb-40">
                    <div className="flex-1 space-y-8 animate-fade-in-right">
                        <div className="w-20 h-20 bg-purple-500/20 rounded-3xl flex items-center justify-center mb-4 text-purple-400 ring-1 ring-purple-500/20">
                            <span className="text-4xl">🤝</span>
                        </div>
                        <h3 className="text-4xl font-black text-white leading-tight">Rule Your "Pod"</h3>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            Magic is a social game. Link accounts with your playgroup to browse friends' collections, manage shared trades, and coordinate group power levels instantly.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => setActiveFeature('pods')} className="px-8 py-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold hover:bg-purple-500/20 transition-all">Explore Pods</button>
                            <button onClick={() => setActiveFeature('qr')} className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all">Quick Share</button>
                        </div>
                    </div>
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(168,85,247,0.3)] border border-purple-500/20 group animate-fade-in-left bg-gray-950 p-12">
                        <div className="grid grid-cols-2 gap-6 w-full h-full">
                            <div className="bg-indigo-900/30 rounded-2xl border border-indigo-500/20 p-6 flex flex-col items-center justify-center group-hover:scale-105 transition-transform">
                                <div className="text-5xl mb-3">✨</div>
                                <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Smart Binder</div>
                            </div>
                            <div className="bg-purple-900/30 rounded-2xl border border-purple-500/20 p-6 flex flex-col items-center justify-center group-hover:scale-105 transition-transform delay-75">
                                <div className="text-5xl mb-3">🤝</div>
                                <div className="text-[10px] font-black text-purple-300 uppercase tracking-widest">Pod Trade</div>
                            </div>
                            <div className="bg-blue-900/30 rounded-2xl border border-blue-500/20 p-6 flex flex-col items-center justify-center group-hover:scale-105 transition-transform delay-100">
                                <div className="text-5xl mb-3">📱</div>
                                <div className="text-[10px] font-black text-blue-300 uppercase tracking-widest">QR Share</div>
                            </div>
                            <div className="bg-green-900/30 rounded-2xl border border-green-500/20 p-6 flex flex-col items-center justify-center group-hover:scale-105 transition-transform delay-150">
                                <div className="text-5xl mb-3">🛡️</div>
                                <div className="text-[10px] font-black text-green-300 uppercase tracking-widest">Audits</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Foundation (Collection Tracking) */}
                <div className="flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8 animate-fade-in-left">
                        <div className="w-16 h-16 bg-gray-500/20 rounded-2xl flex items-center justify-center mb-4 text-gray-400 ring-1 ring-white/10">
                            <span className="text-4xl">🏛️</span>
                        </div>
                        <h3 className="text-3xl font-black text-white leading-tight uppercase tracking-tight">The Professional Foundation</h3>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Underneath the AI intelligence is a robust engine for cataloging your digital life. Fast scanning, accurate pricing, and comprehensive management for any format.
                        </p>
                    </div>
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 bg-gray-800/20 group">
                        <img src="/images/features/collection-dashboard.jpg" alt="Collection Dashboard" className="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-opacity duration-700" />
                    </div>
                </div>
            </div>

            {/* Modals */}
            <BinderGuideModal isOpen={activeFeature === 'smart'} onClose={() => setActiveFeature(null)} />
            <PodGuideModal isOpen={activeFeature === 'pods'} onClose={() => setActiveFeature(null)} />
            <QRShareModal isOpen={activeFeature === 'qr'} onClose={() => setActiveFeature(null)} />
            <AuditGuideModal isOpen={activeFeature === 'audit'} onClose={() => setActiveFeature(null)} />
        </section>
    );
};

export default FeaturesSection;
