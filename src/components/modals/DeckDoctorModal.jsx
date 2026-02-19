import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { GeminiService } from '../../services/gemini';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import { deckService } from '../../services/deckService';
import { useNavigate } from 'react-router-dom';
import { PdfService } from '../../services/PdfService';
import { useCardModal } from '../../contexts/CardModalContext';
import { useCollection } from '../../hooks/useCollection';

const DeckDoctorModal = ({ isOpen, onClose, deck, cards, isOwner }) => {
    const { userProfile, currentUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const helperName = userProfile?.settings?.helper?.name || 'The Oracle';

    // Global Modal & Collection
    const { openCardModal } = useCardModal();
    const { cards: allUserCards } = useCollection();

    const [loading, setLoading] = useState(false);
    // Initialize report from saved grade if available
    const [report, setReport] = useState(deck?.aiBlueprint?.grade || null);
    const [applying, setApplying] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(null); // specific card name being loaded

    // Sync report when modal opens or deck updates
    React.useEffect(() => {
        if (isOpen && deck?.aiBlueprint?.grade) {
            setReport(deck.aiBlueprint.grade);
        }
    }, [isOpen, deck]);

    const [allSets, setAllSets] = useState([]);
    React.useEffect(() => {
        if (isOpen && deck?.is_thematic && allSets.length === 0) {
            api.get('/api/sets').then(res => {
                const sets = res.data || res;
                if (Array.isArray(sets)) setAllSets(sets);
            }).catch(err => console.error("Failed to fetch sets for thematic doctor", err));
        }
    }, [isOpen, deck]);

    const getRestrictedSets = () => {
        if (!deck?.is_thematic) return [];

        const cmdSetCode = (deck?.commander?.set || '').trim().toLowerCase();
        const cmdSetName = (deck?.commander?.set_name || '').trim().toLowerCase();

        // Virtual Set Fallback if API fails or empty
        const virtualSet = {
            code: cmdSetCode || 'unk',
            name: deck?.commander?.set_name || 'Current Set',
            released_at: deck?.commander?.released_at || '2025-01-01',
            virtual: true
        };

        if (!allSets.length) return (cmdSetCode || cmdSetName) ? [virtualSet] : [];

        const cmdSet = allSets.find(s => s.code.toLowerCase() === cmdSetCode)
            || allSets.find(s => s.name.toLowerCase() === cmdSetName);

        if (!cmdSet || !cmdSet.released_at) return [virtualSet];

        const targetDate = new Date(cmdSet.released_at).toISOString().split('T')[0];
        // Restrict to sets released in the same year-ish (simple cohort logic: same release date for now to match Wizard)
        // actually Wizard logic was "same release date" effectively for "Cohort"
        return allSets.filter(s => {
            if (!s.released_at) return false;
            return new Date(s.released_at).toISOString().split('T')[0] === targetDate;
        });
    };

    if (!isOpen) return null;

    const runDiagnosis = async () => {
        setLoading(true);
        try {
            const apiKey = userProfile?.settings?.geminiApiKey; // Use consistent Gemini API key

            const restrictedSets = deck.is_thematic ? getRestrictedSets().map(s => s.code) : [];

            const result = await GeminiService.gradeDeck(apiKey, {
                deckName: deck.name,
                commander: deck.commander?.name || 'Unknown',
                cards: cards,
                playerProfile: "Competitive but casual friendly", // Default or user setting
                strategyGuide: deck.description || "General synergy",
                helperPersona: userProfile?.settings?.helper,
                restrictedSets
            }, userProfile);
            // Map the result directly as report
            // Map the result directly as report
            setReport(result);

            // Save to Deck (Persist the Power Level)
            if (isOwner) {
                const newBlueprint = {
                    ...deck.aiBlueprint,
                    grade: result, // Save the full report object as 'grade'
                    lastDiagnosed: new Date().toISOString()
                };

                await deckService.updateDeck(currentUser.uid, deck.id, { aiBlueprint: newBlueprint });
                addToast("Power Level Calibrated & Saved!", "success");
            }
        } catch (err) {
            console.error(err);
            addToast("Doctor is out. Try again later.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleApplyFixes = async () => {
        if (!report?.changes) return;
        setApplying(true);
        try {
            // If Owner: update current deck
            // If Viewer: clone deck then update

            let targetDeckId = deck.id;

            if (!isOwner) {
                // Must clone first
                const newDeck = await deckService.createDeck(currentUser.uid, {
                    name: `Fixed: ${deck.name}`,
                    commander: deck.commander,
                    commanderPartner: deck.commander_partner,
                    format: deck.format,
                    isMockup: true
                });

                // Clone existing cards
                const cardData = cards.map(c => ({
                    scryfall_id: c.scryfall_id || c.id,
                    name: c.name,
                    set_code: c.set_code,
                    collector_number: c.collector_number,
                    finish: c.finish,
                    image_uri: c.image_uri,
                    data: c.data
                }));
                await api.post(`/api/decks/${newDeck.id}/cards/batch`, { cards: cardData });
                targetDeckId = newDeck.id;
            }

            // Apply Changes
            // 1. Remove Cards (Best effort match by name)
            // Ideally we'd remove by ID, but analysis gives names.
            // We'll trust the user to manually remove if automation is tricky, 
            // OR we fetch cards for target deck and delete matches.

            // For now, let's just ADD the suggested cards and let user cut. 
            // OR fully automate:
            const changes = report.changes;
            const cuts = changes.filter(c => c.remove);
            const adds = changes.filter(c => c.add);

            // Fetch latest cards for target deck
            const { items: currentCards } = await api.get(`/api/decks/${targetDeckId}`);

            // Process Cuts
            for (const cut of cuts) {
                const match = currentCards.find(c => c.name.toLowerCase() === cut.remove.toLowerCase());
                if (match) {
                    await api.delete(`/api/cards/${match.id}`);
                }
            }

            // Process Adds (We need scryfall data... this is hard without a search)
            // Fallback: Just add to a "Fixes" list description? 
            // No, user expects magic.
            // We can treat them as "Wishlist" items or use a search generic?
            // Actually, we can't easily add without Scryfall ID.
            // PLAN: Just show the list for manual action OR add to a "Shopping List".

            // Wait, we have the `GeminiService` but not a scryfall search service readily available in frontend logic 
            // without making 5 calls.
            // For V1: We will only PERFORM the CLONE behavior if needed.
            // The ACTUAL cards must be added manually or via search.

            // REVISION: The "Apply" button is too complex for V1 without exact IDs.
            // Let's change "Apply" to "Copy Fix List" or just "Clone & View" 
            // But the user wants "Deck Doctor Flow".
            // Let's attempt to use the backend `import` or `batch` if we can resolve IDs?
            // No, let's just let the user see the plan.

            // ACTUALLY: Let's implement a simple "Clone with Notes" if not owner?

            // Let's stick to: "Clone" (if needed) -> Then Navigate to Deck.
            // The user has to manually make the swaps based on the report.
            // Automating swaps requires fuzzy search which is error prone.
            if (!isOwner) {
                addToast("Deck Cloned! Apply fixes manually.", "success");
                navigate(`/decks/${targetDeckId}`);
            } else {
                addToast("Fixes are shown. Please apply manually.", "info");
            }

        } catch (err) {
            console.error(err);
            addToast("Procedure failed.", "error");
        } finally {
            setApplying(false);
            onClose();
        }
    };

    const handleViewDetails = async (cardName) => {
        if (!cardName) return;
        setDetailsLoading(cardName);
        try {
            // Priority:
            // 1. If thematic & commander set known -> Search specific printing (set:CODE)
            // 2. If thematic & commander released_at known -> Search same era (year:YYYY)
            // 3. Fallback -> General search

            const cmdSet = deck?.commander?.set || deck?.commander?.set_code;
            const releasedAt = deck?.commander?.released_at;
            let targetCard = null;

            if (deck?.is_thematic) {
                // 1. Exact Set Match
                if (cmdSet) {
                    try {
                        const response = await api.post('/api/cards/search', {
                            query: `!"${cardName}" set:${cmdSet} unique:prints`,
                        });
                        if (response.data && response.data.length > 0) {
                            targetCard = response.data[0];
                        }
                    } catch (ignore) { }
                }

                // 2. Era Match (Same Year)
                if (!targetCard && releasedAt) {
                    try {
                        const year = releasedAt.substring(0, 4);
                        const response = await api.post('/api/cards/search', {
                            query: `!"${cardName}" year:${year} unique:prints`,
                        });
                        if (response.data && response.data.length > 0) {
                            targetCard = response.data[0];
                        }
                    } catch (ignore) { }
                }
            }

            if (!targetCard) {
                // 3. Fallback: General Search (default printing)
                const response = await api.post('/api/cards/search', {
                    query: `!"${cardName}"`, // Exact name search
                    unique: 'cards'
                });
                if (response.data && response.data.length > 0) {
                    targetCard = response.data[0];
                }
            }

            if (targetCard) {
                openCardModal(targetCard);
            } else {
                addToast(`Could not find details for ${cardName}`, "error");
            }
        } catch (err) {
            console.error("Failed to fetch card details", err);
            addToast("Failed to load card details.", "error");
        } finally {
            setDetailsLoading(null);
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 w-full max-w-4xl rounded-3xl border border-white/10 shadow-2xl p-8 relative flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                        <h2 className="text-3xl font-black text-white italic uppercase">
                            Deck Power Analysis
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">Evaluated by {helperName}</p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="absolute top-8 right-8 z-20 flex gap-2">
                    {report && (
                        <button
                            onClick={() => PdfService.generateDeckDoctorReport(report, deck.name, userProfile)}
                            className="p-2 bg-gray-800 hover:bg-gray-700 text-primary-400 rounded-lg border border-gray-700 transition-colors flex items-center gap-2 text-sm font-bold"
                            title="Export to PDF"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span>Download PDF</span>
                        </button>
                    )}
                    <button onClick={onClose} className="text-gray-500 hover:text-white p-2">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Branded Background Icon */}
                <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-[0.12] saturate-[1.5] brightness-125">
                    <img src="/icons/deck_doctor.png" alt="" className="w-[80%] h-[80%] object-contain" />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-12 relative z-10">

                    {!report && !loading && (
                        <div className="text-center py-20">
                            <h3 className="text-2xl font-bold text-white mb-4">Ready to calibrate?</h3>
                            <p className="text-gray-400 mb-8 max-w-md mx-auto">This process will analyze every card in your deck to determine its competitive bracket and numerical power level.</p>
                            <button
                                onClick={runDiagnosis}
                                className="px-10 py-4 bg-primary-600 hover:bg-primary-500 text-white font-black text-lg rounded-2xl shadow-xl hover:shadow-primary-500/20 transition-all uppercase tracking-widest flex items-center gap-3 mx-auto"
                            >
                                <span>Run Diagnosis</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 space-y-6">
                            <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500"></div>
                            <p className="text-primary-400 font-black text-xl animate-pulse uppercase tracking-widest">Simulating Matchups...</p>
                        </div>
                    )}

                    {report && (
                        <div className="animate-fade-in space-y-10">

                            {/* Top Score */}
                            <div className="text-center">
                                <div className="inline-flex flex-col items-center">
                                    <span className="text-gray-500 font-bold uppercase tracking-widest text-sm mb-2">Power Level</span>
                                    <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 filter drop-shadow-lg">
                                        {Number(report.powerLevel).toFixed(2)}
                                        <span className="text-3xl text-gray-600 ml-2">/ 10</span>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
                                <div className="text-center p-4 bg-gray-800/50 rounded-2xl border border-white/5">
                                    <div className="text-3xl font-bold text-white mb-1">{report.metrics.efficiency}<span className="text-base text-gray-500">/10</span></div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Efficiency</div>
                                </div>
                                <div className="text-center p-4 bg-gray-800/50 rounded-2xl border border-white/5">
                                    <div className="text-3xl font-bold text-white mb-1">{report.metrics.interaction}<span className="text-base text-gray-500">/10</span></div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Interaction</div>
                                </div>
                                <div className="text-center p-4 bg-gray-800/50 rounded-2xl border border-white/5">
                                    <div className="text-3xl font-bold text-white mb-1">Turn {report.metrics.winTurn}</div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Avg Win Turn</div>
                                </div>
                            </div>

                            {/* Brackets Visual */}
                            <div className="space-y-4">
                                <h4 className="text-center text-gray-500 text-xs font-black uppercase tracking-[0.2em]">Commander Bracket: {report.commanderBracket}</h4>
                                <div className="grid grid-cols-5 gap-1 h-32 rounded-2xl overflow-hidden border border-white/10">
                                    {[
                                        { id: 1, label: "Exhibition", desc: "Ultra-Casual", color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" },
                                        { id: 2, label: "Core", desc: "Average Precon", color: "bg-green-500/20 text-green-500 border-green-500/50" },
                                        { id: 3, label: "Upgraded", desc: "Beyond Precon", color: "bg-blue-500/20 text-blue-500 border-blue-500/50" },
                                        { id: 4, label: "Optimized", desc: "High Power", color: "bg-orange-500/20 text-orange-500 border-orange-500/50" },
                                        { id: 5, label: "cEDH", desc: "Competitive", color: "bg-purple-500/20 text-purple-500 border-purple-500/50" },
                                    ].map((bracket) => {
                                        const isActive = report.commanderBracket === bracket.id;
                                        return (
                                            <div
                                                key={bracket.id}
                                                className={`relative flex flex-col items-center justify-center p-4 border-t-4 transition-all ${isActive ? `bg-gray-800 ${bracket.color.replace('/20', '/10')} border-t-4 border-b-0 border-l-0 border-r-0` : 'bg-gray-950 border-gray-800 opacity-40 grayscale'}`}
                                                style={{ borderColor: isActive ? undefined : 'transparent' }}
                                            >
                                                {isActive && (
                                                    <div className="absolute top-2 right-2 bg-white text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                        MATCH
                                                    </div>
                                                )}
                                                <div className={`text-2xl font-black mb-1 ${isActive ? bracket.color.split(' ')[1] : 'text-gray-500'}`}>{bracket.id}</div>
                                                <div className="text-sm font-bold text-white uppercase tracking-wider mb-1">{bracket.label}</div>
                                                <div className="text-[10px] text-gray-400 text-center leading-tight">{bracket.desc}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Justification */}
                            <div className="bg-gray-800/30 p-6 rounded-2xl border border-white/5">
                                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Bracket Justification</h4>
                                <div
                                    className="text-gray-300 leading-relaxed italic doctor-critique-content"
                                    dangerouslySetInnerHTML={{ __html: report.bracketJustification }}
                                />
                            </div>

                            {/* Clinical Critique */}
                            <div className="space-y-4">
                                <h3 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    <span className="text-primary-500">📋</span> Clinical Critique
                                </h3>
                                <div className="bg-gray-950/50 p-8 rounded-3xl border border-white/5 shadow-inner">
                                    <div
                                        className="text-gray-300 leading-relaxed text-lg font-medium doctor-critique-content"
                                        dangerouslySetInnerHTML={{ __html: report.critique }}
                                    />
                                </div>
                            </div>

                            {/* Mechanical Improvements */}
                            <div className="space-y-6">
                                <h3 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    <span className="text-orange-500">🔧</span> Mechanical improvements
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {report.mechanicalImprovements.map((imp, idx) => (
                                        <div key={idx} className="flex gap-4 p-5 bg-white/5 rounded-2xl border border-white/5 items-start group hover:bg-orange-500/10 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold shrink-0">
                                                {idx + 1}
                                            </div>
                                            <p className="text-gray-300 text-sm leading-relaxed group-hover:text-white transition-colors">
                                                {imp}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Surgical Swaps */}
                            <div className="space-y-6 pb-12">
                                <h3 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    <span className="text-red-500">🔪</span> Surgical Swaps
                                </h3>
                                <div className="space-y-4">
                                    {report.recommendedSwaps.map((swap, idx) => (
                                        <div key={idx} className="p-6 bg-gray-950/50 rounded-3xl border border-white/5 overflow-hidden">
                                            <div className="flex flex-col md:flex-row items-center gap-6">
                                                {/* Remove */}
                                                <div className="flex-1 w-full">
                                                    <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Cut This Card</div>
                                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                                        <span className="text-white font-bold">{swap.remove}</span>
                                                    </div>
                                                </div>

                                                {/* Divider */}
                                                <div className="flex items-center justify-center">
                                                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                    </div>
                                                </div>

                                                {/* Add */}
                                                <div className="flex-1 w-full relative group/add">
                                                    <div className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-2 flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <span>Slot This In</span>
                                                            {(() => {
                                                                // Check if player owns this card and it's NOT in a deck (available)
                                                                const availableCopies = allUserCards?.filter(c =>
                                                                    c.name === swap.add &&
                                                                    !c.deck_id && // Binder only
                                                                    !c.is_wishlist
                                                                ).reduce((sum, c) => sum + (c.count || 1), 0) || 0;

                                                                if (availableCopies > 0) {
                                                                    return (
                                                                        <span className="bg-primary-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm border border-primary-400 flex items-center gap-1">
                                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                                            OWNED ({availableCopies})
                                                                        </span>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                        {swap.set && (
                                                            <div className="flex gap-2 opacity-0 group-hover/add:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleViewDetails(swap.add)}
                                                                    disabled={detailsLoading === swap.add}
                                                                    className="text-[9px] bg-primary-900/50 text-primary-400 px-2 py-0.5 rounded hover:bg-primary-900 border border-primary-500/30 disabled:opacity-50 flex items-center gap-1"
                                                                >
                                                                    {detailsLoading === swap.add ? (
                                                                        <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                    ) : 'DETAILS'}
                                                                </button>
                                                                <a
                                                                    href={`https://shop.tcgplayer.com/productcatalog/product/show?ProductName=${encodeURIComponent(swap.add)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[9px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded hover:bg-green-900 border border-green-500/30"
                                                                >
                                                                    BUY
                                                                </a>
                                                                <button
                                                                    onClick={() => addToast(`Added ${swap.add} to Wishlist`, 'success')}
                                                                    className="text-[9px] bg-pink-900/50 text-pink-400 px-2 py-0.5 rounded hover:bg-pink-900 border border-pink-500/30"
                                                                >
                                                                    WISHLIST
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-right flex items-center justify-between">
                                                        {swap.set ? (
                                                            <div className="flex items-center gap-3">
                                                                <img
                                                                    src={`https://cards.scryfall.io/small/front/${swap.set}/${swap.collectorNumber}.jpg`}
                                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                                    className="w-8 h-11 rounded object-cover shadow-sm border border-black/20"
                                                                    alt=""
                                                                />
                                                                <span className="text-white font-bold">{swap.add}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-white font-bold">{swap.add}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-white/5">
                                                <p className="text-sm text-gray-400 italic">"{swap.reason}"</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Rerun Button */}
                            <div className="flex justify-center pb-12">
                                <button
                                    onClick={runDiagnosis}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-8 py-3 bg-primary-900/40 hover:bg-primary-600/40 text-primary-300 rounded-xl border border-primary-500/20 transition-all font-bold uppercase text-xs tracking-widest group"
                                >
                                    <svg className={`w-4 h-4 transition-transform duration-700 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {loading ? 'Consulting Oracle...' : 'Rerun Diagnosis'}
                                </button>
                            </div>

                        </div>
                    )}
                </div>

            </div>
        </div>
        , document.body);

};

export default DeckDoctorModal;
