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

const ReleasesWidget = () => {
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRelease, setSelectedRelease] = useState(null);

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

    return (
        <div className="bg-gray-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md flex flex-col h-full overflow-hidden">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <span className="p-1.5 bg-green-500/10 rounded-lg text-green-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </span>
                Recent Releases Hub
            </h2>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {loading ? (
                    <div className="text-gray-500 text-sm animate-pulse">Loading updates...</div>
                ) : releases.length === 0 ? (
                    <div className="text-gray-500 text-sm italic py-4 text-center border border-dashed border-gray-800 rounded-xl">
                        No releases published yet.
                    </div>
                ) : (
                    releases.map(release => (
                        <div key={release.id} className="bg-gray-950/30 border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="font-black text-white text-lg tracking-tight">{release.version}</span>
                                    <span className="text-[10px] text-gray-500 font-mono uppercase">
                                        {format(new Date(release.released_at), 'MMM d, yyyy')}
                                    </span>
                                </div>
                                <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wide">
                                    {release.stats?.features > 0 && (
                                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                            {release.stats.features} Features
                                        </span>
                                    )}
                                    {release.stats?.bugs > 0 && (
                                        <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                                            {release.stats.bugs} Bugs
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedRelease(release)}
                                className="px-3 py-1.5 bg-gray-800 hover:bg-indigo-600 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 group-hover:translate-x-0 translate-x-2 opacity-0 group-hover:opacity-100"
                            >
                                View Release
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        </div>
                    ))
                )}
            </div>

            <ReleaseDetailModal
                isOpen={!!selectedRelease}
                onClose={() => setSelectedRelease(null)}
                release={selectedRelease}
            />
        </div>
    );
};

export default ReleasesWidget;
