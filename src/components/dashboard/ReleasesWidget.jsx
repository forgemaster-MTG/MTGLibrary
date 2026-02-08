import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { format } from 'date-fns';

// Simple Modal for Release Notes
const ReleaseDetailModal = ({ isOpen, onClose, release }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !release || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-gray-950/50">
                    <div>
                        <h3 className="text-2xl font-black text-white mb-1">{release.version}</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 font-mono uppercase">
                                Released {format(new Date(release.released_at), 'MMMM d, yyyy')}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar bg-gray-900/50">
                    <div className="flex gap-4 mb-6">
                        {release.stats?.features > 0 && (
                            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{release.stats.features} New Features</span>
                            </div>
                        )}
                        {release.stats?.bugs > 0 && (
                            <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">{release.stats.bugs} Bug Fixes</span>
                            </div>
                        )}
                    </div>

                    <div
                        className="prose prose-invert prose-lg max-w-none prose-headings:text-indigo-300 prose-a:text-indigo-400 prose-strong:text-white"
                        dangerouslySetInnerHTML={{ __html: release.notes }}
                    />
                </div>

                <div className="p-4 border-t border-white/5 bg-gray-950/30 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ReleasesWidget = ({ size }) => {
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRelease, setSelectedRelease] = useState(null);

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';
    const isLargePlus = isLarge || isXL;

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.getReleases();
                setReleases(data || []);
            } catch (err) {
                console.error("Failed to load releases", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (isXS) {
        return (
            <div
                onClick={() => setSelectedRelease(releases[0])}
                className="bg-green-900/10 border border-green-500/20 rounded-3xl h-full flex items-center justify-center cursor-pointer hover:bg-green-500/20 transition-all group"
            >
                <div className="relative">
                    <svg className="w-6 h-6 text-green-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    {releases.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-gray-950 animate-pulse" />}
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-gray-900/40 border border-white/5 rounded-3xl ${isSmall ? 'p-4' : 'p-6'} backdrop-blur-md flex flex-col h-full overflow-hidden relative group`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-4 relative z-10">
                <h2 className="font-black text-white flex items-center gap-2 uppercase tracking-widest text-[10px]">
                    <span className="p-1.5 bg-green-500/10 rounded-lg text-green-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </span>
                    Release Log
                </h2>
                {isLargePlus && releases[0] && (
                    <span className="text-[10px] font-mono text-green-400 font-bold px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">Current: {releases[0].version}</span>
                )}
            </div>

            {/* Content Areas */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar relative z-10">
                {loading ? (
                    <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Loading updates...</div>
                ) : isXL && releases[0] ? (
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 h-full font-sans">
                        {/* Latest Summary & Stats */}
                        <div className="w-full md:w-[160px] flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start gap-4 flex-shrink-0">
                            <div>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Newest Version</span>
                                <div className="text-2xl lg:text-3xl font-black text-white mb-2 break-all leading-tight">{releases[0].version}</div>
                                <div className="text-[10px] text-gray-400 font-mono mb-2 md:mb-4">{format(new Date(releases[0].released_at), 'MMMM yyyy')}</div>
                            </div>
                            <div className="flex flex-col gap-2 flex-shrink-0">
                                <div className="flex items-center gap-2 group/stat">
                                    <div className="w-8 h-1 bg-emerald-500 rounded-full group-hover:w-10 transition-all" />
                                    <span className="text-[10px] font-black text-emerald-400 uppercase">{releases[0].stats?.features || 0} Features</span>
                                </div>
                                <div className="flex items-center gap-2 group/stat">
                                    <div className="w-6 h-1 bg-red-500 rounded-full group-hover:w-8 transition-all" />
                                    <span className="text-[10px] font-black text-red-400 uppercase">{releases[0].stats?.bugs || 0} Bugfixes</span>
                                </div>
                            </div>
                        </div>

                        {/* Notes Snippet */}
                        <div className="flex-1 bg-gray-950/40 rounded-2xl p-4 border border-white/5 relative group/notes overflow-hidden flex flex-col min-h-0 min-w-0">
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 md:mb-4 flex items-center gap-2 flex-shrink-0">
                                <div className="w-1 h-3 bg-indigo-500" /> Highlights
                            </div>
                            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-indigo-300 prose-a:text-indigo-400 prose-strong:text-white prose-headings:mb-2 prose-p:my-1 prose-li:my-0.5 overflow-y-auto custom-scrollbar pr-2 h-full" dangerouslySetInnerHTML={{ __html: releases[0].notes }} />
                            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-900/40 to-transparent pointer-events-none" />
                        </div>

                        {/* History Vert List */}
                        <div className="w-full md:w-[120px] border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-4 flex flex-col flex-shrink-0">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 md:mb-4">Past Updates</span>
                            <div className="flex md:flex-col gap-4 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                                {releases.slice(1, 4).map((r) => (
                                    <div key={r.id} onClick={() => setSelectedRelease(r)} className="cursor-pointer group/hist min-w-[100px] md:min-w-0">
                                        <div className="text-xs font-black text-gray-300 group-hover/hist:text-white transition-colors">{r.version}</div>
                                        <div className="text-[9px] text-gray-600 font-mono mt-0.5">{format(new Date(r.released_at), 'MMM d, yyyy')}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : isLarge && releases[0] ? (
                    <div className="space-y-4">
                        <div className="bg-gray-950/50 rounded-2xl p-4 border border-white/5">
                            <div className="flex justify-between items-baseline mb-3">
                                <h3 className="text-sm font-black text-white">{releases[0].version} Patch Notes</h3>
                                <span className="text-[9px] text-gray-500 font-mono">{format(new Date(releases[0].released_at), 'MMMM yyyy')}</span>
                            </div>
                            <div className="space-y-2 opacity-80 overflow-hidden max-h-[100px] text-xs" dangerouslySetInnerHTML={{ __html: releases[0].notes }} />
                            <button onClick={() => setSelectedRelease(releases[0])} className="mt-4 text-[10px] font-black text-green-400 uppercase tracking-widest hover:text-white transition-colors">
                                Read Full Notes &rarr;
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 h-full">
                        {releases.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 pb-4">
                                <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest">No Updates Found</div>
                            </div>
                        ) : (
                            releases.slice(0, isSmall ? 1 : 2).map((release) => (
                                <div key={release.id} onClick={() => setSelectedRelease(release)} className="bg-gray-950/30 border border-white/5 rounded-xl p-3 flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-all">
                                    <div>
                                        <div className="font-black text-white text-sm">{release.version}</div>
                                        <div className="text-[9px] text-gray-500 font-mono uppercase mt-0.5">{format(new Date(release.released_at), 'MMM d')}</div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-600 group-hover:text-green-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <ReleaseDetailModal
                isOpen={!!selectedRelease}
                onClose={() => setSelectedRelease(null)}
                release={selectedRelease}
            />

            {/* Subtle Gradient background on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700" />
        </div>
    );
};

export default ReleasesWidget;
