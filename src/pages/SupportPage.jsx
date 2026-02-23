import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import IssueTrackerModal from '../components/modals/IssueTrackerModal';

const SupportPage = () => {
    const navigate = useNavigate();
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-900 pb-24">
            {/* Hero Section */}
            <div className="relative py-24 overflow-hidden">
                <div className="absolute inset-0 bg-primary-900/10"></div>
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>

                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-widest mb-8 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        Alpha Phase
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight italic uppercase">
                        Support & <span className="text-primary-500">Feedback</span>
                    </h1>
                    <p className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
                        Inside the Forge, every hammer blow shapes the future. Your feedback is the catalyst for our evolution.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 space-y-12">

                {/* Alpha Information */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gray-800/40 p-10 rounded-3xl border border-white/5 space-y-4">
                        <div className="text-4xl mb-4">🧪</div>
                        <h2 className="text-2xl font-black text-white uppercase italic">What is Alpha?</h2>
                        <p className="text-gray-400 leading-relaxed">
                            The Forge is currently in its <strong>Alpha testing phase</strong>. This means we are actively building core features, refining the UI, and testing performance.
                            Things might break, layouts might shift, and features may come and go as we iterate.
                        </p>
                    </div>
                    <div className="bg-gray-800/40 p-10 rounded-3xl border border-white/5 space-y-4">
                        <div className="text-4xl mb-4">🎯</div>
                        <h2 className="text-2xl font-black text-white uppercase italic">Why it Matters</h2>
                        <p className="text-gray-400 leading-relaxed">
                            Testing at this stage is critical. It allows us to catch bugs before they affect a wider audience and, more importantly,
                            it ensures the tools we build are actually what the community needs. Your input directly influences our roadmap.
                        </p>
                    </div>
                </section>

                {/* Submitting Feedback */}
                <section className="bg-gradient-to-br from-primary-900/20 to-gray-900 p-10 rounded-3xl border border-primary-500/20">
                    <div className="flex flex-col md:flex-row gap-10 items-center">
                        <div className="flex-1 space-y-4">
                            <h2 className="text-3xl font-black text-white uppercase italic">The Ticketing System</h2>
                            <p className="text-gray-300 leading-relaxed">
                                We've integrated a custom Issue Tracker directly into the site. The primary way to submit feedback is through the <strong>Support Hub</strong> widget on your Dashboard.
                            </p>
                            <ul className="space-y-3 text-sm text-gray-400">
                                <li className="flex items-start gap-3">
                                    <span className="text-primary-500 font-bold">01.</span>
                                    <span>Navigate to your <span className="text-white font-bold">Dashboard</span>.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-primary-500 font-bold">02.</span>
                                    <span>Locate the <span className="text-white font-bold">Support Hub</span> widget (usually on the right sidebar).</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-primary-500 font-bold">03.</span>
                                    <span>Click <span className="text-white font-bold">"Report Issue"</span> to submit a bug or feature request.</span>
                                </li>
                            </ul>
                        </div>
                        <div className="shrink-0">
                            <button
                                onClick={() => setIsIssueModalOpen(true)}
                                className="px-8 py-4 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-400 transition-all transform hover:-translate-y-1 shadow-xl uppercase tracking-wider"
                            >
                                Report Issue Now
                            </button>
                        </div>
                    </div>
                </section>

                {/* Contact Section */}
                <section className="space-y-8 pt-8">
                    <h2 className="text-2xl font-black text-white uppercase italic flex items-center gap-3">
                        <span className="w-8 h-1 bg-primary-500 rounded-full"></span>
                        Direct Contact
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-800/40 p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors group">
                            <h3 className="text-primary-400 font-black uppercase tracking-widest text-xs mb-2">Main Tester</h3>
                            <div className="text-lg font-bold text-white mb-1">Artificer</div>
                            <a href="mailto:Artificer@mtg-forge.com" className="text-sm text-gray-500 hover:text-primary-400 transition-colors">Artificer@mtg-forge.com</a>
                            <p className="text-xs text-gray-500 mt-4 leading-relaxed group-hover:text-gray-400">Handles client relations and deep system validation.</p>
                        </div>

                        <div className="bg-gray-800/40 p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors group">
                            <h3 className="text-amber-500 font-black uppercase tracking-widest text-xs mb-2">Developer & Owner</h3>
                            <div className="text-lg font-bold text-white mb-1">Forge Master</div>
                            <a href="mailto:Forgemaster@mtg-forge.com" className="text-sm text-gray-500 hover:text-amber-500 transition-colors">Forgemaster@mtg-forge.com</a>
                            <p className="text-xs text-gray-500 mt-4 leading-relaxed group-hover:text-gray-400">The primary architect behind the platform's magic.</p>
                        </div>

                        <div className="bg-gray-800/40 p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors group">
                            <h3 className="text-purple-400 font-black uppercase tracking-widest text-xs mb-2">General Support</h3>
                            <div className="text-lg font-bold text-white mb-1">Support</div>
                            <a href="mailto:Support@mtg-forge.com" className="text-sm text-gray-500 hover:text-purple-400 transition-colors">Support@mtg-forge.com</a>
                            <p className="text-xs text-gray-500 mt-4 leading-relaxed group-hover:text-gray-400">Catch-all for any questions or issues you may have.</p>
                        </div>
                    </div>
                </section>

                {/* Footer Link */}
                <div className="flex justify-center pt-12">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-gray-500 hover:text-white transition-colors text-sm font-bold flex items-center gap-2 group"
                    >
                        <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Back to Dashboard
                    </button>
                </div>
            </div>

            {/* Modals */}
            <IssueTrackerModal
                isOpen={isIssueModalOpen}
                onClose={() => setIsIssueModalOpen(false)}
            />
        </div>
    );
};

export default SupportPage;
