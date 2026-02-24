import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { format } from 'date-fns';

const parseReleaseData = (release) => {
    if (!release) return { html: '', unusedImages: [] };
    let html = release.notes || '';
    const referencedIndices = new Set();

    if (Array.isArray(release.images) && release.images.length > 0) {
        release.images.forEach((img, idx) => {
            const regex = new RegExp(`{{\\s*image:${idx}\\s*}}`, 'gi');
            if (regex.test(html)) {
                referencedIndices.add(idx);
                html = html.replace(regex, `<img src="${img}" data-image-index="${idx}" loading="lazy" class="w-full h-auto object-cover rounded-xl border border-white/10 shadow-lg my-6 aspect-video cursor-zoom-in hover:border-primary-500 transition-colors" alt="Attached media ${idx}" />`);
            }
        });
    } else {
        // Strip out any image references if no images are loaded (e.g., dashboard snippet view)
        html = html.replace(/{{\s*image:\d+\s*}}/gi, '');
    }

    const unusedImages = (release.images || []).map((img, idx) => ({ img, idx })).filter(({ idx }) => !referencedIndices.has(idx));
    return { html, unusedImages };
};

// Simple Modal for Release Notes
const ReleaseDetailModal = ({ isOpen, onClose, release }) => {
    const [mounted, setMounted] = useState(false);
    const [spotlightImageIndex, setSpotlightImageIndex] = useState(null);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !release || !mounted) return null;

    const hasImages = release.images && release.images.length > 0;
    const { html: parsedNotes, unusedImages } = parseReleaseData(release);
    const hasUnusedImages = unusedImages.length > 0;

    const handleNextImage = (e) => {
        e.stopPropagation();
        setSpotlightImageIndex(prev => (prev === release.images.length - 1 ? 0 : prev + 1));
    };

    const handlePrevImage = (e) => {
        e.stopPropagation();
        setSpotlightImageIndex(prev => (prev === 0 ? release.images.length - 1 : prev - 1));
    };

    const handleNotesClick = (e) => {
        const target = e.target;
        if (target.tagName === 'IMG' && target.hasAttribute('data-image-index')) {
            e.stopPropagation();
            setSpotlightImageIndex(parseInt(target.getAttribute('data-image-index'), 10));
        }
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
                <div className="bg-mtg-navy border border-amber-500/30 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up relative" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-white/10 flex justify-between items-start bg-gray-950/50 relative z-20">
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

                    <div className="p-0 overflow-y-auto custom-scrollbar bg-gray-900/50 relative">
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
                            .bg-mtg-navy { background-color: #0f172a; }
                            .heading-font { font-family: 'Playfair Display', serif; }
                            .gold-gradient-text { background: linear-gradient(to right, #fbbf24, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                            .section-card { background: rgba(30, 41, 59, 0.5); border-left: 4px solid #fbbf24; backdrop-filter: blur(8px); }
                            .format-tag { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(251, 191, 36, 0.3); }
                            .hero-glow { position: absolute; top: -10%; left: 50%; transform: translateX(-50%); width: 80%; height: 400px; background: radial-gradient(circle, rgba(251, 191, 36, 0.08) 0%, rgba(15, 23, 42, 0) 70%); z-index: 0; pointer-events: none; }
                        `}} />

                        <div
                            className="relative z-10 w-full mb-8 pt-4 pb-2"
                            dangerouslySetInnerHTML={{ __html: parsedNotes }}
                            onClick={handleNotesClick}
                        />

                        {hasUnusedImages && (
                            <div className="px-6 mb-8 space-y-4 border-t border-white/5 pt-8 bg-gray-900/40 relative z-20">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block text-center">Attached Media</span>
                                <div className="flex gap-6 overflow-x-auto pb-6 pt-2 custom-scrollbar snap-x justify-center">
                                    {unusedImages.map(({ img, idx }) => (
                                        <div
                                            key={idx}
                                            onClick={(e) => { e.stopPropagation(); setSpotlightImageIndex(idx); }}
                                            className="w-48 h-32 md:w-64 md:h-40 rounded-xl overflow-hidden border border-white/10 snap-center bg-black/50 aspect-video cursor-pointer hover:border-primary-500 transition-colors hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] flex-shrink-0 group/thumb"
                                        >
                                            <div className="w-full h-full relative">
                                                <img src={img} loading="lazy" alt={`Release Note ${idx}`} className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                    <svg className="w-8 h-8 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Spotlight Image Overlay */}
            {spotlightImageIndex !== null && hasImages && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in p-4 md:p-12"
                    onClick={() => setSpotlightImageIndex(null)}
                >
                    <button
                        className="absolute top-6 right-6 p-4 text-white hover:text-green-400 bg-black/50 hover:bg-black/80 rounded-full transition-all z-50 pointer-events-auto"
                        onClick={(e) => { e.stopPropagation(); setSpotlightImageIndex(null); }}
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {release.images.length > 1 && (
                        <button
                            className="absolute left-6 top-1/2 -translate-y-1/2 p-4 text-white hover:text-primary-400 bg-black/50 hover:bg-black/80 rounded-full transition-all z-50 pointer-events-auto"
                            onClick={handlePrevImage}
                        >
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}

                    <div className="relative max-w-7xl max-h-full w-full h-full flex flex-col items-center justify-center pointer-events-none">
                        <img
                            src={release.images[spotlightImageIndex]}
                            loading="lazy"
                            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 pointer-events-auto animate-zoom-in"
                            alt={`Spotlight ${spotlightImageIndex}`}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full border border-white/10 text-white font-mono text-sm">
                            {spotlightImageIndex + 1} / {release.images.length}
                        </div>
                    </div>

                    {release.images.length > 1 && (
                        <button
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-4 text-white hover:text-primary-400 bg-black/50 hover:bg-black/80 rounded-full transition-all z-50 pointer-events-auto"
                            onClick={handleNextImage}
                        >
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    )}
                </div>
            )}
        </>,
        document.body
    );
};

const ReleasesWidget = ({ size }) => {
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRelease, setSelectedRelease] = useState(null);
    const [loadingDetailsId, setLoadingDetailsId] = useState(null);

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';
    const isLargePlus = isLarge || isXL;

    const { html: parsedDashboardNotes } = releases?.length > 0 && releases[0] ? parseReleaseData(releases[0]) : { html: '' };

    const handleReleaseClick = async (release) => {
        if (!release || loadingDetailsId) return;
        setLoadingDetailsId(release.id);
        try {
            const fullRelease = await api.getReleaseById(release.id);
            setSelectedRelease(fullRelease);
        } catch (err) {
            console.error("Failed to load release details", err);
            // Fallback to the partial release if something goes wrong
            setSelectedRelease(release);
        } finally {
            setLoadingDetailsId(null);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                // 1. Fetch the most recent release immediately
                const firstReleaseData = await api.getReleases({ limit: 1 });
                if (!isMounted) return;

                setReleases(firstReleaseData || []);
                setLoading(false); // UI can render the snippet now

                // 2. Lazy-load the remaining historical releases in the background
                if (firstReleaseData && firstReleaseData.length > 0) {
                    api.getReleases({ limit: 9, offset: 1 })
                        .then(historicalData => {
                            if (isMounted && historicalData && historicalData.length > 0) {
                                setReleases(prev => [...prev, ...historicalData]);
                            }
                        })
                        .catch(err => console.error("Failed to lazy-load historical releases", err));
                }
            } catch (err) {
                console.error("Failed to load releases", err);
                if (isMounted) setLoading(false);
            }
        };
        load();
        return () => { isMounted = false; };
    }, []);

    if (isXS) {
        return (
            <div
                onClick={() => handleReleaseClick(releases[0])}
                className="bg-green-900/10 border border-green-500/20 rounded-3xl h-full flex items-center justify-center cursor-pointer hover:bg-green-500/20 transition-all group relative"
            >
                {loadingDetailsId === releases[0]?.id ? (
                    <svg className="w-5 h-5 text-green-400 animate-spin absolute" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <div className="relative">
                        <svg className="w-6 h-6 text-green-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        {releases.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-gray-950 animate-pulse" />}
                    </div>
                )}
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
                        <div className="overflow-hidden flex flex-col h-full bg-gray-950/40 rounded-2xl p-6 border border-white/5 relative">
                            {/* Header locked to top */}
                            <div className="flex items-center justify-between mb-4 flex-shrink-0 border-b border-white/5 pb-4">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1 h-3 bg-primary-500" /> Highlights
                                </div>
                            </div>

                            {/* Scrolling content flexes to fill middle */}
                            <div className="relative flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-4 block">
                                <style dangerouslySetInnerHTML={{
                                    __html: `
                                    .snippet-view .hero-glow, .snippet-view header { display: none; }
                                    .snippet-view section { margin-bottom: 1rem; }
                                    .snippet-view h3 { font-size: 1rem; font-weight: bold; color: #fbbf24; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.25rem; }
                                    .snippet-view .section-card, .snippet-view .format-tag { background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 0.5rem; border-left: 2px solid #fbbf24; margin-bottom: 0.5rem; }
                                    .snippet-view h4, .snippet-view h5 { font-size: 0.875rem; font-weight: bold; color: white; }
                                    .snippet-view p, .snippet-view li { font-size: 0.75rem; color: #94a3b8; line-height: 1.4; }
                                    .snippet-view ul { list-style-type: disc; padding-left: 1rem; }
                                    .snippet-view .flex { display: flex; align-items: flex-start; gap: 0.5rem; }
                                `}} />
                                <div
                                    className="snippet-view h-full pb-8"
                                    dangerouslySetInnerHTML={{ __html: parsedDashboardNotes }}
                                />
                            </div>

                            {/* Gradient mask for smooth text cut-off */}
                            <div className="absolute bottom-[60px] left-0 right-0 h-16 bg-gradient-to-t from-gray-950/90 to-transparent pointer-events-none" />

                            {/* Button locked to bottom */}
                            <div className="pt-4 border-t border-white/5 flex-shrink-0 bg-transparent flex justify-start">
                                <button
                                    onClick={() => handleReleaseClick(releases[0])}
                                    className="flex items-center gap-2 py-2 px-4 bg-white/5 hover:bg-white/10 text-primary-400 hover:text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-colors border border-white/5 w-full justify-center"
                                    disabled={loadingDetailsId === releases[0].id}
                                >
                                    Read Full Notes &rarr;
                                    {loadingDetailsId === releases[0].id && (
                                        <svg className="w-4 h-4 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* History Vert List */}
                        <div className="w-full md:w-[120px] border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-4 flex flex-col flex-shrink-0">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 md:mb-4">Past Updates</span>
                            <div className="flex md:flex-col gap-4 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                                {releases.slice(1, 4).map((r) => (
                                    <div key={r.id} onClick={() => handleReleaseClick(r)} className="cursor-pointer group/hist min-w-[100px] md:min-w-0 flex items-center gap-2">
                                        <div>
                                            <div className="text-xs font-black text-gray-300 group-hover/hist:text-white transition-colors">{r.version}</div>
                                            <div className="text-[9px] text-gray-600 font-mono mt-0.5">{format(new Date(r.released_at), 'MMM d, yyyy')}</div>
                                        </div>
                                        {loadingDetailsId === r.id && (
                                            <svg className="w-3 h-3 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : isLarge && releases[0] ? (
                    <div className="overflow-hidden flex flex-col h-full bg-gray-950/50 rounded-2xl p-4 border border-white/5 relative">
                        {/* Title block locked to top */}
                        <div className="flex justify-between items-baseline pb-3 flex-shrink-0 border-b border-white/5 mb-3">
                            <h3 className="text-sm font-black text-white">{releases[0].version} Patch Notes</h3>
                            <span className="text-[9px] text-gray-500 font-mono">{format(new Date(releases[0].released_at), 'MMMM yyyy')}</span>
                        </div>

                        {/* Scrolling content flexes to fill middle */}
                        <div className="relative flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 block">
                            <style dangerouslySetInnerHTML={{
                                __html: `
                                .snippet-view-large .hero-glow, .snippet-view-large header { display: none; }
                                .snippet-view-large section { margin-bottom: 0.5rem; }
                                .snippet-view-large h3 { font-size: 0.8rem; font-weight: bold; color: #fbbf24; margin-bottom: 0.25rem; text-transform: uppercase; }
                                .snippet-view-large .section-card, .snippet-view-large .format-tag { display: none; }
                                .snippet-view-large ul { padding-left: 0.5rem; margin-top: 0.25rem; }
                                .snippet-view-large li { font-size: 0.70rem; color: #94a3b8; line-height: 1.2; display: flex; gap: 0.5rem; }
                                .snippet-view-large p { font-size: 0.70rem; color: #94a3b8; line-height: 1.2; }
                            `}} />
                            <div className="space-y-2 opacity-80 snippet-view-large h-full pb-4" dangerouslySetInnerHTML={{ __html: parsedDashboardNotes }} />
                        </div>

                        {/* Gradient mask for smooth text cut-off */}
                        <div className="absolute bottom-[40px] left-0 right-0 h-10 bg-gradient-to-t from-gray-950/90 to-transparent pointer-events-none" />

                        {/* Button locked to bottom */}
                        <div className="pt-3 border-t border-white/5 flex-shrink-0 bg-transparent flex justify-start">
                            <button
                                onClick={() => handleReleaseClick(releases[0])}
                                className="flex items-center gap-2 text-[10px] font-black text-green-400 uppercase tracking-widest hover:text-white transition-colors"
                                disabled={loadingDetailsId === releases[0].id}
                            >
                                Read Full Notes &rarr;
                                {loadingDetailsId === releases[0].id && (
                                    <svg className="w-3 h-3 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                )}
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
                                <div key={release.id} onClick={() => handleReleaseClick(release)} className="bg-gray-950/30 border border-white/5 rounded-xl p-3 flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-all">
                                    <div>
                                        <div className="font-black text-white text-sm">{release.version}</div>
                                        <div className="text-[9px] text-gray-500 font-mono uppercase mt-0.5">{format(new Date(release.released_at), 'MMM d')}</div>
                                    </div>
                                    {loadingDetailsId === release.id ? (
                                        <svg className="w-4 h-4 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <svg className="w-4 h-4 text-gray-600 group-hover:text-green-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    )}
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
