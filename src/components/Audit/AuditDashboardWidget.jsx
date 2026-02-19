import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StartAuditButton from './StartAuditButton';
import { api } from '../../services/api';
import AuditGuideModal from '../modals/AuditGuideModal';
import { useAuth } from '../../contexts/AuthContext';
import { getTierConfig } from '../../config/tiers';

export default function AuditDashboardWidget({ size }) {
    const [session, setSession] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    const navigate = useNavigate();
    const { userProfile } = useAuth();

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';
    const isLargePlus = isLarge || isXL;

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

    // Check permissions
    const { features } = getTierConfig(userProfile?.subscription_tier);

    if (!features.collectionAudit) {
        if (isXS) {
            return (
                <div onClick={() => navigate('/settings/membership')} className="bg-gray-900/50 rounded-3xl h-full flex items-center justify-center opacity-75 cursor-pointer hover:opacity-100 border border-gray-800">
                    <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
            );
        }
        return (
            <div className="bg-gray-900/50 rounded-3xl p-4 border border-gray-800 transition-all group relative overflow-hidden flex flex-col h-full opacity-75 hover:opacity-100">
                <div className="flex justify-between items-start mb-1 relative z-10">
                    <h3 className="text-gray-400 text-xs font-medium uppercase tracking-widest">Audit</h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
                    <p className="text-[10px] text-gray-500 mb-2">Unlock Wizard tier to audit your collection.</p>
                    <button onClick={() => navigate('/settings/membership')} className="text-[9px] font-bold uppercase tracking-widest text-primary-400 border border-primary-500/30 px-3 py-1.5 rounded-lg hover:bg-primary-500/20">Upgrade</button>
                </div>
            </div>
        );
    }

    if (loading) return null;

    if (!session) {
        if (isXS) {
            return (
                <div onClick={() => navigate('/audit')} className="bg-gray-900/50 rounded-3xl h-full flex items-center justify-center cursor-pointer border border-gray-800 group transition-all">
                    <svg className="w-6 h-6 text-gray-600 group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
            );
        }
        return (
            <div className={`bg-gray-900/50 rounded-3xl ${isSmall ? 'p-4' : 'p-6'} border border-gray-800 hover:border-primary-500/30 transition-all group relative overflow-hidden flex flex-col h-full`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-all pointer-events-none" />
                <div className="flex justify-between items-start mb-1 relative z-10">
                    <h3 className="text-gray-400 text-xs font-medium tracking-widest uppercase">Collection Audit</h3>
                    <div className="text-gray-600 group-hover:text-primary-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </div>
                </div>
                <div className="mt-auto relative z-10 flex flex-col gap-2">
                    <StartAuditButton type="collection" label="Start Audit" className="w-full py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-primary-900/20 border-none" />
                </div>
            </div>
        );
    }

    const daysLeft = Math.ceil((new Date(session.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
    const total = stats?.total_cards || 0;
    const reviewed = stats?.total_reviewed || 0;
    const mismatchCount = stats?.mismatches?.length || 0;
    const matchCount = reviewed - mismatchCount;
    const pendingCount = total - reviewed;
    const percent = total > 0 ? Math.round((reviewed / total) * 100) : 0;

    if (isXS) {
        return (
            <div onClick={() => navigate('/audit')} className="bg-primary-900/20 rounded-3xl h-full flex items-center justify-between px-4 cursor-pointer border border-primary-500/30 group transition-all hover:bg-primary-900/30 overflow-hidden">
                <div className="flex items-center gap-2">
                    <div className="text-[9px] font-black px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400/80 uppercase tracking-tighter whitespace-nowrap border border-primary-500/20">
                        Audit Progress
                    </div>
                    <span className="text-sm font-black text-white">{percent}%</span>
                </div>
                <div className="relative w-8 h-8 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle cx="50%" cy="50%" r="30%" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${percent * 0.63} 100`} strokeLinecap="round" className="text-primary-500" />
                    </svg>
                    <svg className="w-3 h-3 text-primary-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-gray-900/50 rounded-3xl ${isSmall ? 'p-4' : 'p-6'} border border-primary-500/20 hover:border-primary-500/40 transition-all group relative overflow-hidden flex flex-col h-full`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />

            <div className={`flex relative z-10 h-full ${isXL ? 'flex-row items-center gap-12' : 'flex-col'}`}>
                {/* Score Section */}
                <div className={isXL ? 'min-w-[140px]' : 'mb-4'}>
                    <h3 className="text-primary-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                        Live Audit
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                    </h3>
                    <div className="flex items-baseline gap-1">
                        <span className={`${isXL ? 'text-5xl' : 'text-3xl'} font-black text-white`}>{percent}%</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Complete</span>
                    </div>
                    {isLargePlus && (
                        <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                            {daysLeft} days remaining
                        </div>
                    )}
                </div>

                {/* Main Progress/Graph Section */}
                <div className="flex-grow">
                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden mb-3">
                        <div className="bg-primary-500 h-full transition-all duration-1000" style={{ width: `${percent}%` }} />
                    </div>

                    {isXL ? (
                        <div className="grid grid-cols-3 gap-6">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Matches</span>
                                <span className="text-xl font-black text-white">{matchCount}</span>
                                <span className="text-[9px] text-gray-600 uppercase">Confirmed valid</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Mismatches</span>
                                <span className="text-xl font-black text-white">{mismatchCount}</span>
                                <span className="text-[9px] text-gray-600 uppercase">Action required</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pending</span>
                                <span className="text-xl font-black text-white">{pendingCount}</span>
                                <span className="text-[9px] text-gray-600 uppercase text-nowrap">Cards remaining</span>
                            </div>
                        </div>
                    ) : (
                        <div className={`flex justify-between text-[10px] font-bold uppercase tracking-widest ${isSmall ? 'hidden' : 'flex'}`}>
                            <span className="text-green-500">{matchCount} Match</span>
                            <span className="text-red-500">{mismatchCount} Diff</span>
                            <span className="text-gray-500">{pendingCount} Left</span>
                        </div>
                    )}
                </div>

                {/* Summary / Actions Section */}
                <div className={`${isXL ? 'min-w-[200px] border-l border-white/5 pl-8 h-full flex flex-col justify-center' : 'mt-4'}`}>
                    {isLarge && stats?.mismatches?.length > 0 && (
                        <div className="mb-4 space-y-1.5">
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Critical Delta Items</div>
                            {stats.mismatches.slice(0, 2).map((m, i) => (
                                <div key={i} className="text-[11px] text-gray-400 truncate flex items-center gap-2">
                                    <span className="w-1 h-1 rounded-full bg-red-500" />
                                    {m.card_name}
                                </div>
                            ))}
                        </div>
                    )}

                    <button onClick={() => navigate('/audit')} className={`w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg shadow-primary-900/20`}>
                        {isXL ? 'Open Full Report' : 'Resume Audit →'}
                    </button>
                    {isXL && (
                        <button onClick={() => setShowGuide(true)} className="mt-2 w-full py-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors">
                            How to Audit?
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
