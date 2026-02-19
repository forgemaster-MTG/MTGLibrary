import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';

// ... inside the component
const handleShare = async () => {
    const element = document.getElementById('audit-report-node');
    if (!element) return;

    try {
        const dataUrl = await toPng(element, {
            quality: 0.95,
            backgroundColor: '#111827', // Force dark background
        });

        const link = document.createElement('a');
        link.download = `audit-report-${new Date().toISOString().split('T')[0]}.png`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error('Failed to generate image:', err);
        alert(`Failed to generate image: ${err.message || 'Unknown error'}`);
    }
};
import { CheckCircle, AlertTriangle, TrendingUp, Trophy, ArrowRight, Home, Share2 } from 'lucide-react';

// Actually, let's just use CSS for confetti to be safe or a simple canvas.

const Confetti = () => {
    // Simple CSS/Canvas confetti can be complex to write from scratch in one file. 
    // Let's use a simple CSS animation of falling particles.
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(20)].map((_, i) => (
                <div
                    key={i}
                    className="absolute animate-float-down"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `-${Math.random() * 20}%`,
                        animationDuration: `${3 + Math.random() * 4}s`,
                        animationDelay: `${Math.random() * 2}s`,
                        opacity: 0.6
                    }}
                >
                    <div
                        className={`w-3 h-3 rotate-45 ${['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'][Math.floor(Math.random() * 5)]}`}
                    />
                </div>
            ))}
        </div>
    );
};

import { useAuth } from '../../contexts/AuthContext';
import { achievementService } from '../../services/AchievementService';

export default function AuditCompletion() {
    const location = useLocation();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { state } = location;

    // XP Calculation State
    const [xpGained, setXpGained] = useState(0);
    const [xpCount, setXpCount] = useState(0);

    useEffect(() => {
        if (!state || !state.session || !state.stats) {
            navigate('/dashboard');
        } else {
            // Calculate XP
            // Base XP for finishing + 10 XP per verified item
            const total = 500 + (state.stats.total_verified || 0) * 10;
            setXpGained(total);

            // Trigger Achievements
            achievementService.check({
                audits_completed: (userProfile?.stats?.audits_completed || 0) + 1, // Logic needs simple increment or service handling, 
                // but service expects 'metric current value'. 
                // Ideally service accumulates. But here we assume we send the NEW TOTAL.
                // We'll increment local metric in service? check() replaces metrics. 
                // So we need to know the old value or let service handle 'increment' type updates?
                // Service code says: this.metrics = { ...this.metrics, ...updates };
                // So we must provide the absolute new value.
                // We can read achievementService.metrics.audits_completed
            });

            // Actually, safe way:
            const currentAudits = achievementService.metrics.audits_completed || 0;
            const currentPerfects = achievementService.metrics.perfect_audits || 0;

            const isPerfect = (state.stats.mismatches?.length === 0) && (state.stats.total_cards >= 50);

            achievementService.check({
                audits_completed: currentAudits + 1,
                perfect_audits: isPerfect ? currentPerfects + 1 : currentPerfects
            });
        }
    }, [state, navigate]);

    // Animate XP Counter
    useEffect(() => {
        if (xpCount < xpGained) {
            const timer = setTimeout(() => {
                setXpCount(prev => Math.min(prev + Math.ceil(xpGained / 20), xpGained));
            }, 30);
            return () => clearTimeout(timer);
        }
    }, [xpCount, xpGained]);

    if (!state || !state.session || !state.stats) return null;

    const { stats, session } = state;
    const mismatches = stats.mismatches || [];
    const verifiedCount = stats.total_verified || 0;
    const totalCount = stats.total_cards || 0;
    const accuracy = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

    // Helper to get counts robustly
    const getCounts = (m) => {
        const expected = m.expected_qty !== undefined ? m.expected_qty : m.expected;
        const actual = m.scanned_qty !== undefined ? m.scanned_qty : (m.actual !== undefined ? m.actual : 0);
        return { actual: parseInt(actual || 0), expected: parseInt(expected || 0) };
    };

    const addedCards = mismatches.filter(m => {
        const { actual, expected } = getCounts(m);
        return actual > expected;
    });

    const missingCards = mismatches.filter(m => {
        const { actual, expected } = getCounts(m);
        return actual < expected;
    });

    const netDiff = addedCards.reduce((acc, m) => {
        const { actual, expected } = getCounts(m);
        return acc + (actual - expected);
    }, 0) + missingCards.reduce((acc, m) => {
        const { actual, expected } = getCounts(m);
        return acc + (actual - expected);
    }, 0);

    const handleShare = async () => {
        const element = document.getElementById('audit-report-node');
        if (!element) return;

        try {
            const dataUrl = await toPng(element, {
                quality: 0.95,
                backgroundColor: '#111827',
                // Skip font embedding which often parses all CSS and trips on modern functions like oklch
                fontEmbedCSS: '',
                // Alternatively, filter out style tags if needed, but fontEmbedCSS: '' is usuall the fix
            });

            const link = document.createElement('a');
            link.download = `audit-report-${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to generate image:', err);
            // Fallback: If one fails, we could try ignoring more styles, but let's see if this fixes it.
            alert(`Failed to generate image: ${err.message || 'Unknown error'}`);
        }
    };


    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 to-black pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-500/10 via-gray-900/0 to-transparent pointer-events-none" />
            <Confetti />

            <div className="max-w-4xl w-full relative z-10 animate-fade-in-up">

                {/* Report Wrapper for Capture */}
                <div id="audit-report-node" className="p-4 rounded-3xl bg-gray-900/50 backdrop-blur-sm">
                    {/* Header Card */}
                    <div className="bg-gray-800/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl mb-6 text-center relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 via-primary-500 to-purple-500" />

                        <div className="relative z-10">
                            <div className="inline-flex items-center justify-center p-4 bg-green-500/20 text-green-400 rounded-full mb-6 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                <Trophy className="w-12 h-12" />
                            </div>

                            <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tight">
                                Audit Complete!
                            </h1>
                            <p className="text-gray-400 text-lg mb-8">
                                Your collection metadata has been successfully updated.
                            </p>

                            {/* XP Badge */}
                            <div className="inline-flex flex-col items-center justify-center bg-gray-900/50 rounded-2xl p-4 px-8 border border-primary-500/30">
                                <span className="text-primary-400 text-xs font-bold uppercase tracking-widest mb-1">Experience Gained</span>
                                <span className="text-4xl font-black text-white flex items-center gap-2">
                                    +{xpCount} <span className="text-xl text-primary-500">XP</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* Accuracy Card */}
                        <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center hover:bg-gray-800 transition-colors group">
                            <div className="text-green-400 mb-2 group-hover:scale-110 transition-transform">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <div className="text-4xl font-black text-white mb-1">{accuracy}%</div>
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">Accuracy</div>
                        </div>

                        {/* Mismatch Card */}
                        <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center hover:bg-gray-800 transition-colors group">
                            <div className="text-yellow-400 mb-2 group-hover:scale-110 transition-transform">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <div className="text-4xl font-black text-white mb-1">{mismatches.length}</div>
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">Discrepancies</div>
                        </div>

                        {/* Net Change Card */}
                        <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center hover:bg-gray-800 transition-colors group">
                            <div className={`${netDiff >= 0 ? 'text-blue-400' : 'text-red-400'} mb-2 group-hover:scale-110 transition-transform`}>
                                <TrendingUp className={`w-8 h-8 ${netDiff < 0 ? 'rotate-180' : ''}`} />
                            </div>
                            <div className="text-4xl font-black text-white mb-1">{netDiff > 0 ? '+' : ''}{netDiff}</div>
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">Net Card Count</div>
                        </div>
                    </div>

                    {/* Detailed Breakdown (If Mismatches) */}
                    {mismatches.length > 0 && (
                        <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden mb-6">
                            <div className="p-4 border-b border-white/5 bg-gray-900/30 flex justify-between items-center">
                                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Change Log</h3>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {addedCards.length > 0 && (
                                    <div className="p-4">
                                        <h4 className="text-xs font-bold text-blue-400 uppercase mb-2">Found (Added)</h4>
                                        <div className="space-y-1">
                                            {addedCards.map((m, i) => {
                                                const { actual, expected } = getCounts(m);
                                                return (
                                                    <div key={i} className="flex justify-between text-sm text-gray-300">
                                                        <span>{m.name || m.card_name}</span>
                                                        <span className="font-mono text-blue-400">+{actual - expected}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {missingCards.length > 0 && (
                                    <div className="p-4 border-t border-white/5">
                                        <h4 className="text-xs font-bold text-red-400 uppercase mb-2">Missing (Removed)</h4>
                                        <div className="space-y-1">
                                            {missingCards.map((m, i) => {
                                                const { actual, expected } = getCounts(m);
                                                return (
                                                    <div key={i} className="flex justify-between text-sm text-gray-300">
                                                        <span>{m.name || m.card_name}</span>
                                                        <span className="font-mono text-red-400">{actual - expected}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Watermark / Brand Footer */}
                    <div className="mt-8 flex flex-col items-center justify-center opacity-80 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                            <img src="/logo.png" alt="MTG Forge" className="h-8 w-auto opacity-90" />
                            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                                MTG-Forge
                            </span>
                        </div>
                        <p className="text-gray-500 text-xs uppercase tracking-widest">Collection Verified</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col md:flex-row gap-4 justify-center mt-6">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-all"
                    >
                        <Home className="w-5 h-5" />
                        Back to Dashboard
                    </button>
                    {/* Share Button Implemented */}
                    <button
                        onClick={handleShare}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-primary-500/25"
                    >
                        <Share2 className="w-5 h-5" />
                        Save as Image
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes float-down {
                    0% { transform: translateY(-100px) rotate(0deg); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
                }
                .animate-float-down {
                    animation-name: float-down;
                    animation-timing-function: linear;
                    animation-iteration-count: infinite;
                }
            `}</style>
        </div>
    );
}
