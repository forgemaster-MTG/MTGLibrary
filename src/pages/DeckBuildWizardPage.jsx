import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDeck } from '../hooks/useDeck';
import { useCollection } from '../hooks/useCollection';
import { GeminiService } from '../services/gemini';
import { api } from '../services/api';
import CardGridItem from '../components/common/CardGridItem';

const STEPS = {
    ANALYSIS: 1,
    ARCHITECT: 2,
    DEPLOY: 3
};

const DeckBuildWizardPage = () => {
    const { deckId } = useParams();
    const navigate = useNavigate();
    const { userProfile, currentUser } = useAuth();
    const { addToast } = useToast();
    const { deck, cards: deckCards, loading: deckLoading, error: deckError } = useDeck(deckId);
    const { cards: collection } = useCollection();

    // Wizard State
    const [step, setStep] = useState(STEPS.ANALYSIS);
    const [status, setStatus] = useState(`Initializing ${userProfile?.settings?.helper?.name || 'Oracle'}...`);
    const [logs, setLogs] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [suggestions, setSuggestions] = useState({}); // { id: { ...cardData, rating, reason, suggestedType } }
    const [selectedCards, setSelectedCards] = useState(new Set());
    const [selectedTab, setSelectedTab] = useState('All');
    const [viewMode, setViewMode] = useState('grid'); // 'list', 'grid', 'table'
    const logsEndRef = useRef(null);

    // Analysis Settings
    const [analysisSettings, setAnalysisSettings] = useState({
        ownedOnly: true,       // If true, filter out wishlist items
        excludeAssigned: true, // If true, filter out cards already in other decks
        restrictSet: false,
        setName: '',
        finishPreference: 'cheapest' // 'cheapest', 'nonfoil', 'foil'
    });

    // Discovery Mode State
    const [buildMode, setBuildMode] = useState('collection'); // 'collection' | 'discovery'
    const [strategyInput, setStrategyInput] = useState('');

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Pre-fill Set Name from Commander
    useEffect(() => {
        if (deck?.commander?.set_name && !analysisSettings.setName) {
            setAnalysisSettings(prev => ({ ...prev, setName: deck.commander.set_name }));
        }
    }, [deck, analysisSettings.setName]);

    const addLog = (msg) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`]);
    };

    // --- Helpers ---

    const helperName = userProfile?.settings?.helper?.name || 'The Oracle';

    const getArtCrop = (card) => {
        if (!card) return null;
        const data = card.data || card;
        if (data.image_uris?.art_crop) return data.image_uris.art_crop;
        if (data.card_faces?.[0]?.image_uris?.art_crop) return data.card_faces[0].image_uris.art_crop;
        if (data.image_uris?.normal) return data.image_uris.normal;
        return null;
    };

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const BASIC_LAND_IDS = {
        W: '00000000-0000-0000-0000-000000000001',
        U: '00000000-0000-0000-0000-000000000002',
        B: '00000000-0000-0000-0000-000000000003',
        R: '00000000-0000-0000-0000-000000000004',
        G: '00000000-0000-0000-0000-000000000005'
    };

    const isColorIdentityValid = (cardColors, commanderColors) => {
        if (!cardColors || cardColors.length === 0) return true; // Colorless
        if (!commanderColors || commanderColors.length === 0) return cardColors.length === 0;
        const commanderSet = new Set(commanderColors);
        return cardColors.every(c => commanderSet.has(c));
    };

    const calculateManaStats = (currentCards, suggestedCards) => {
        const stats = { W: 0, U: 0, B: 0, R: 0, G: 0, total: 0 };
        const countPips = (cost) => {
            if (!cost) return;
            stats.W += (cost.match(/\{W\}/g) || []).length;
            stats.U += (cost.match(/\{U\}/g) || []).length;
            stats.B += (cost.match(/\{B\}/g) || []).length;
            stats.R += (cost.match(/\{R\}/g) || []).length;
            stats.G += (cost.match(/\{G\}/g) || []).length;
        };
        currentCards.forEach(c => countPips(c.mana_cost || c.data?.mana_cost));
        Object.values(suggestedCards).forEach(s => countPips(s.data?.mana_cost || s.type_line));
        stats.total = stats.W + stats.U + stats.B + stats.R + stats.G;
        return stats;
    };

    const generateBasicLands = (neededCount, manaStats, collection) => {
        if (neededCount <= 0) return {};
        if (manaStats.total === 0) return {};
        const basicLands = {
            W: { name: 'Plains', type: 'Basic Land — Plains' },
            U: { name: 'Island', type: 'Basic Land — Island' },
            B: { name: 'Swamp', type: 'Basic Land — Swamp' },
            R: { name: 'Mountain', type: 'Basic Land — Mountain' },
            G: { name: 'Forest', type: 'Basic Land — Forest' }
        };
        const landSuggestions = {};
        const distribution = { W: 0, U: 0, B: 0, R: 0, G: 0 };
        let distributed = 0;
        ['W', 'U', 'B', 'R', 'G'].forEach(color => {
            if (manaStats[color] > 0) {
                const ratio = manaStats[color] / manaStats.total;
                const count = Math.round(neededCount * ratio);
                distribution[color] = count;
                distributed += count;
            }
        });
        if (distributed > 0) {
            const colors = Object.keys(distribution).filter(k => distribution[k] > 0);
            colors.sort((a, b) => distribution[b] - distribution[a]);
            if (distributed < neededCount) distribution[colors[0]] += (neededCount - distributed);
            else if (distributed > neededCount) distribution[colors[0]] -= (distributed - neededCount);
        }
        Object.entries(distribution).forEach(([color, count]) => {
            if (count > 0) {
                const landInfo = basicLands[color];
                const mockId = BASIC_LAND_IDS[color];
                const candidate = collection.find(c => c.name === landInfo.name) || {
                    name: landInfo.name,
                    type_line: landInfo.type,
                    scryfall_id: mockId,
                    id: mockId,
                    image_uris: { normal: `https://api.scryfall.com/cards/named?exact=${landInfo.name}&format=image` }
                };
                for (let i = 0; i < count; i++) {
                    const uniqueId = `basic-${color}-${i}-${Date.now()}`;
                    landSuggestions[uniqueId] = {
                        firestoreId: uniqueId,
                        name: landInfo.name,
                        type_line: landInfo.type,
                        rating: 10,
                        reason: `Auto-filled to match ${Math.round((manaStats[color] / manaStats.total) * 100)}% ${color} pip density.`,
                        suggestedType: 'Land',
                        data: {
                            ...(candidate.data || candidate),
                            scryfall_id: candidate.scryfall_id || candidate.id || mockId
                        },
                        isVirtual: true
                    };
                }
            }
        });
        return landSuggestions;
    };

    // --- Core Logic ---

    const startAnalysis = async () => {
        if (!userProfile?.settings?.geminiApiKey) {
            addToast("Gemini API Key missing in settings.", "error");
            navigate('/settings/ai');
            return;
        }

        setIsProcessing(true);
        setStatus(`Preparing ${buildMode === 'discovery' ? 'Global Analysis' : 'Collection Analysis'}...`);
        addLog(`Starting analysis (Mode: ${buildMode.toUpperCase()})...`);

        try {
            const commanderColors = [...new Set([...(deck.commander?.color_identity || []), ...(deck.commander_partner?.color_identity || [])])];
            const blueprint = deck.aiBlueprint || {};
            const typesToFill = ['Synergy / Strategy', 'Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Land'];

            const currentDeckNames = new Set(deckCards.map(c => c.name));
            if (deck.commander?.name) currentDeckNames.add(deck.commander.name);
            if (deck.commander_partner?.name) currentDeckNames.add(deck.commander_partner.name);

            const strategyTargets = blueprint.layout?.functional || blueprint.suggestedCounts || {};
            const typeTargets = {
                'Land': 36,
                'Mana Ramp': 10,
                'Card Draw': 10,
                'Targeted Removal': 10,
                'Board Wipes': 3,
                'Synergy / Strategy': 30,
                ...strategyTargets
            };

            const allNewSuggestions = {};
            const initialSelectedIds = new Set();
            const setFilterLower = (analysisSettings.setName || '').toLowerCase().trim();

            const deckRequirements = {};
            let totalNeeded = 0;

            for (const type of typesToFill) {
                const currentTypeCount = deckCards
                    .filter(c => (c.data?.type_line || c.type_line || '').includes(type))
                    .reduce((acc, c) => acc + (c.countInDeck || 1), 0);

                const target = typeTargets[type] || 0;
                let needed = Math.max(0, target - currentTypeCount);
                if (needed > 0) {
                    deckRequirements[type] = needed;
                    totalNeeded += needed;
                }
            }

            if (totalNeeded === 0) {
                addLog("Deck goals appear met! No missing slots found based on targets.");
                setIsProcessing(false);
                setStatus('Idle');
                return;
            }

            const candidates = [];
            if (buildMode === 'collection') {
                addLog(`Scanning collection for candidates...`);
                const seenNames = new Set();
                for (const card of collection) {
                    if (seenNames.has(card.name)) continue;
                    if (analysisSettings.ownedOnly && card.is_wishlist) continue;
                    if (analysisSettings.excludeAssigned && card.deckId) continue;
                    const identity = card.data?.color_identity || card.data?.colors || [];
                    if (!isColorIdentityValid(identity, commanderColors)) continue;
                    if (currentDeckNames.has(card.name)) continue;
                    if (analysisSettings.restrictSet && setFilterLower) {
                        const cardSet = (card.set_name || card.data?.set_name || '').toLowerCase();
                        const cardSetCode = (card.set || card.data?.set || '').toLowerCase();
                        if (!cardSet.includes(setFilterLower) && cardSetCode !== setFilterLower) continue;
                    }
                    candidates.push({ firestoreId: card.id, name: card.name, type_line: card.data?.type_line || card.type_line });
                    seenNames.add(card.name);
                }
                if (candidates.length === 0) {
                    addLog("No valid candidates found with current filters.");
                    setIsProcessing(false);
                    setStatus('Idle');
                    return;
                }
                addLog(`Payload: ${candidates.length} Cards available for Analysis.`);
            } else {
                addLog("Discovery Mode Active: Bypassing collection scan. AI will search global database.");
            }

            const promptData = {
                deckName: deck.name,
                commander: `${deck.commander?.name}${deck.commander_partner ? ' & ' + deck.commander_partner.name : ''}`,
                playerProfile: JSON.stringify(userProfile?.playstyle || {}),
                strategyGuide: blueprint?.strategy || 'No specific strategy guide.',
                helperPersona: userProfile?.settings?.helper,
                instructions: `Fill the following deck slots: ${JSON.stringify(deckRequirements)}. 
                    ${strategyInput ? `STRATEGY FOCUS: ${strategyInput}` : ''}
                    IMPORTANT: For every card suggested, you MUST provide the specific 'set' code and 'collectorNumber' from Scryfall to ensure the correct printing is identified.`,
                deckRequirements: deckRequirements,
                candidates: buildMode === 'collection' ? candidates.slice(0, 3500) : [],
                buildMode: buildMode,
                currentContext: Array.from(currentDeckNames),
                neededCount: totalNeeded,
                commanderColorIdentity: commanderColors.join('') || 'Colorless'
            };

            setStatus(`Consulting ${helperName} for Holistic Analysis...`);

            const fetchAndResolveSuggestions = async (requirements, context) => {
                const currentBatchSuggestions = {};
                const currentBatchIds = new Set();

                const LOADING_MESSAGES = ["Consulting the archives...", "Analysing mana curves...", "Simulating games...", "Searching for hidden gems...", "Optimizing synergy lines..."];
                let loadingInterval = setInterval(() => {
                    const randomMsg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
                    setStatus(`${helperName}: ${randomMsg}`);
                }, 2500);

                const currentPromptData = {
                    ...promptData,
                    deckRequirements: requirements,
                    currentContext: context,
                    neededCount: Object.values(requirements).reduce((a, b) => a + b, 0)
                };

                try {
                    addLog(`Requesting ${currentPromptData.neededCount} cards from ${helperName}...`);
                    const result = await GeminiService.generateDeckSuggestions(userProfile.settings.geminiApiKey, currentPromptData, null, userProfile);
                    if (loadingInterval) clearInterval(loadingInterval);

                    if (result?.suggestions) {
                        const sortedSuggestions = result.suggestions.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                        const roleCounts = {};
                        const cappedSuggestions = sortedSuggestions.filter(s => {
                            const role = s.role || 'Synergy / Strategy';
                            const target = requirements[role] || 0;
                            roleCounts[role] = (roleCounts[role] || 0) + 1;
                            return roleCounts[role] <= target;
                        });

                        for (const s of cappedSuggestions) {
                            const role = s.role || 'Synergy / Strategy';
                            if (buildMode === 'discovery' && (!s.firestoreId || s.firestoreId === 'discovery')) {
                                await new Promise(r => setTimeout(r, 100)); // Throttle
                                addLog(`Resolving "${s.name}"...`);
                                const response = await api.post(`/api/cards/search`, {
                                    query: s.name, set: s.set, cn: s.collectorNumber,
                                    preferFinish: analysisSettings.finishPreference
                                });
                                const scryData = (response.data || [])[0];
                                if (scryData) {
                                    const id = scryData.uuid || scryData.id;
                                    currentBatchSuggestions[id] = {
                                        ...s, firestoreId: id, name: scryData.name,
                                        type_line: scryData.type_line || scryData.type,
                                        data: scryData, isDiscovery: true,
                                        is_wishlist: !collection.some(c => (c.scryfall_id || c.uuid) === id),
                                        suggestedType: role
                                    };
                                    currentBatchIds.add(id);
                                }
                            } else if (s.firestoreId) {
                                const fullCard = collection.find(c => c.id === s.firestoreId);
                                if (fullCard) {
                                    currentBatchSuggestions[s.firestoreId] = {
                                        ...s, firestoreId: s.firestoreId, name: fullCard.name,
                                        type_line: fullCard.data?.type_line || fullCard.type_line,
                                        data: fullCard.data || fullCard, suggestedType: role
                                    };
                                    currentBatchIds.add(s.firestoreId);
                                }
                            }
                        }
                    }
                } catch (err) {
                    if (loadingInterval) clearInterval(loadingInterval);
                    throw err;
                } finally {
                    if (loadingInterval) clearInterval(loadingInterval);
                }
                return { suggestions: currentBatchSuggestions, ids: currentBatchIds };
            };

            // Pass 1
            const { suggestions: p1S, ids: p1I } = await fetchAndResolveSuggestions(deckRequirements, Array.from(currentDeckNames));
            Object.assign(allNewSuggestions, p1S);
            p1I.forEach(id => initialSelectedIds.add(id));

            // Check for color identity violations
            const badIds = [];
            Object.entries(allNewSuggestions).forEach(([id, s]) => {
                const identity = s.data?.color_identity || [];
                if (!isColorIdentityValid(identity, commanderColors)) {
                    addLog(`⚠️ "${s.name}" violates color identity. Discarding.`);
                    badIds.push(id);
                }
            });

            if (badIds.length > 0) {
                const refinementReqs = {};
                badIds.forEach(id => {
                    const role = allNewSuggestions[id].suggestedType;
                    refinementReqs[role] = (refinementReqs[role] || 0) + 1;
                    delete allNewSuggestions[id];
                    initialSelectedIds.delete(id);
                });

                addLog(`Detected ${badIds.length} illegal cards. Refining...`);
                const fullContext = [...Array.from(currentDeckNames), ...Object.values(allNewSuggestions).map(s => s.name)];

                try {
                    const { suggestions: refS, ids: refI } = await fetchAndResolveSuggestions(refinementReqs, fullContext);
                    Object.assign(allNewSuggestions, refS);
                    refI.forEach(id => initialSelectedIds.add(id));
                } catch (err) {
                    addLog("Refinement unsuccessful. Proceeding.");
                }
            }


            // 1. Calculate how many lands we need to hit the SPECIFIC land target
            const currentLands = deckCards.filter(c => (c.data?.type_line || c.type_line || '').includes('Land')).length;
            const suggestedLands = Object.values(allNewSuggestions).filter(s => s.suggestedType === 'Land').length;
            const targetLands = typeTargets['Land'] || 36;
            let neededLands = Math.max(0, targetLands - (currentLands + suggestedLands));

            // 2. Only fill the exact land slots required by the strategy.
            // Do NOT overfill to force 100 cards if the AI missed some functional slots.
            const finalFillCount = neededLands;

            if (finalFillCount > 0) {
                addLog(`Balancing mana base and filling ${finalFillCount} remaining slots...`);
                const basicLandSuggestions = generateBasicLands(finalFillCount, calculateManaStats(deckCards, allNewSuggestions), collection);
                Object.assign(allNewSuggestions, basicLandSuggestions);
                Object.keys(basicLandSuggestions).forEach(id => initialSelectedIds.add(id));
            }

            setSuggestions(allNewSuggestions);
            setSelectedCards(initialSelectedIds);
            addLog("Analysis complete.");
            setStep(STEPS.ARCHITECT);
        } catch (err) {
            console.error(err);
            addToast("Architecture failed. Please check your AI key.", "error");
        } finally {
            setIsProcessing(false);
            setStatus('Ready.');
        }
    };

    const handleQuickSkip = () => setStep(STEPS.ARCHITECT);

    const toggleSelection = (id) => {
        const newSet = new Set(selectedCards);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedCards(newSet);
    };

    const renderAnalysis = () => (
        <div className="max-w-4xl mx-auto space-y-12 py-12">
            <div className="text-center space-y-4">
                <div className="inline-block p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 mb-4 animate-bounce">
                    <span className="text-4xl">✨</span>
                </div>
                <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">{helperName} Deck Architect</h1>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                    {helperName} will analyze your collection and current deck composition to architect the perfect additions for <span className="text-indigo-400 font-bold">{deck?.name}</span>.
                </p>
            </div>

            <div className="bg-gray-900/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-indigo-500/20 p-2 rounded-lg">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">Builder Configuration</h3>
                </div>

                {/* Mode Switcher */}
                <div className="bg-gray-950/50 p-1 rounded-xl flex mb-6">
                    <button
                        onClick={() => setBuildMode('collection')}
                        className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${buildMode === 'collection' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                        Collection Mode
                    </button>
                    <button
                        onClick={() => setBuildMode('discovery')}
                        className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${buildMode === 'discovery' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                        Discovery Mode
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {buildMode === 'discovery' && (
                        <div className="md:col-span-2 space-y-4 animate-fade-in">
                            <label className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                Strategy Focus / Specific Requests
                            </label>
                            <textarea
                                value={strategyInput}
                                onChange={(e) => setStrategyInput(e.target.value)}
                                placeholder="E.g. 'I want a Dinosaur tribal theme with aggressive ramp'..."
                                className="w-full h-32 bg-gray-950/50 border border-purple-500/30 rounded-2xl p-4 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-purple-500/50 outline-none resize-none shadow-inner"
                            />
                            <p className="text-[10px] text-gray-500 italic">
                                Note: Discovery Mode searches the entire Magic history. Cards you don't own will be marked as <strong>Wishlist</strong> items.
                            </p>
                        </div>
                    )}

                    {buildMode === 'collection' && (
                        <>
                            <div className="space-y-4">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Candidate Pool</label>

                                <div className="flex items-center justify-between p-3 bg-gray-950/30 rounded-xl border border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-200">Owned Cards Only</span>
                                        <span className="text-[10px] text-gray-500">Hide wishlist items</span>
                                    </div>
                                    <div
                                        onClick={() => setAnalysisSettings(s => ({ ...s, ownedOnly: !s.ownedOnly }))}
                                        className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${analysisSettings.ownedOnly ? 'bg-indigo-600' : 'bg-gray-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${analysisSettings.ownedOnly ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-950/30 rounded-xl border border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-200">Exclude Assigned</span>
                                        <span className="text-[10px] text-gray-500">Skip cards in other decks</span>
                                    </div>
                                    <div
                                        onClick={() => setAnalysisSettings(s => ({ ...s, excludeAssigned: !s.excludeAssigned }))}
                                        className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${analysisSettings.excludeAssigned ? 'bg-indigo-600' : 'bg-gray-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${analysisSettings.excludeAssigned ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Set Priority</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="restrictSet"
                                            checked={analysisSettings.restrictSet}
                                            onChange={(e) => setAnalysisSettings(s => ({ ...s, restrictSet: e.target.checked }))}
                                            className="rounded bg-gray-800 border-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
                                        />
                                        <label htmlFor="restrictSet" className="text-xs text-indigo-300 font-bold cursor-pointer select-none">Restrict to Set</label>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    disabled={!analysisSettings.restrictSet}
                                    value={analysisSettings.setName}
                                    onChange={(e) => setAnalysisSettings(s => ({ ...s, setName: e.target.value }))}
                                    placeholder="e.g. Avatar, KTK, Khans..."
                                    className={`w-full bg-gray-950/50 border rounded-xl px-4 py-2.5 text-sm transition-all focus:ring-2 focus:ring-indigo-500/50 outline-none ${!analysisSettings.restrictSet ? 'border-white/5 text-gray-600 cursor-not-allowed' : 'border-indigo-500/30 text-white placeholder-gray-600'}`}
                                />
                                {analysisSettings.restrictSet && (
                                    <p className="text-[10px] text-yellow-500/80 font-medium animate-fade-in">
                                        ⚠️ Only cards matching "{analysisSettings.setName}" will be suggested.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Finish / Price Preference</label>
                                <select
                                    value={analysisSettings.finishPreference}
                                    onChange={(e) => setAnalysisSettings(s => ({ ...s, finishPreference: e.target.value }))}
                                    className="w-full bg-gray-950/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                >
                                    <option value="cheapest">Cheapest Version (Any)</option>
                                    <option value="nonfoil">Normal (Non-Foil)</option>
                                    <option value="foil">Premium (Foil Only)</option>
                                </select>
                                <p className="text-[10px] text-gray-500 italic">
                                    Determines which printing {helperName} selects when resolving suggestions.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="bg-gray-950/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">{status}</span>
                        </div>
                        <div className="flex gap-4">
                            {(currentUser?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3' || userProfile?.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3') && (
                                <button
                                    onClick={handleQuickSkip}
                                    className="bg-amber-600/20 hover:bg-amber-600/40 text-amber-500 font-black px-6 py-3 rounded-2xl transition-all uppercase tracking-widest text-[10px] border border-amber-500/20"
                                >
                                    Quick Skip (Dev)
                                </button>
                            )}
                            {!isProcessing && (
                                <button
                                    onClick={startAnalysis}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-widest text-xs border border-white/10"
                                >
                                    Start Architecture
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="p-8 h-[400px] overflow-y-auto font-mono text-xs space-y-3 custom-scrollbar bg-black/40 backdrop-blur-inner shadow-inner border-t border-white/5 leading-relaxed">
                        {logs.length === 0 ? (
                            <div className="text-gray-600 italic animate-pulse">Waiting for architecture to start...</div>
                        ) : (
                            logs.map((log, i) => <div key={i} className="text-gray-300 animate-fade-in pl-4 border-l-2 border-indigo-500/40 py-1 hover:bg-white/5 transition-colors rounded-r">{log}</div>)
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );

    const renderArchitect = () => {
        const displayedSuggestions = Object.values(suggestions).filter(s => selectedTab === 'All' || s.suggestedType === selectedTab);
        const tabs = ['All', 'Land', 'Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Synergy / Strategy'];

        return (
            <div className="h-full flex flex-col gap-6 py-6">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 px-4">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Selection Phase</h2>
                        <p className="text-gray-500 text-sm font-medium">Review {helperName}'s suggestions and select the ones you want to draft into your deck.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-950/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
                        {[
                            { mode: 'grid', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
                            { mode: 'table', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> },
                            { mode: 'list', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg> }
                        ].map(({ mode, icon }) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`p-2 rounded-xl transition-all ${viewMode === mode ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Categories Scrollable */}
                <div className="flex bg-gray-950/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md overflow-x-auto no-scrollbar mx-4">
                    {tabs.map(tab => {
                        const count = Object.values(suggestions).filter(s => tab === 'All' || s.suggestedType === tab).length;
                        if (tab !== 'All' && count === 0) return null;
                        return (
                            <button
                                key={tab}
                                onClick={() => setSelectedTab(tab)}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                            >
                                {tab} <span className="ml-1 opacity-40 font-mono">{count}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                    {viewMode === 'list' && (
                        <div className="space-y-4">
                            {displayedSuggestions.map((card) => (
                                <div
                                    key={card.firestoreId}
                                    onClick={() => toggleSelection(card.firestoreId)}
                                    className={`grid grid-cols-[auto_1fr_auto_auto] gap-8 items-center p-6 rounded-[2rem] border transition-all cursor-pointer group ${selectedCards.has(card.firestoreId) ? 'bg-indigo-500/10 border-indigo-500/40 shadow-2xl' : 'bg-gray-950/30 border-white/5 hover:border-white/20'}`}
                                >
                                    <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${selectedCards.has(card.firestoreId) ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-white/10 group-hover:border-white/30'}`}>
                                        {selectedCards.has(card.firestoreId) && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <div className="space-y-1 relative group/tooltip">
                                        <div className="flex items-center gap-3">
                                            <span className="block text-xl font-black text-white uppercase italic tracking-tight group-hover:text-indigo-300 transition-colors truncate">{card.name}</span>
                                            {card.data?.mana_cost && (
                                                <span className="text-xs font-bold text-gray-500 bg-gray-900/50 px-2 py-0.5 rounded border border-white/5">{card.data.mana_cost.replace(/[{}]/g, '')}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-indigo-400 tracking-[0.2em] uppercase">{card.type_line}</span>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${card.is_wishlist ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                                                {card.is_wishlist ? 'Wishlist' : 'Owned'}
                                            </span>
                                            {card.data?.power !== undefined && card.data?.toughness !== undefined && (
                                                <span className="text-[10px] font-black text-gray-500 px-2 py-0.5 bg-white/5 rounded">{card.data.power}/{card.data.toughness}</span>
                                            )}
                                        </div>
                                        {card.data?.oracle_text && (
                                            <p className="text-[10px] text-gray-500 line-clamp-1 max-w-sm italic">{card.data.oracle_text}</p>
                                        )}

                                        {/* Image Tooltip */}
                                        <div className="absolute left-0 bottom-full mb-4 w-48 rounded-2xl overflow-hidden shadow-2xl border border-white/20 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-300 z-50 transform group-hover/tooltip:translate-y-[-8px]">
                                            <img
                                                src={card.data?.image_uris?.normal || `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image`}
                                                className="w-full h-auto"
                                                alt={card.name}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center font-mono text-indigo-400 font-bold bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                                        {card.rating}/10
                                    </div>
                                    <div className="max-w-md bg-black/30 p-4 rounded-2xl border border-white/5 text-sm text-gray-400 font-medium italic leading-relaxed">
                                        "{card.reason}"
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {viewMode === 'grid' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
                            {displayedSuggestions.map((card) => (
                                <div
                                    key={card.firestoreId}
                                    onClick={() => toggleSelection(card.firestoreId)}
                                    className={`flex flex-col rounded-[2rem] border transition-all cursor-pointer group overflow-hidden ${selectedCards.has(card.firestoreId) ? 'bg-indigo-500/10 border-indigo-500/40 shadow-2xl' : 'bg-gray-950/30 border-white/5 hover:border-white/20'}`}
                                >
                                    <div className="relative aspect-[3/4] overflow-hidden">
                                        <img
                                            src={card.data?.image_uris?.art_crop || card.data?.image_uris?.normal || `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image`}
                                            alt={card.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-80" />

                                        <div className={`absolute top-4 right-4 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${selectedCards.has(card.firestoreId) ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-black/40 border-white/20 group-hover:border-white/40'}`}>
                                            {selectedCards.has(card.firestoreId) && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                        </div>

                                        <div className="absolute bottom-4 left-4 right-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${card.is_wishlist ? 'bg-purple-500/50 text-white' : 'bg-green-500/50 text-white'}`}>
                                                    {card.is_wishlist ? 'Wishlist' : 'Owned'}
                                                </span>
                                                {card.data?.mana_cost && (
                                                    <span className="text-[10px] font-bold text-white/70">{card.data.mana_cost.replace(/[{}]/g, '')}</span>
                                                )}
                                            </div>
                                            <span className="block text-lg font-black text-white uppercase italic tracking-tight line-clamp-1">{card.name}</span>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] font-black text-indigo-300 tracking-[0.2em] uppercase truncate max-w-[70%]">{card.type_line}</span>
                                                <span className="text-xs font-mono text-indigo-400 font-bold bg-black/60 px-2 py-0.5 rounded-lg border border-white/10">{card.rating}/10</span>
                                            </div>
                                        </div>

                                        {/* Grid Hover Tooltip (Full Card) */}
                                        <div className="absolute inset-0 bg-gray-950/90 opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-center gap-4">
                                            {card.data?.oracle_text && (
                                                <p className="text-[11px] text-gray-300 line-clamp-4 leading-relaxed border-b border-white/5 pb-2">{card.data.oracle_text}</p>
                                            )}
                                            <p className="text-xs text-indigo-300 italic leading-relaxed">"{card.reason}"</p>
                                            <div className="pt-2 flex justify-between items-center">
                                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{card.suggestedType}</span>
                                                {card.data?.power !== undefined && (
                                                    <span className="text-xs font-black text-white/50">{card.data.power}/{card.data.toughness}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {viewMode === 'table' && (
                        <div className="bg-gray-950/30 rounded-[2rem] border border-white/5 overflow-hidden backdrop-blur-xl">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 font-black text-[10px] uppercase tracking-[0.2em] text-gray-500">
                                    <tr>
                                        <th className="px-6 py-4 w-16">Select</th>
                                        <th className="px-6 py-4">Card Name</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4 text-center">Rating</th>
                                        <th className="px-6 py-4">Reasoning</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {displayedSuggestions.map((card) => (
                                        <tr
                                            key={card.firestoreId}
                                            onClick={() => toggleSelection(card.firestoreId)}
                                            className={`hover:bg-white/5 cursor-pointer transition-colors ${selectedCards.has(card.firestoreId) ? 'bg-indigo-500/5' : ''}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedCards.has(card.firestoreId) ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-white/10'}`}>
                                                    {selectedCards.has(card.firestoreId) && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white uppercase italic tracking-tight">{card.name}</span>
                                                    <span className={`text-[8px] font-black w-fit mt-0.5 px-1 rounded uppercase ${card.is_wishlist ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                                                        {card.is_wishlist ? 'Wishlist' : 'Owned'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black text-indigo-400 tracking-[0.1em] uppercase">{card.type_line}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-mono text-indigo-400 font-bold bg-white/5 px-3 py-1 rounded-lg border border-white/5">{card.rating}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-gray-400 italic line-clamp-1">"{card.reason}"</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer Progress Bar */}
                <div className="p-8 bg-gray-950/40 backdrop-blur-3xl rounded-3xl border border-white/10 flex justify-between items-center shadow-2xl mx-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.4em]">Draft Progress</span>
                        <span className="text-3xl font-black text-white italic tracking-tighter uppercase">{selectedCards.size} Cards Selected</span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setStep(STEPS.ANALYSIS)} className="px-8 py-3.5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl border border-white/5 uppercase tracking-widest text-[11px] transition-all">Re-Analyze</button>
                        <button onClick={() => setStep(STEPS.DEPLOY)} className="px-10 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 uppercase tracking-widest text-[11px] border border-white/10 transition-all">Review & Deploy</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderDeploy = () => {
        const cards = Array.from(selectedCards).map(id => suggestions[id]);

        const handleDeploy = async () => {
            if (isProcessing) return;
            setIsProcessing(true);
            try {
                const cardsToApply = [];
                const availabilityMap = new Map();
                collection.forEach(c => {
                    const sid = c.scryfall_id || c.data?.scryfall_id;
                    if (sid && !c.deck_id) availabilityMap.set(sid, (availabilityMap.get(sid) || 0) + 1);
                });

                const existingDeckNames = new Set(deckCards.map(c => c.name));
                const processingNames = new Set();

                for (const s of cards) {
                    const data = s.data || s;
                    const scryfallId = data.scryfall_id || data.id;
                    if (!scryfallId) continue;

                    const isBasicLand = s.name.includes('Plains') || s.name.includes('Island') || s.name.includes('Swamp') || s.name.includes('Mountain') || s.name.includes('Forest');

                    if (!isBasicLand && (processingNames.has(s.name) || existingDeckNames.has(s.name))) continue;

                    processingNames.add(s.name);
                    const isDiscovery = s.isDiscovery || buildMode === 'discovery';
                    let markAsWishlist = isDiscovery;

                    if (scryfallId && availabilityMap.has(scryfallId) && availabilityMap.get(scryfallId) > 0) {
                        markAsWishlist = false;
                        availabilityMap.set(scryfallId, availabilityMap.get(scryfallId) - 1);
                    }

                    cardsToApply.push({
                        scryfall_id: scryfallId,
                        name: s.name,
                        set_code: data.set || data.set_code || '???',
                        collector_number: data.collector_number || '0',
                        finish: 'nonfoil',
                        image_uri: data.image_uris?.normal || null,
                        data: data,
                        count: 1,
                        is_wishlist: markAsWishlist
                    });
                }

                await api.post(`/api/decks/${deckId}/cards/batch`, { cards: cardsToApply });
                addToast(`Successfully added ${cardsToApply.length} cards to ${deck.name}!`, 'success');
                navigate(`/decks/${deckId}`);
            } catch (err) {
                console.error("Deployment failed:", err);
                addToast("Failed to deploy cards. Please try again.", "error");
            } finally {
                setIsProcessing(false);
            }
        };

        return (
            <div className="max-w-5xl mx-auto space-y-12 py-12">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Final Deployment</h2>
                    <p className="text-gray-500 font-medium">Review your selected additions before applying them to your deck.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map(card => (
                        <div key={card.firestoreId} className="bg-gray-950/40 p-6 rounded-[2rem] border border-white/10 space-y-3 relative overflow-hidden group">
                            <div className="flex justify-between items-start">
                                <span className="font-black text-white uppercase italic text-lg truncate block flex-1">{card.name}</span>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${card.is_wishlist ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                                    {card.is_wishlist ? 'Wishlist' : 'Owned'}
                                </span>
                            </div>
                            <div className="text-xs text-indigo-400/60 font-black uppercase tracking-widest">{card.suggestedType}</div>
                            <div className="text-xs text-gray-400 leading-relaxed italic line-clamp-3">"{card.reason}"</div>

                            {/* Hover Image Preview */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
                                <img
                                    src={card.data?.image_uris?.art_crop || card.data?.image_uris?.normal}
                                    className="w-full h-full object-cover"
                                    alt=""
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-6 justify-center pt-8">
                    <button
                        onClick={() => setStep(STEPS.ARCHITECT)}
                        className="px-12 py-4 bg-gray-900/50 hover:bg-gray-800 text-white font-black rounded-2xl border border-white/5 uppercase tracking-widest text-xs transition-all shadow-xl"
                    >
                        Back to Architect
                    </button>
                    <button
                        onClick={handleDeploy}
                        disabled={isProcessing}
                        className="px-16 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/40 uppercase tracking-widest text-xs border border-white/10 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        )}
                        Apply to "{deck?.name}"
                    </button>
                </div>
            </div>
        );
    };

    if (deckLoading) return <div className="flex items-center justify-center h-screen bg-gray-950"><div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;

    const commanderArt = getArtCrop(deck?.commander) || getArtCrop(deck?.commander_partner);

    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 font-sans relative flex flex-col pt-16">
            {/* Immersive Background */}
            <div
                className="fixed inset-0 z-0 transition-all duration-1000 ease-in-out"
                style={{
                    backgroundImage: `url(${commanderArt})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-[2px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/80 to-gray-950/40" />
            </div>

            {/* Navigation Overlay */}
            <div className="sticky top-0 z-50 px-6 py-4 flex justify-between items-center bg-gray-950 border-b border-white/5">
                <button onClick={() => navigate(`/decks/${deckId}`)} className="text-gray-500 hover:text-white flex items-center gap-2 group transition-all">
                    <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    <span className="text-[11px] font-black uppercase tracking-widest">Exit Wizard</span>
                </button>
                <div className="flex gap-12">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`flex items-center gap-3 transition-all ${step === s ? 'scale-110' : 'opacity-40'}`}>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${step >= s ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-600'}`}>
                                {s}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                                {s === 1 ? 'Analysis' : s === 2 ? 'Architect' : 'Deploy'}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="w-32" /> {/* Spacer */}
            </div>

            <main className="flex-1 relative z-10 px-4 max-w-7xl mx-auto w-full">
                {step === STEPS.ANALYSIS && renderAnalysis()}
                {step === STEPS.ARCHITECT && renderArchitect()}
                {step === STEPS.DEPLOY && renderDeploy()}
            </main>

            <style dangerouslySetInnerHTML={{
                __html: `
                .animate-pulse-slow { animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                @keyframes pulse { 0%, 100% { opacity: 0.2; transform: scale(1.05); } 50% { opacity: 0.4; transform: scale(1); } }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            ` }} />
        </div>
    );
};

export default DeckBuildWizardPage;
