import React, { useState } from 'react';
import BinderGuideModal from './modals/BinderGuideModal';
import PodGuideModal from './modals/PodGuideModal';
import QRShareModal from './modals/QRShareModal';
import AuditGuideModal from './modals/AuditGuideModal';

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
        <section id="features" className="py-32 bg-transparent relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-24 animate-fade-in-up">
                    <span className="text-indigo-400 font-bold tracking-widest uppercase text-sm mb-2 block">The Forge Advantage</span>
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
                        AI-First Strategy.<br />Professional Results.
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-xl">
                        Experience the first Magic: The Gathering ecosystem built around Actionable Intelligence.
                    </p>
                </div>

                {/* 1. The AI Deck Doctor (New First Feature) */}
                <div className="flex flex-col md:flex-row items-center gap-16 mb-32">
                    <div className="flex-1 space-y-8 animate-fade-in-left">
                        <div className="w-20 h-20 bg-orange-500/20 rounded-3xl flex items-center justify-center mb-4 text-orange-400 ring-1 ring-orange-500/20">
                            <span className="text-4xl">🩺</span>
                        </div>
                        <h3 className="text-4xl font-black text-white leading-tight">The AI Deck Doctor</h3>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            Stop guessing your deck's power level. Our surgical analysis engine provides a precise <span className="text-white">1-5 Bracket Rating</span>, a granular 10-point power score, and card-for-card "Surgical Swaps" to optimize your curve.
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
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(249,115,22,0.3)] border border-orange-500/20 group animate-fade-in-right">
                        <div className="aspect-video bg-gray-950 relative flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent"></div>
                            {/* Visual representation of the bracket UI from the modal */}
                            <div className="w-full h-full bg-gray-900 rounded-3xl border border-white/5 p-8 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Calculated Power</div>
                                        <div className="text-5xl font-black text-white">7.42</div>
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-black border border-orange-500/30 uppercase tracking-widest">Optimized</div>
                                </div>
                                <div className="space-y-4">
                                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full w-[74%] bg-gradient-to-r from-orange-500 to-amber-400"></div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 italic">"Highly efficient win-conditions detected. Vulnerable to early interaction."</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. AI-Powered Strategy (Moved up) */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-16 mb-32">
                    <div className="flex-1 space-y-8 animate-fade-in-right">
                        <div className="w-20 h-20 bg-indigo-500/20 rounded-3xl flex items-center justify-center mb-4 text-indigo-400 ring-1 ring-indigo-500/20">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-4xl font-black text-white leading-tight">AI Strategy Analyst</h3>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            Don't just build lists—forge legends. Our Gemini-integrated AI acts as a dedicated coach, analyzing synergies and suggesting win conditions tailored to your playstyle.
                        </p>
                        <ul className="space-y-4 text-gray-300">
                            <li className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs">✓</div>
                                Automated Theme Suggestions
                            </li>
                            <li className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs">✓</div>
                                Intelligent Land Base Generation
                            </li>
                        </ul>
                    </div>
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-2xl border border-indigo-500/20 animate-fade-in-left">
                        <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                            <img
                                src="/images/features/ai-strategy-modal.png"
                                alt="AI Strategy Modal showing detailed deck analysis"
                                className="w-full h-full object-cover opacity-90"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Custom AI Personas (Shared with Strategist) */}
                <div className="flex flex-col md:flex-row items-center gap-16 mb-32">
                    <div className="flex-1 space-y-8 animate-fade-in-left">
                        <div className="w-20 h-20 bg-pink-500/20 rounded-3xl flex items-center justify-center mb-4 text-pink-400 ring-1 ring-pink-500/20">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-4xl font-black text-white leading-tight">Custom AI Personas</h3>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            Define your assistant's tone and expertise. Whether you need a ruthless "Deity" to optimize your curve or a chaotic "Goblin" to suggest fun jank, your AI companion adapts to <em>your</em> soul.
                        </p>
                    </div>
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-2xl border border-pink-500/20 animate-fade-in-right">
                        <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                            <img
                                src="/images/features/custom-ai-persona.png"
                                alt="Custom AI Persona creation interface"
                                className="w-full h-full object-cover opacity-90"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Collaborative Pods (Previously Connect & Organize) */}
                <div className="flex flex-col md:flex-row-reverse items-center gap-16 mb-32">
                    <div className="flex-1 space-y-8 animate-fade-in-right">
                        <div className="w-20 h-20 bg-purple-500/20 rounded-3xl flex items-center justify-center mb-4 text-purple-400 ring-1 ring-purple-500/20">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <h3 className="text-4xl font-black text-white leading-tight">Rule Your "Pod"</h3>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            Magic is a social game. Link accounts with your playgroup to browse friends' collections, manage shared trades, and coordinate group power levels instantly.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => setActiveFeature('pods')} className="px-6 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm font-bold hover:bg-purple-500/20 transition-all">Explore Pods</button>
                            <button onClick={() => setActiveFeature('qr')} className="px-6 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-bold hover:bg-blue-500/20 transition-all">Quick Share</button>
                        </div>
                    </div>
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-2xl border border-purple-500/20 bg-gray-950 p-12">
                        <div className="grid grid-cols-2 gap-6 w-full h-full opacity-80">
                            <div className="bg-indigo-900/30 rounded-2xl border border-indigo-500/20 p-6 flex flex-col items-center justify-center">
                                <div className="text-5xl mb-3">✨</div>
                                <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Smart Binder</div>
                            </div>
                            <div className="bg-purple-900/30 rounded-2xl border border-purple-500/20 p-6 flex flex-col items-center justify-center">
                                <div className="text-5xl mb-3">🤝</div>
                                <div className="text-xs font-bold text-purple-300 uppercase tracking-widest">Pod Trade</div>
                            </div>
                            <div className="bg-blue-900/30 rounded-2xl border border-blue-500/20 p-6 flex flex-col items-center justify-center">
                                <div className="text-5xl mb-3">📱</div>
                                <div className="text-xs font-bold text-blue-300 uppercase tracking-widest">QR Share</div>
                            </div>
                            <div className="bg-green-900/30 rounded-2xl border border-green-500/20 p-6 flex flex-col items-center justify-center">
                                <div className="text-5xl mb-3">🛡️</div>
                                <div className="text-xs font-bold text-green-300 uppercase tracking-widest">Audits</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. Foundation (Collection Tracking) */}
                <div className="flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8 animate-fade-in-left">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 text-blue-400">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <h3 className="text-3xl font-bold text-white leading-tight">The Professional Foundation</h3>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            Underneath the AI intelligence is a robust engine for cataloging your digital life. Fast scanning, accurate pricing, and comprehensive management for any format.
                        </p>
                    </div>
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 bg-gray-800/20 group">
                        <img
                            src="/images/features/collection-dashboard.jpg"
                            alt="Collection Dashboard"
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                        />
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

            <AuditGuideModal
                isOpen={activeFeature === 'audit'}
                onClose={() => setActiveFeature(null)}
            />
        </section >
    );
};

export default FeaturesSection;
