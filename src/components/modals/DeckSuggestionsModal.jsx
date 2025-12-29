import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GeminiService } from '../../services/gemini';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const DeckSuggestionsModal = ({ isOpen, onClose, deck }) => {
    const { userProfile } = useAuth();
    const { addToast } = useToast();

    // State
    const [status, setStatus] = useState('Ready to start.');
    const [logs, setLogs] = useState([]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const [isProcessing, setIsProcessing] = useState(false);
    const [suggestions, setSuggestions] = useState({}); // { cardId: { ...cardData, rating, reason, suggestedCount } }
    const [collection, setCollection] = useState([]);
    const [selectedType, setSelectedType] = useState('All'); // 'All' | 'Creature' | 'Land' | etc.
    const [selectedTab, setSelectedTab] = useState('All');
    const [selectedCards, setSelectedCards] = useState(new Set());
    const [mode, setMode] = useState('preview'); // 'preview' | 'auto'
    const logsEndRef = useRef(null);

    // Initial Load
    useEffect(() => {
        if (isOpen && deck) {
            resetState();
            fetchCollection();
        }
    }, [isOpen, deck]);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const resetState = () => {
        setStatus('Ready to start.');
        setLogs(['Waiting for start...']);
        setIsProcessing(false);
        setSuggestions({});
        setSelectedCards(new Set());
        setSelectedTab('All');
        setSelectedType('All');
    };

    const fetchCollection = async () => {
        try {
            const cards = await api.get('/collection');
            setCollection(cards);
            addLog(`Loaded ${cards.length} cards from collection.`);
        } catch (err) {
            console.error("Failed to load collection", err);
            addLog("Error: Failed to load collection.");
            addToast("Failed to load collection", "error");
        }
    };

    const addLog = (msg) => {
        setLogs(prev => [...prev, msg]);
    };

    // --- Core Logic Ported from deckSuggestions.js ---

    const isColorIdentityValid = (cardColors, commanderColors) => {
        if (!cardColors || cardColors.length === 0) return true; // Colorless
        if (!commanderColors || commanderColors.length === 0) return cardColors.length === 0;
        const commanderSet = new Set(commanderColors);
        return cardColors.every(c => commanderSet.has(c));
    };

    const startAnalysis = async () => {
        if (!userProfile?.settings?.geminiApiKey) {
            addToast("Gemini API Key missing.", "error");
            return;
        }

        setIsProcessing(true);
        addLog("Starting analysis...");

        try {
            const commanderColors = deck.commander?.color_identity || [];
            const blueprint = deck.aiBlueprint || {};
            const typesToFill = ['Synergy / Strategy', 'Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Land'];

            // Build current deck map (excluding commander) but we need to know what's in it by NAME to prevent dupes
            // We use a Set of normalized names for faster lookup
            const cardsMap = deck.cards || {};
            const currentDeckNames = new Set(Object.values(cardsMap).map(c => c.name));

            // ALSO add the Commander to this "In Deck" list so we don't suggest it
            if (deck.commander && deck.commander.name) {
                currentDeckNames.add(deck.commander.name);
            }

            const targetTotal = (deck.format === 'commander' || !deck.format) ? 99 : 59;
            const currentCount = Object.values(cardsMap).reduce((acc, c) => acc + (c.count || 0), 0);

            if (currentCount >= targetTotal && selectedType === 'All') { // Only block if trying to fill EVERYTHING
                // If user wants specific type, allow them to generate suggestions even if deck is "full" (they might swap)
                // But wait, the prompt asks for "up to needed". If needed is 0...
                addLog("Deck is already full!");
                setIsProcessing(false);
                return;
            }

            // Ideal counts (functional defaults)
            const typeTargets = {
                'Land': 36,
                'Mana Ramp': 10,
                'Card Draw': 10,
                'Targeted Removal': 10,
                'Board Wipes': 3,
                'Synergy / Strategy': 30,
                ...(blueprint.suggestedCounts || {})
            };

            // Determine which types to process based on user selection
            const actualTypesToFill = selectedType === 'All' ? typesToFill : [selectedType];

            for (const type of actualTypesToFill) {
                if (!isOpen) break; // Stop if closed

                // Calculate needs
                const currentTypeCount = Object.values(cardsMap)
                    .filter(c => (c.type_line || '').includes(type))
                    .reduce((acc, c) => acc + (c.count || 0), 0);

                // Check stored suggestions too! (If we just added them in this session but haven't saved to DB yet)
                // For now, let's just rely on `suggestions` state if we move to 'auto' mode.

                const target = typeTargets[type] || 0;
                let needed = Math.max(0, target - currentTypeCount);

                // If in specific mode, ensure we at least try to find *something*
                if (selectedType !== 'All' && needed <= 0) needed = 5;

                if (needed <= 0 && selectedType === 'All') {
                    addLog(`${type}: Full (${currentTypeCount}/${target}). Skipping.`);
                    continue;
                }

                addLog(`Analyzing ${type}s... (Need ${needed})`);

                // Filter Candidates
                const seenCandidateNames = new Set();
                const candidates = [];

                // Mapping of Functional Role to Broad Types for filtering
                const roleTypeMap = {
                    'Land': ['land'],
                    'Mana Ramp': ['artifact', 'creature', 'sorcery', 'instant', 'enchantment'], // rocks, dorks, ramp spells
                    'Card Draw': ['artifact', 'creature', 'sorcery', 'instant', 'enchantment'],
                    'Targeted Removal': ['artifact', 'creature', 'sorcery', 'instant', 'enchantment'],
                    'Board Wipes': ['artifact', 'creature', 'sorcery', 'instant', 'enchantment'],
                    'Synergy / Strategy': ['artifact', 'creature', 'sorcery', 'instant', 'enchantment']
                };

                for (const card of collection) {
                    // Normalize Name
                    const name = card.name;
                    if (seenCandidateNames.has(name)) continue;

                    const typeLine = (card.data?.type_line || card.type_line || '').toLowerCase();

                    // Check Color Identity (Use color_identity if available, fallback to colors)
                    // limit to strictly within commander identity
                    const identity = card.data?.color_identity || card.data?.colors || [];
                    if (!isColorIdentityValid(identity, commanderColors)) continue;

                    // Check Type (Heuristic: Ramp/Removal usually filtered by Gemini, but we limit pool size)
                    const broadTypes = roleTypeMap[type] || [];
                    if (!broadTypes.some(bt => typeLine.includes(bt))) continue;

                    // Check if already in deck (by ID) -- SAFEGUARDED
                    if (cardsMap[card.firestoreId || card.id]) continue;

                    // Check duplicate name in Deck (Singleton)
                    if (currentDeckNames.has(name)) continue;

                    // Check if already suggested
                    if (suggestions[card.firestoreId || card.id]) continue;

                    // Pass checks
                    seenCandidateNames.add(name);
                    candidates.push({
                        firestoreId: card.firestoreId || card.id,
                        name: name,
                        type_line: card.data?.type_line || c.type_line,
                        oracle_text: card.data?.oracle_text || '',
                        cmc: card.data?.cmc || 0,
                        owned_count: card.count || 1
                    });
                }

                if (candidates.length === 0) {
                    addLog(`No suitable candidates found for ${type}.`);
                    continue;
                }

                // Prepare Playstyle Context
                const playstyle = userProfile?.playstyle;
                let playstyleContext = "";
                if (playstyle) {
                    playstyleContext = `
                        User Playstyle Profile:
                        - Archetypes: ${playstyle.archetypes?.join(', ') || 'N/A'}
                        - Summary: ${playstyle.summary || 'N/A'}
                        - Scores: Aggression (${playstyle.scores?.aggression || 0}), Combo (${playstyle.scores?.comboAffinity || 0}).
                        Prioritize cards that fit this playstyle if they also fit the deck theme.
                    `;
                }

                // Prepare Prompt
                const promptData = {
                    blueprint,
                    instructions: `
                        Select up to ${needed} best "${type}" cards for a ${deck.format || 'Commander'} deck.
                        Commander: ${deck.commander?.name}.
                        ${playstyleContext}
                        Prioritize cards matching the theme.
                        Return exact firestoreIds.
                    `,
                    candidates: candidates,
                    playstyle: userProfile?.playstyle,
                    targetRole: type
                };

                // Truncate candidates if too many (shim logic to prevent huge payloads)
                if (promptData.candidates.length > 300) {
                    addLog(`Truncating candidate list from ${promptData.candidates.length} to 300.`);
                    promptData.candidates = promptData.candidates.slice(0, 300);
                }

                // Call API
                try {
                    const result = await GeminiService.generateDeckSuggestions(userProfile.settings.geminiApiKey, promptData);

                    if (result && result.suggestions) {
                        const newSuggestions = {};
                        const newIds = [];
                        let addedCount = 0;

                        result.suggestions.forEach(s => {
                            if (s.isBasicLand) {
                                const basicId = `basic-${s.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                                newSuggestions[basicId] = {
                                    id: basicId,
                                    firestoreId: null,
                                    name: s.name,
                                    count: s.count || 1,
                                    rating: s.rating,
                                    reason: s.reason,
                                    suggestedType: type,
                                    isBasicLand: true,
                                    type_line: 'Basic Land'
                                };
                                newIds.push(basicId);
                                addedCount++;
                                return;
                            }

                            const originalCard = candidates.find(c => c.firestoreId === s.firestoreId);
                            if (originalCard && addedCount < needed) {
                                newSuggestions[s.firestoreId] = {
                                    ...originalCard,
                                    rating: s.rating,
                                    reason: s.reason,
                                    suggestedType: type
                                };
                                newIds.push(s.firestoreId);
                                addedCount++;
                            }
                        });


                        if (addedCount > 0) {
                            setSuggestions(prev => ({ ...prev, ...newSuggestions }));
                            setSelectedCards(prev => new Set([...prev, ...newIds]));
                            addLog(`Found ${addedCount} suggestions for ${type}.`);
                        }

                        // Small delay to be nice to API
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } catch (apiErr) {
                    console.error(apiErr);
                    addLog(`Error analyzing ${type}: ${apiErr.message}`);
                }
            }

            // FINAL VALIDATION STEP
            if (selectedType === 'All') {
                addLog("Finalizing Build: AI Oracle Review...");
                setStatus("Final Oracle Review...");
                try {
                    const finalPrompt = {
                        deckName: deck.name,
                        commander: deck.commander,
                        format: deck.format,
                        currentCards: [...Object.values(cardsMap), ...Object.values(suggestions)],
                        playstyle: userProfile?.playstyle,
                        blueprint: blueprint
                    };

                    const review = await GeminiService.sendMessage(userProfile.settings.geminiApiKey, `
                        You are the Senior Deck Oracle. 
                        Review this COMPLETED build (initial suggestions + current cards).
                        Commander: ${deck.commander?.name}
                        Does this deck fully meet the "${blueprint.strategy || 'intended'}" strategy for a ${userProfile?.playstyle?.summary || 'modern'} player?
                        Check for:
                        1. Synergy depth.
                        2. Mana curve health (Bell curve?).
                        3. Interaction quality.
                        
                        Return a short "Oracle Verdict" (2-3 sentences) and a numeric Health Grade (1-100).
                    `);

                    addLog(`${helperName} Verdict: ${review}`);
                } catch (reviewErr) {
                    console.error("Final review failed", reviewErr);
                }
            }

            addLog("Analysis Complete!");
        } catch (err) {
            console.error(err);
            addLog("Analysis failed unexpectedly.");
        } finally {
            setIsProcessing(false);
            setStatus("Finished.");
        }
    };

    const handleApply = async () => {
        if (selectedCards.size === 0) return;

        setIsProcessing(true);
        setStatus('Applying cards to deck...');
        addLog(`Preparing to add ${selectedCards.size} cards...`);

        try {
            const cardsToApply = Array.from(selectedCards).map(id => {
                const s = suggestions[id];
                return {
                    scryfall_id: s.firestoreId || null,
                    name: s.name,
                    finish: 'nonfoil',
                    data: s.data || s,
                    is_wishlist: true,
                    is_basic: s.isBasicLand,
                    count: s.count || 1
                };
            });

            await api.post(`/decks/${deck.id}/cards/batch`, { cards: cardsToApply });
            addToast(`Successfully added ${cardsToApply.length} cards to "${deck.name}"`, 'success');
            onClose();
            // Trigger a refresh if possible, or just reload
            window.location.reload();
        } catch (err) {
            console.error("Failed to apply suggestions", err);
            addLog(`Error: ${err.message}`);
            addToast("Failed to apply suggestions", "error");
        } finally {
            setIsProcessing(false);
            setStatus('Finished.');
        }
    };

    // UI Helpers
    const toggleSelection = (id) => {
        const newSet = new Set(selectedCards);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedCards(newSet);
    };

    if (!isOpen) return null;

    const displayedSuggestions = Object.values(suggestions).filter(s => selectedTab === 'All' || s.suggestedType === selectedTab);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-gray-900/60 backdrop-blur-3xl w-full max-w-6xl max-h-[90vh] mx-auto rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden ring-1 ring-white/5 relative">

                {/* Decorative Background Glows */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5 shrink-0">
                    <div>
                        <h2 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter uppercase leading-none">
                            <span className="text-indigo-400">✨</span>
                            Oracle Deck Architect
                            <span className="text-[10px] font-black text-white/40 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 ml-4 tracking-[0.2em]">
                                {deck?.name}
                            </span>
                        </h2>
                        <p className="text-gray-400 text-sm font-medium mt-3 tracking-wide">Let the {helperName} analyze your collection and architect your perfect build.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex bg-black/30 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                            <button
                                onClick={() => setMode('preview')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'preview'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Preview
                            </button>
                            <button
                                onClick={() => setMode('auto')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'auto'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Auto-Fill
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-gray-400 hover:text-white border border-white/5 hover:border-white/10 group"
                        >
                            <svg className="w-6 h-6 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/5 overflow-hidden">

                    {/* Left Panel: Logs & Controls */}
                    <div className="w-full lg:w-[22rem] flex flex-col shrink-0 bg-black/20">
                        <div className="p-8 border-b border-white/5 bg-white/5 shrink-0 space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.4em]">Architect Status</h3>
                                <div className="flex items-center gap-3 bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <div className={`w-3 h-3 rounded-full shadow-[0_0_12px] ${isProcessing ? 'bg-yellow-500 shadow-yellow-500/50 animate-pulse' : 'bg-green-500 shadow-green-500/50'}`}></div>
                                    <span className="text-xs font-black text-white uppercase tracking-widest font-mono">{isProcessing ? 'Architecting...' : 'System Ready'}</span>
                                </div>
                            </div>

                            <button
                                onClick={startAnalysis}
                                disabled={isProcessing}
                                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all flex items-center justify-center gap-3 shadow-2xl border ${isProcessing
                                    ? 'bg-indigo-900/30 text-indigo-300 border-indigo-500/20 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]'
                                    }`}
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <span className="text-lg">⚡</span> Start Architecture
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 font-mono text-[10px] space-y-2 text-gray-500 custom-scrollbar bg-black/10">
                            {logs.map((log, i) => (
                                <div key={i} className="border-l-2 border-indigo-500/20 pl-4 py-1 animate-fade-in hover:border-indigo-500/40 transition-colors">
                                    {log}
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* Right Panel: Results */}
                    <div className="flex-1 flex flex-col bg-black/5 relative">
                        <div className="flex items-center gap-2 p-4 bg-white/5 border-b border-white/5 overflow-x-auto no-scrollbar shrink-0">
                            {['All', 'Land', 'Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Synergy / Strategy'].map((tab) => {
                                const count = Object.values(suggestions).filter(s => tab === 'All' || s.suggestedType === tab).length;
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setSelectedTab(tab)}
                                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all border ${selectedTab === tab
                                            ? 'bg-white/10 text-white border-white/20 shadow-lg'
                                            : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'
                                            }`}
                                    >
                                        {tab} <span className="ml-2 opacity-40 bg-black/40 px-2 py-0.5 rounded-full font-mono">{count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Table Header */}
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-6 px-8 py-4 bg-white/5 border-b border-white/5 text-[9px] font-black text-indigo-400/40 uppercase tracking-[0.4em] shrink-0">
                            <div className="w-8 flex justify-center">
                                <div className="w-5 h-5 rounded border-2 border-white/10" />
                            </div>
                            <div>Card Identity</div>
                            <div>Classification</div>
                            <div className="text-center">Utility Rating</div>
                            <div className="w-64">Strategic Rationale</div>
                        </div>

                        {/* Suggestions Grid */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-4">
                            {displayedSuggestions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-6 opacity-40">
                                    <div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center border border-white/5">
                                        <span className="text-4xl">🎴</span>
                                    </div>
                                    <p className="font-black uppercase tracking-[0.5em] text-[10px]">Architecting Design...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {displayedSuggestions.map((card, idx) => (
                                        <div
                                            key={card.id || card.firestoreId || `suggest-${idx}`}
                                            className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-6 px-8 py-3 items-center rounded-[1.25rem] border transition-all duration-500 cursor-pointer group/row ${selectedCards.has(card.firestoreId || card.id)
                                                ? 'bg-indigo-500/15 border-indigo-500/40 shadow-2xl shadow-indigo-500/10'
                                                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/10 hover:-translate-y-0.5 shadow-sm'
                                                }`}
                                            onClick={() => toggleSelection(card.firestoreId || card.id)}
                                        >
                                            <div className="w-8 flex justify-center">
                                                <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${selectedCards.has(card.firestoreId || card.id)
                                                    ? 'bg-indigo-500 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.6)]'
                                                    : 'bg-black/40 border-white/10 group-hover/row:border-white/20'
                                                    }`}>
                                                    {selectedCards.has(card.firestoreId || card.id) && (
                                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="font-black text-white flex items-center gap-4">
                                                <span className="text-base group-hover/row:text-indigo-300 transition-colors uppercase tracking-tight">{card.name}</span>
                                                {card.data?.mana_cost && (
                                                    <span className="text-[10px] font-black text-white/30 bg-black/40 px-3 py-1.5 rounded-full border border-white/5 font-mono group-hover/row:text-white/60 transition-colors">
                                                        {card.data.mana_cost}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] font-black text-white/20 uppercase tracking-[0.15em] truncate max-w-[180px] group-hover/row:text-white/40 transition-colors">{card.type_line}</div>
                                            <div className="flex justify-center">
                                                <div className={`
                                                    px-5 py-2.5 rounded-2xl font-black text-[12px] border transition-all shadow-xl
                                                    ${(card.rating || 0) >= 9 ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-indigo-500/10' :
                                                        (card.rating || 0) >= 7 ? 'bg-indigo-500/10 text-indigo-400/80 border-indigo-500/20' :
                                                            'bg-white/5 text-gray-500 border-white/5'}
                                                `}>
                                                    {card.rating ? `${card.rating}/10` : '-'}
                                                </div>
                                            </div>
                                            <div className="text-[12px] text-gray-400 font-medium italic w-64 truncate bg-black/20 p-2.5 rounded-xl border border-white/5 group-hover/row:bg-black/40 transition-all leading-relaxed" title={card.reason}>
                                                "{card.reason}"
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-8 bg-black/30 border-t border-white/5 flex justify-end gap-6 shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            <div className="flex flex-col items-end justify-center mr-auto pl-2">
                                <span className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.4em]">Selection Inventory</span>
                                <span className="text-2xl font-black text-white tracking-tighter uppercase leading-none mt-1">
                                    {selectedCards.size} <span className="text-[10px] text-gray-600 font-black tracking-widest ml-1">Cards Drafted</span>
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-8 py-3.5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all border border-white/5 hover:border-white/10 active:scale-95 text-[11px] uppercase tracking-[0.2em]"
                            >
                                Discard Design
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={selectedCards.size === 0}
                                className="px-10 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-[0_0_30px_rgba(79,70,229,0.3)] disabled:opacity-30 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 active:scale-95 text-[11px] uppercase tracking-[0.3em] border border-white/20 whitespace-nowrap"
                            >
                                Deploy Build to Deck
                            </button>
                        </div>
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                    .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); margin: 20px 0; border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; border: 2px solid transparent; background-clip: content-box; transition: background 0.3s; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); border: 2px solid transparent; background-clip: content-box; }
                ` }} />
            </div>
        </div>
    );
};

export default DeckSuggestionsModal;
