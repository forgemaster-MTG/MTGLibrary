import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import StartAuditModal from './StartAuditModal';
import AuditGuideModal from '../modals/AuditGuideModal';
import FeatureTour from '../common/FeatureTour';

export default function AuditHub() {
    const { id: routeId } = useParams();
    const [session, setSession] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const [strictModal, setStrictModal] = useState({
        isOpen: false,
        type: null, // 'cancel' | 'finalize'
        onConfirm: () => { }
    });
    const [showGuide, setShowGuide] = useState(false);
    const [confirmInput, setConfirmInput] = useState('');

    // Tour
    const [isTourOpen, setIsTourOpen] = useState(false);
    useEffect(() => {
        const handleStartTour = () => setIsTourOpen(true);
        window.addEventListener('start-tour', handleStartTour);
        if (!localStorage.getItem('tour_seen_audit_tour_v1')) {
            setTimeout(() => setIsTourOpen(true), 1000);
        }
        return () => window.removeEventListener('start-tour', handleStartTour);
    }, []);

    const TOUR_STEPS = [
        { target: 'h1', title: 'Audit Dashboard', content: 'Track the status of your collection verification.' },
        { target: '#audit-progress', title: 'Progress', content: 'See your overall completion and accuracy.' },
        { target: '#audit-decks', title: 'Decks', content: 'Audit specific decks card by card.' },
        { target: '#audit-guide-btn', title: 'Guide', content: 'Read the full guide if you get stuck.' }
    ];

    useEffect(() => {
        const fetchSession = async () => {
            try {
                // If routeId is provided, use it. Otherwise verify active session.
                let activeId = routeId;
                if (!activeId) {
                    const active = await api.getActiveAudit();
                    if (active) activeId = active.id;
                    else return; // No active session, user should be redirected or shown start?
                }

                if (activeId) {
                    // We need to fetch specific session details if we want to support viewing history later
                    // But for now, let's assume active.
                    // Let's use the stats endpoint to get data
                    const s = await api.get(`/api/audit/${activeId}/stats`);
                    setStats(s);
                    // We also need session info for metadata
                    // Re-using active endpoint for session details for now as it returns the object
                    const sessParams = await api.getActiveAudit();
                    setSession(sessParams);
                }
            } catch (err) {
                console.error("Failed to load audit hub", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchSession();
    }, [routeId]);

    const openStrictModal = (type, onConfirm) => {
        setStrictModal({ isOpen: true, type, onConfirm });
        setConfirmInput('');
    };

    const handleStrictConfirm = async () => {
        const targetWord = strictModal.type === 'cancel' ? 'delete' : 'complete';
        if (confirmInput.toLowerCase().trim() !== targetWord) return;

        await strictModal.onConfirm();
        setStrictModal({ isOpen: false, type: null, onConfirm: () => { } });
    };

    const handleCancel = () => {
        if (!session) return;
        openStrictModal('cancel', async () => {
            try {
                await api.cancelAudit(session.id);
                navigate('/dashboard');
            } catch (e) {
                alert("Failed to cancel: " + e.message);
            }
        });
    };

    const handleFinalize = () => {
        openStrictModal('finalize', async () => {
            try {
                await api.finalizeAudit(session.id);
                navigate('/dashboard');
            } catch (err) {
                console.error('Finalize failed', err);
                alert('Finalize failed: ' + err.message);
            }
        });
    };

    if (loading) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading Audit...</div>;
    if (error) return <div className="p-8 text-center text-red-400">Error: {error}</div>;
    if (!session || !stats) return (
        <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">No Active Audit</h2>
            <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-gray-700 rounded text-white">Return to Dashboard</button>
        </div>
    );

    // Calculate overall progress
    // Reviewed items count as progress too? Or just visually distinguishable?
    // User wants "Reviewed" to mean "Section Complete".
    // So total progress should probably track Verified, but sections show Reviewed.
    const totalExpected = stats.total_cards || 1;
    const totalReviewed = stats.total_reviewed || 0;
    const totalVerified = stats.total_verified || 0;
    const percentComplete = Math.round((totalReviewed / totalExpected) * 100);

    const getGradient = (verified, total, reviewed) => {
        if (total === 0) return 'from-gray-800 to-gray-900 border-gray-700';

        // If explicitly reviewed (section complete)
        if (reviewed > 0 && reviewed >= total) return 'from-blue-900/40 to-blue-900/20 border-blue-500/50 hover:border-blue-400';
        // Note: 'reviewed' count in stats might be per-item logic (if we implemented per-item marking),
        // but current backend implementation marks ALL items in section as reviewed.
        // So checking reviewed > 0 might be enough if we assume all-or-nothing for section review.
        // But safer to check count. However, stats return 'reviewed' count.

        const reviewedPct = (reviewed / total);
        if (reviewedPct === 1) {
            // If all reviewed, check if all verified
            if (verified === total) return 'from-green-900/40 to-green-900/20 border-green-500/50 hover:border-green-400';
            return 'from-blue-900/40 to-blue-900/20 border-blue-500/50 hover:border-blue-400';
        }

        if (reviewedPct < 0.1) return 'from-gray-800/40 to-gray-800/20 border-gray-700/50 hover:border-gray-600';
        return 'from-yellow-900/40 to-yellow-900/20 border-yellow-500/50 hover:border-yellow-400';
    };

    return (
        <div className="min-h-screen bg-gray-900 p-8 pt-24 relative">
            <div className={`max-w-7xl mx-auto space-y-8 animate-fade-in-up transition-all ${strictModal.isOpen ? 'blur-sm pointer-events-none' : ''}`}>

                {/* Header */}
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase px-2 py-1 rounded border border-indigo-500/30">
                                Audit in Progress
                            </span>
                            <span className="text-gray-500 text-sm">Started {new Date(session.created_at).toLocaleDateString()}</span>
                        </div>
                        <h1 className="text-4xl font-black text-white">Audit the Forge</h1>
                        <p className="text-gray-400 mt-2 flex items-center gap-2">
                            Verify decks and binder to reconcile your inventory.
                            <button
                                onClick={() => setShowGuide(true)}
                                id="audit-guide-btn"
                                className="text-indigo-400 hover:text-indigo-300 font-bold ml-2 text-sm flex items-center gap-1 group/guide"
                            >
                                <svg className="w-4 h-4 transition-transform group-hover/guide:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Setup Guide
                            </button>
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors font-medium text-sm"
                        >
                            Cancel Audit
                        </button>
                        <button
                            onClick={handleFinalize}
                            className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-lg shadow-lg shadow-green-500/20 text-sm transition-all hover:scale-105"
                        >
                            Finalize Results
                        </button>
                    </div>
                </div>

                {/* Overall Progress */}
                <div id="audit-progress" className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-2 relative z-10">
                        <span className="text-xl font-bold text-white">Total Progress</span>
                        <span className="text-2xl font-mono text-indigo-400">{percentComplete}%</span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-4 overflow-hidden relative z-10">
                        <div
                            className="bg-gradient-to-r from-indigo-600 to-purple-500 h-full transition-all duration-1000 ease-out"
                            style={{ width: `${percentComplete}%` }}
                        />
                    </div>
                    <div className="mt-2 flex justify-between text-sm text-gray-400 relative z-10">
                        <span>{totalReviewed} / {totalExpected} Cards Reviewed ({totalVerified} Matched)</span>
                        <span>{stats.decks.length} Decks • {Object.keys(stats.collection.groups).length} Loose Groups</span>
                    </div>
                </div>

                {/* DECKS GRID */}
                {stats.decks.length > 0 && (
                    <div id="audit-decks">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            Decks
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {stats.decks.map(deck => (
                                <button
                                    key={deck.id}
                                    onClick={() => navigate(`/audit/${session.id}/wizard?deckId=${deck.id}`)}
                                    className={`relative group p-6 rounded-xl border transition-all hover:-translate-y-1 hover:shadow-xl bg-gradient-to-br ${getGradient(deck.verified, deck.total, deck.reviewed)} overflow-hidden`}
                                >
                                    <h4 className="font-bold text-white text-lg truncate mb-1 relative z-10 text-left">{deck.name}</h4>
                                    <div className="text-sm text-gray-300 mb-4 flex justify-between relative z-10">
                                        <span>{deck.colors ? deck.colors.join('') : 'Colorless'}</span>
                                        <span>
                                            {deck.reviewed >= deck.total ? (
                                                <span className="flex items-center gap-1 text-blue-300"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Complete</span>
                                            ) : (
                                                <span>{deck.reviewed}/{deck.total} Done</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="w-full bg-black/30 rounded-full h-1.5 overflow-hidden relative z-10">
                                        <div
                                            className="bg-white/80 h-full transition-all"
                                            style={{ width: `${(deck.reviewed / deck.total) * 100}%` }}
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* COLLECTION / LOOSE GRID */}
                <div>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                        Collection (Loose Cards)
                    </h3>
                    {/* FIXED: Removed loose text glitch by cleaning up absolute positioning and overflow */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {stats.collection.groups.map(group => (
                            <button
                                key={group.name}
                                onClick={() => navigate(`/audit/${session.id}/wizard?group=${group.name}`)}
                                className={`relative p-4 rounded-xl border text-left transition-all hover:brightness-110 bg-gradient-to-br ${getGradient(group.verified, group.total, group.reviewed)} overflow-hidden group isolate`}
                            >
                                <div className="text-3xl font-black text-white/5 absolute -bottom-1 -right-1 select-none pointer-events-none transition-colors z-0 whitespace-nowrap transform rotate-0 origin-bottom-right">
                                    {group.name}
                                </div>
                                <h4 className="font-bold text-white text-md mb-2 relative z-10">{group.name}</h4>
                                <div className="text-xs text-gray-300 relative z-10">
                                    {group.reviewed >= group.total ? (
                                        <span className="flex items-center gap-1 text-blue-300"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Complete</span>
                                    ) : (
                                        <span>{group.reviewed}/{group.total} Done</span>
                                    )}
                                </div>
                            </button>
                        ))}
                        {stats.collection.total > 0 && stats.collection.groups.length === 0 && (
                            <div className="col-span-full text-gray-500 italic p-4">
                                No groups found for loose cards. (All cards might be in decks)
                            </div>
                        )}
                        {stats.collection.total === 0 && (
                            <div className="col-span-full border border-dashed border-gray-700 rounded-xl p-8 text-center text-gray-500">
                                No loose cards in this audit scope.
                            </div>
                        )}
                    </div>
                </div>

                {/* MISMATCH REPORT TABLE */}
                {stats.mismatches && stats.mismatches.length > 0 && (
                    <div className="bg-gray-800/50 rounded-2xl border border-red-500/20 overflow-hidden mb-8">
                        {/* ... table content headers ... */}
                        <div className="p-6 border-b border-gray-700/50 flex items-center gap-3">
                            <h3 className="text-xl font-bold text-white">Discrepancy Report</h3>
                        </div>
                        {/* ... table body ... */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                                        <th className="p-4">Card</th>
                                        <th className="p-4">Set</th>
                                        <th className="p-4">Location</th>
                                        <th className="p-4 text-center">Expected</th>
                                        <th className="p-4 text-center">Actual</th>
                                        <th className="p-4 text-right">Diff</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-700/50">
                                    {stats.mismatches.map(m => {
                                        const expected = m.expected_qty !== undefined ? m.expected_qty : m.expected;
                                        const actual = m.scanned_qty !== undefined ? m.scanned_qty : (m.actual !== undefined ? m.actual : 0);
                                        const diff = actual - expected;
                                        return (
                                            <tr key={m.id} className="text-white hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-bold max-w-xs truncate">{m.name} {m.finish === 'foil' && <span className="text-xs text-yellow-500 ml-1">FOIL</span>}</td>
                                                <td className="p-4 font-mono text-gray-400">{m.set_code.toUpperCase()} #{m.collector_number}</td>
                                                <td className="p-4 text-gray-300">
                                                    {m.deck_name ? (
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> {m.deck_name}</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Collection</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center font-mono text-gray-400">{expected}</td>
                                                <td className="p-4 text-center font-mono font-bold">{actual}</td>
                                                <td className={`p-4 text-right font-mono font-bold ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {diff > 0 ? `+${diff}` : diff}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>{/* Close max-w-7xl */}

            {/* STRICT MODAL OVERLAY */}
            {strictModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setStrictModal({ ...strictModal, isOpen: false })} />
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 max-w-md w-full relative z-10 shadow-2xl animate-fade-in-up">
                        <h3 className="text-xl font-bold text-white mb-2">
                            {strictModal.type === 'cancel' ? 'Delete Audit Session?' : 'Complete Audit?'}
                        </h3>
                        <p className="text-gray-400 text-sm mb-6">
                            {strictModal.type === 'cancel'
                                ? "This will definitively DELETE this session and all progress. This cannot be undone."
                                : "This will sync all verified counts to your collection. Cards in 'Reviewed' sections with mismatching counts will NOT be synced, only exact matches are auto-synced. Proceed?"}
                        </p>

                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            Type <span className="text-white select-none">{strictModal.type === 'cancel' ? 'Delete' : 'Complete'}</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder={strictModal.type === 'cancel' ? 'Delete' : 'Complete'}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:border-indigo-500 outline-none mb-6"
                            autoFocus
                        />

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setStrictModal({ ...strictModal, isOpen: false })}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStrictConfirm}
                                disabled={confirmInput.toLowerCase().trim() !== (strictModal.type === 'cancel' ? 'delete' : 'complete')}
                                className={`px-4 py-2 rounded-lg font-bold text-white transition-all ${confirmInput.toLowerCase().trim() === (strictModal.type === 'cancel' ? 'delete' : 'complete')
                                    ? strictModal.type === 'cancel' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-500'
                                    : 'bg-gray-700 opacity-50 cursor-not-allowed'
                                    }`}
                            >


                                {strictModal.type === 'cancel' ? 'Delete Audit' : 'Complete Audit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <AuditGuideModal
                isOpen={showGuide}
                onClose={() => setShowGuide(false)}
            />
            <FeatureTour
                steps={TOUR_STEPS}
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                tourId="audit_tour_v1"
            />
        </div>
    );
}
