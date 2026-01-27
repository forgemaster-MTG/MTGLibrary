import React from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GeminiService } from '../../services/gemini';
import { deckService } from '../../services/deckService';
import { useToast } from '../../contexts/ToastContext';
import { TIER_CONFIG, TIERS, getTierConfig } from '../../config/tiers';

const DeckStrategyModal = ({ isOpen, onClose, deck, cards = [], onStrategyUpdate }) => {
    const { userProfile, currentUser } = useAuth();
    const { addToast } = useToast();
    const helperName = userProfile?.settings?.helper?.name || 'The Oracle';
    const [isRerunning, setIsRerunning] = React.useState(false);

    // Image State
    const [activeCommanderIndex, setActiveCommanderIndex] = React.useState(0);
    const [isFlipped, setIsFlipped] = React.useState(false);

    // Notes State
    const [notes, setNotes] = React.useState(deck.notes || '');
    const [isSavingNotes, setIsSavingNotes] = React.useState(false);
    const [isNotesExpanded, setIsNotesExpanded] = React.useState(!!(deck.notes && deck.notes.length > 0)); // Expanded by default if content exists

    const handleNotesSave = async () => {
        if (notes === (deck.notes || '')) return; // No change

        setIsSavingNotes(true);
        try {
            await deckService.updateDeck(currentUser.uid, deck.id, { notes });
            addToast("Notes saved", "success");
            // Update local deck object reference if possible, or rely on parent reload
            if (onStrategyUpdate) onStrategyUpdate();
        } catch (error) {
            console.error(error);
            addToast("Failed to save notes", "error");
        } finally {
            setIsSavingNotes(false);
        }
    };

    // Reset state when valid
    React.useEffect(() => {
        if (isOpen) {
            setActiveCommanderIndex(0);
            setIsFlipped(false);
            document.body.style.overflow = 'hidden'; // Lock Body Scroll
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen || !deck) return null;

    // ... variables ...
    const blueprint = deck.aiBlueprint || {};
    const strategyHtml = blueprint.strategy || `<p class="text-gray-400 italic">No strategy generated for this deck yet. Ask ${helperName} to analyze it.</p>`;
    const theme = blueprint.theme || 'Uncharted Strategy';

    // Commander Logic
    const commanders = [deck.commander];
    if (deck.commander_partner) commanders.push(deck.commander_partner);

    const activeCommander = commanders[activeCommanderIndex] || commanders[0];
    const isDoubleSided = activeCommander?.card_faces?.length > 1;

    // Get Active Image
    const getCommanderImage = () => {
        if (!activeCommander) return 'https://placehold.co/480x680?text=Commander';

        if (isDoubleSided) {
            const face = activeCommander.card_faces[isFlipped ? 1 : 0];
            return face.image_uris?.art_crop || face.image_uris?.large || face.image_uris?.normal;
        }

        return activeCommander.image_uris?.art_crop || activeCommander.image_uris?.large || activeCommander.image_uris?.normal || activeCommander.image_uri;
    };

    // Support both new nested layout and legacy flat structures
    const functionalNeeds = blueprint.layout?.functional || blueprint.suggestedCounts || {};
    const typeDistribution = blueprint.layout?.types || blueprint.typeCounts || {};

    // Check Feature Access
    const canRecreate = getTierConfig(userProfile?.subscription_tier).features.aiStrategy;
    const hasStrategy = !!blueprint.strategy;

    const handleRerunning = async () => {
        if (!userProfile?.settings?.geminiApiKey) {
            addToast("Gemini API Key missing in settings.", "error");
            return;
        }

        setIsRerunning(true);
        try {
            console.log('[DeckStrategy] requesting new strategy...');
            console.log('[DeckStrategy] Raw Deck:', deck);
            console.log('[DeckStrategy] User Profile:', userProfile);

            // Validate & Sanitize Commander Data
            const rawCommanders = [deck.commander, deck.commander_partner].filter(Boolean);
            const sanitizedCommanders = rawCommanders.map(c => {
                // Fallback for flat structure vs nested data structure
                const name = c.name || c.data?.name || 'Unknown';
                const mana_cost = c.mana_cost || c.cmc || c.data?.mana_cost || c.data?.cmc || '0';
                const type_line = c.type_line || c.data?.type_line || 'Legendary Creature';
                const oracle_text = c.oracle_text || c.data?.oracle_text || '';

                return { name, mana_cost, type_line, oracle_text };
            });

            console.log('[DeckStrategy] sanitizedCommanders:', sanitizedCommanders);

            // Robust Playstyle Check with Deep Search
            let activePlaystyle = userProfile.playstyle || userProfile.settings?.playstyle || userProfile.data?.playstyle || null;

            // If still missing, check if it's nested in a 'data' field on the profile response
            if (!activePlaystyle && userProfile.data && userProfile.data.playstyle) {
                activePlaystyle = userProfile.data.playstyle;
            }

            if (!activePlaystyle) {
                console.warn('[DeckStrategy] User playstyle NOT found. Profile keys:', Object.keys(userProfile));
                // Fallback to avoid "undefined" in prompt, providing a generic profile if missing
                activePlaystyle = {
                    summary: "Balanced Magic player enjoying strategic depth and interaction.",
                    archetypes: ["Midrange", "Control"],
                    scores: { aggression: 5 }
                };
            } else {
                console.log('[DeckStrategy] playstyle found:', activePlaystyle);
            }

            const newStrategy = await GeminiService.getDeckStrategy(
                userProfile.settings.geminiApiKey,
                sanitizedCommanders,
                activePlaystyle,
                cards,
                userProfile?.settings?.helper,
                userProfile
            );
            console.log('[DeckStrategy] new strategy received:', newStrategy);

            const updateRes = await deckService.updateDeck(currentUser.uid, deck.id, {
                aiBlueprint: {
                    ...blueprint,
                    theme: newStrategy.theme,
                    strategy: newStrategy.strategy,
                    layout: newStrategy.layout // Save standardized layout
                }
            });
            console.log('[DeckStrategy] update response:', updateRes);

            addToast("Strategy updated based on your current build!", "success");

            // Wait a moment for DB propagation
            await new Promise(resolve => setTimeout(resolve, 500));

            if (onStrategyUpdate) {
                await onStrategyUpdate();
            }
        } catch (err) {
            console.error('[DeckStrategy] Rerun Error:', err);
            addToast("Failed to rerun strategy analysis.", "error");
        } finally {
            setIsRerunning(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in overscroll-contain">
            <div className="bg-gray-900/60 backdrop-blur-3xl w-full max-w-5xl max-h-[90vh] mx-auto rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden ring-1 ring-white/5 relative">

                {/* Decorative Background Glows */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
                <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

                {/* Header */}
                <div className="px-4 py-6 md:px-10 md:py-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center bg-white/5 shrink-0 relative z-10 gap-4 md:gap-0">
                    <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                        <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-inner backdrop-blur-sm">
                            <span className="text-3xl">🔮</span>
                        </div>
                        <div>
                            <h2
                                className="text-xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none mb-1"
                                dangerouslySetInnerHTML={{ __html: theme }}
                            />
                            <p className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.3em]">{helperName} Strategic Blueprint</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-end">
                        <button
                            onClick={canRecreate ? handleRerunning : () => addToast(`Upgrade to ${TIER_CONFIG[TIERS.TIER_2].name} to use AI Strategy tools.`, 'info')}
                            disabled={isRerunning || !canRecreate}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${isRerunning || !canRecreate
                                ? 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-white/20 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-95'
                                }`}
                            title={!canRecreate ? `Requires ${TIER_CONFIG[TIERS.TIER_2].name} Tier` : ''}
                        >
                            {isRerunning ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            )}
                            <span className="md:hidden">{isRerunning ? 'Consulting...' : 'Recreate'}</span>
                            <span className="hidden md:inline">{isRerunning ? `Consulting with ${helperName}...` : `Have ${helperName} Recreate Strategy`}</span>
                        </button>
                        <div className="w-px h-8 bg-white/10 mx-2" />
                        <button
                            onClick={onClose}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-gray-400 hover:text-white border border-white/5 hover:border-white/10 group"
                        >
                            <svg className="w-6 h-6 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-10 py-10 custom-scrollbar space-y-12 relative z-10 overscroll-contain">

                    {/* Strategy Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12">

                        {/* Commander Sidebar */}
                        <div className="space-y-6">
                            <div className="sticky top-0 space-y-6">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-[2rem] group-hover:bg-indigo-500/30 transition-all duration-700" />

                                    {/* Commander Image Container */}
                                    <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 z-10 bg-black/40">
                                        <img
                                            src={getCommanderImage()}
                                            className="w-full h-full object-cover transition-transform duration-700 active:scale-95"
                                            alt={activeCommander?.name}
                                        />

                                        {/* Flip Button Overlay */}
                                        {isDoubleSided && (
                                            <button
                                                onClick={() => setIsFlipped(!isFlipped)}
                                                className="absolute top-4 right-4 p-3 bg-black/60 hover:bg-indigo-600 backdrop-blur-md rounded-full text-white border border-white/20 shadow-lg transition-all group/flip z-30"
                                                title="Flip Card"
                                            >
                                                <svg className={`w-5 h-5 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </button>
                                        )}

                                        {/* Helper Overlay for 'Active' Text (Optional) */}
                                        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                                            <div className="text-white font-bold text-center text-sm leading-tight drop-shadow-md">
                                                {activeCommander.name}
                                                {isDoubleSided && <span className="block text-[9px] text-gray-400 font-normal mt-0.5 uppercase tracking-widest">{isFlipped ? "Back Face" : "Front Face"}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Count Badge */}
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20">
                                        <div className="bg-black/80 text-white px-5 py-2 rounded-full border border-white/10 shadow-xl backdrop-blur-md flex items-center gap-2 whitespace-nowrap">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Cards</span>
                                            <div className="w-px h-3 bg-white/20" />
                                            <span className="text-sm font-black font-mono">{(cards || []).length}/100</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Commander Switcher */}
                                <div className="text-center pt-4 space-y-4">
                                    {/* Lead Commander */}
                                    <div
                                        onClick={() => { setActiveCommanderIndex(0); setIsFlipped(false); }}
                                        className={`cursor-pointer transition-all duration-300 p-2 rounded-xl border ${activeCommanderIndex === 0 ? 'bg-indigo-500/10 border-indigo-500/30' : 'border-transparent hover:bg-white/5'}`}
                                    >
                                        <h4 className={`text-[9px] font-black uppercase tracking-[0.3em] mb-1 ${activeCommanderIndex === 0 ? 'text-indigo-400' : 'text-gray-600'}`}>Lead Commander</h4>
                                        <div className={`font-bold text-sm leading-tight ${activeCommanderIndex === 0 ? 'text-white' : 'text-gray-400'}`}>{commanders[0]?.name}</div>
                                    </div>

                                    {/* Partner Commander */}
                                    {commanders[1] && (
                                        <div
                                            onClick={() => { setActiveCommanderIndex(1); setIsFlipped(false); }}
                                            className={`cursor-pointer transition-all duration-300 p-2 rounded-xl border ${activeCommanderIndex === 1 ? 'bg-purple-500/10 border-purple-500/30' : 'border-transparent hover:bg-white/5'}`}
                                        >
                                            <h4 className={`text-[9px] font-black uppercase tracking-[0.3em] mb-1 ${activeCommanderIndex === 1 ? 'text-purple-400' : 'text-gray-600'}`}>Partnered With</h4>
                                            <div className={`font-bold text-sm leading-tight ${activeCommanderIndex === 1 ? 'text-white' : 'text-gray-400'}`}>{commanders[1].name}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Main Text */}
                        <div className="space-y-10">
                            {/* Notes Section */}
                            <div className="bg-white/5 rounded-[2rem] p-8 border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <span className="text-9xl">📝</span>
                                </div>

                                <button
                                    onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                                    className="w-full text-left focus:outline-none group/header"
                                >
                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                        <span className={`w-8 h-px bg-gray-700 transition-colors group-hover/header:bg-indigo-500`}></span>
                                        Deck Notes
                                        <span className={`transform transition-transform duration-300 ${isNotesExpanded ? 'rotate-180' : ''}`}>
                                            <svg className="w-4 h-4 text-gray-500 group-hover/header:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </span>
                                        {isSavingNotes && <span className="text-indigo-400 animate-pulse ml-2 text-[9px]">Saving...</span>}
                                    </h3>
                                </button>

                                {isNotesExpanded && (
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        onBlur={handleNotesSave}
                                        placeholder="Add your own notes about card choices, combos, or future upgrade plans..."
                                        className="w-full bg-transparent border-0 text-gray-300 placeholder-gray-600 focus:ring-0 resize-none h-32 leading-relaxed animate-fade-in origin-top"
                                    />
                                )}
                            </div>

                            {/* Strategy Text */}
                            <div className="bg-white/5 rounded-[2rem] p-8 border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <span className="text-9xl">📜</span>
                                </div>
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                    <span className="w-8 h-px bg-gray-700"></span>
                                    {hasStrategy || canRecreate ? 'Tactical Overview' : `Tactical Overview (Requires ${TIER_CONFIG[TIERS.TIER_2].name})`}
                                </h3>
                                <div
                                    className="text-gray-300 leading-relaxed strategy-content-refined font-medium text-lg/8"
                                    dangerouslySetInnerHTML={{
                                        __html: (hasStrategy || canRecreate)
                                            ? strategyHtml
                                            : `<p class="italic text-gray-500">Strategy generation is available on the ${TIER_CONFIG[TIERS.TIER_2].name} tier. Upgrade to unlock deep strategic insights for your deck.</p>`
                                    }}
                                />
                            </div>

                            {/* Composition Breakdown */}
                            <div className="space-y-8">
                                {/* Functional Needs */}
                                {Object.keys(functionalNeeds).length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.2em] flex items-center gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                            Target Functional Needs
                                        </h4>
                                        <div className="gap-3 grid grid-cols-1">
                                            {Object.entries(functionalNeeds).map(([type, count]) => (
                                                <div key={type} className="group relative h-8 bg-white/5 rounded-lg overflow-hidden flex items-center">
                                                    {/* Bar Background */}
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-indigo-500/20 group-hover:bg-indigo-500/30 transition-all duration-1000 ease-out rounded-r-lg"
                                                        style={{ width: `${Math.min(100, (count / 40) * 100)}%` }} // Normalized approx max 40 for functional
                                                    />

                                                    <div className="relative z-10 w-full flex justify-between px-4 text-xs font-bold items-center">
                                                        <span className="uppercase tracking-wider text-gray-400 group-hover:text-white transition-colors">{type}</span>
                                                        <span className="font-mono text-indigo-300">{count}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Type Breakdown */}
                                {Object.keys(typeDistribution).length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-purple-400/60 uppercase tracking-[0.2em] flex items-center gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            Target Type Distribution
                                        </h4>
                                        <div className="gap-3 grid grid-cols-1">
                                            {Object.entries(typeDistribution).map(([type, count]) => (
                                                <div key={type} className="group relative h-8 bg-white/5 rounded-lg overflow-hidden flex items-center">
                                                    {/* Bar Background */}
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-purple-500/20 group-hover:bg-purple-500/30 transition-all duration-1000 ease-out rounded-r-lg"
                                                        style={{ width: `${Math.min(100, (count / 40) * 100)}%` }} // Normalized approx max 40 for types
                                                    />

                                                    <div className="relative z-10 w-full flex justify-between px-4 text-xs font-bold items-center">
                                                        <span className="uppercase tracking-wider text-gray-400 group-hover:text-white transition-colors">{type}</span>
                                                        <span className="font-mono text-purple-300">{count}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-10 py-6 border-t border-white/5 bg-white/5 flex justify-end shrink-0 relative z-10">
                    <button
                        onClick={onClose}
                        className="px-8 py-3.5 bg-gray-900/50 hover:bg-gray-800 text-white font-black rounded-2xl transition-all border border-white/10 hover:border-white/20 active:scale-95 text-[11px] uppercase tracking-[0.2em] shadow-lg"
                    >
                        Close Blueprint
                    </button>
                </div>

            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .strategy-content-refined h4 {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: white;
                    margin-top: 1.5rem;
                    margin-bottom: 0.5rem;
                }
                .strategy-content-refined p {
                    margin-bottom: 1rem;
                }
                .strategy-content-refined strong {
                    color: #a5b4fc; /* Indigo 300 */
                }
                .strategy-content-refined ul {
                    list-style-type: disc;
                    padding-left: 1.5rem;
                    margin-bottom: 1rem;
                    color: #9ca3af;
                }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; border: 2px solid transparent; background-clip: content-box; transition: background 0.3s; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); border: 2px solid transparent; background-clip: content-box; }
            ` }} />
        </div>
        , document.body);
};

export default DeckStrategyModal;
