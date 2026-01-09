import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StartAuditButton from './StartAuditButton';
import { api } from '../../services/api';
import AuditGuideModal from '../modals/AuditGuideModal';

export default function AuditDashboardWidget() {
    const [session, setSession] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const check = async () => {
            try {
                const active = await api.getActiveAudit();
                setSession(active);
                if (active) {
                    const sData = await api.get(`/api/audit/${active.id}/stats`);
                    setStats(sData);
                }
            } catch (err) {
                console.error("Failed to check audit status", err);
            } finally {
                setLoading(false);
            }
        };
        check();
    }, []);

    if (loading) return null;

    if (!session) {
        return (
            <div className="bg-gray-900/50 rounded-2xl p-4 border border-gray-800 hover:border-indigo-500/30 transition-all group relative overflow-hidden flex flex-col h-full min-h-[140px]">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all pointer-events-none" />

                <div className="flex justify-between items-start mb-1 relative z-10">
                    <div>
                        <h3 className="text-gray-400 text-xs font-medium flex items-center gap-2">
                            Audit The Forge
                        </h3>
                        <div className="mt-1">
                            <span className="text-2xl font-bold text-white/20">Ready</span>
                        </div>
                    </div>
                    <div className="p-1.5 bg-gray-800/50 rounded-lg text-gray-600 group-hover:text-indigo-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </div>
                </div>

                <p className="text-[11px] text-gray-500 mb-4 relative z-10">
                    Keep your inventory accurate.
                </p>

                <div className="mt-auto relative z-10 flex flex-col gap-2">
                    <StartAuditButton
                        type="collection"
                        label="Start Audit"
                        className="w-full py-1.5 bg-gray-800 hover:bg-indigo-600 text-gray-400 hover:text-white rounded-xl font-bold text-[10px] transition-all border border-gray-700 hover:border-indigo-500 active:scale-95 shadow-none"
                    />
                    <button
                        onClick={() => setShowGuide(true)}
                        className="text-[9px] font-bold text-gray-600 hover:text-indigo-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-1"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Setup Guide
                    </button>
                </div>

                <AuditGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
            </div>
        );
    }

    const daysLeft = Math.ceil((new Date(session.expires_at) - new Date()) / (1000 * 60 * 60 * 24));

    // Progress calculation
    const total = stats?.total_cards || 0;
    const reviewed = stats?.total_reviewed || 0;
    const mismatchCount = stats?.mismatches?.length || 0;
    const matchCount = reviewed - mismatchCount;
    const pendingCount = total - reviewed;
    const percent = total > 0 ? Math.round((reviewed / total) * 100) : 0;

    return (
        <div className="bg-gray-900/50 rounded-2xl p-4 border border-indigo-500/20 hover:border-indigo-500/40 transition-all group relative overflow-hidden flex flex-col h-full min-h-[140px]">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

            <div className="flex justify-between items-start mb-1 relative z-10">
                <div>
                    <h3 className="text-indigo-400 text-[11px] font-medium flex items-center gap-2 uppercase tracking-wider">
                        Audit in Progress
                        <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                    </h3>
                    <div className="mt-0.5">
                        <span className="text-2xl font-bold text-white">{percent}%</span>
                        <span className="text-[10px] text-gray-500 ml-1">Complete</span>
                    </div>
                </div>
                <button
                    onClick={() => setShowGuide(true)}
                    className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
            </div>

            {stats && (
                <div className="relative z-10 mb-3">
                    <div className="w-full bg-gray-800 rounded-full h-1 my-1.5 overflow-hidden">
                        <div
                            className="bg-indigo-500 h-full transition-all duration-1000 ease-out"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                        <span className="text-green-500/80">{matchCount} Match</span>
                        <span className="text-red-500/80">{mismatchCount} Diff</span>
                        <span className="text-gray-500">{pendingCount} Left</span>
                    </div>
                </div>
            )}

            {!stats && <div className="flex-1" />}

            <div className="mt-auto relative z-10 flex items-center justify-between gap-3">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{daysLeft}d left</span>
                <button
                    onClick={() => navigate('/audit')}
                    className="flex-1 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold text-[10px] transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                    Resume &rarr;
                </button>
            </div>

            <AuditGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
        </div>
    );
}
