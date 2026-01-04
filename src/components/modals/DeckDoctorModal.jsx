import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { GeminiService } from '../../services/gemini';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import { deckService } from '../../services/deckService';
import { useNavigate } from 'react-router-dom';

const DeckDoctorModal = ({ isOpen, onClose, deck, cards, isOwner }) => {
    const { userProfile, currentUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [applying, setApplying] = useState(false);

    if (!isOpen) return null;

    const runDiagnosis = async () => {
        setLoading(true);
        try {
            const apiKey = userProfile?.settings?.openAIKey; // Using "openAIKey" field for Gemini per existing convention
            if (!apiKey) {
                addToast("Please save your API Key in Settings > AI first.", "error");
                setLoading(false);
                return;
            }

            const result = await GeminiService.analyzeDeck(apiKey, cards, deck.commander?.name || deck.name, userProfile?.settings?.helper);
            setReport(result);
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

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl p-6 relative flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-white italic uppercase flex items-center gap-2">
                            <span className="text-3xl">🩺</span> Deck Doctor
                        </h2>
                        <p className="text-gray-400 text-sm">AI Analysis & Diagnosis</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    {!report && !loading && (
                        <div className="text-center py-12">
                            <p className="text-gray-400 mb-6">Ready to examine your deck for synergy, speed, and interaction flaws.</p>
                            <button
                                onClick={runDiagnosis}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all"
                            >
                                Run Diagnosis
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                            <p className="text-indigo-400 font-mono animate-pulse">Running diagnostics...</p>
                        </div>
                    )}

                    {report && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Score */}
                            <div className="flex items-center gap-6 bg-gray-800/50 p-6 rounded-2xl border border-white/5">
                                <div className="relative h-24 w-24 flex items-center justify-center">
                                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 36 36">
                                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#374151" strokeWidth="4" />
                                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={report.score > 80 ? '#10B981' : report.score > 60 ? '#F59E0B' : '#EF4444'} strokeWidth="4" strokeDasharray={`${report.score}, 100`} />
                                    </svg>
                                    <span className="text-3xl font-black text-white">{report.score}</span>
                                </div>
                                <div className="flex-1 grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-xs text-gray-400 uppercase tracking-widest">Synergy</div>
                                        <div className="text-xl font-bold text-indigo-400">{report.metrics.synergy}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400 uppercase tracking-widest">Speed</div>
                                        <div className="text-xl font-bold text-indigo-400">{report.metrics.speed}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400 uppercase tracking-widest">Interaction</div>
                                        <div className="text-xl font-bold text-indigo-400">{report.metrics.interaction}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Issues */}
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                <h4 className="text-red-400 font-bold uppercase text-xs tracking-widest mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    Critical Issues
                                </h4>
                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-300">
                                    {report.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                                </ul>
                            </div>

                            {/* Proposed Changes */}
                            <div>
                                <h4 className="text-indigo-400 font-bold uppercase text-xs tracking-widest mb-3">Prescribed Fixes</h4>
                                <div className="space-y-3">
                                    {report.changes.map((change, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-gray-800 p-3 rounded-lg border border-gray-700 text-sm">
                                            <span className="text-red-400 font-bold line-through px-2 py-0.5 bg-red-500/10 rounded">-{change.remove}</span>
                                            <span className="text-gray-500">→</span>
                                            <span className="text-green-400 font-bold px-2 py-0.5 bg-green-500/10 rounded">+{change.add}</span>
                                            <span className="text-gray-400 text-xs italic border-l border-gray-700 pl-3">{change.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {report && (
                    <div className="mt-6 pt-4 border-t border-white/5 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white font-bold text-sm">Close</button>
                        {/* <button 
                            onClick={handleApplyFixes}
                            disabled={applying}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all text-sm disabled:opacity-50"
                        >
                            {applying ? 'Applying...' : (isOwner ? 'Apply Fixes (Manual)' : 'Clone & Fix')}
                        </button> */}
                    </div>
                )}

            </div>
        </div>
        , document.body);
};

export default DeckDoctorModal;
