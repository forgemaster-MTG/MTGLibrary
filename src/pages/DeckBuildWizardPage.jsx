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
        setName: ''
    });

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
        const isFlipped = false; // Add flip logic if needed later, for now default to front

        if (data.image_uris?.art_crop) return data.image_uris.art_crop;
        if (data.card_faces?.[0]?.image_uris?.art_crop) return data.card_faces[0].image_uris.art_crop;
        if (data.image_uris?.normal) return data.image_uris.normal;
        return null;
    };

    // --- Core Logic ---

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const BASIC_LAND_IDS = {
        W: '00000000-0000-0000-0000-000000000001',
        U: '00000000-0000-0000-0000-000000000002',
        B: '00000000-0000-0000-0000-000000000003',
        R: '00000000-0000-0000-0000-000000000004',
        G: '00000000-0000-0000-0000-000000000005'
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

        // Default to equal distribution if no pips (e.g. artifacts) or colorless
        if (manaStats.total === 0) {
            return {};
        }

        const basicLands = {
            W: { name: 'Plains', type: 'Basic Land — Plains' },
            U: { name: 'Island', type: 'Basic Land — Island' },
            B: { name: 'Swamp', type: 'Basic Land — Swamp' },
            R: { name: 'Mountain', type: 'Basic Land — Mountain' },
            G: { name: 'Forest', type: 'Basic Land — Forest' }
        };

        const landSuggestions = {};
        let distributed = 0;
        const distribution = {};

        ['W', 'U', 'B', 'R', 'G'].forEach(color => {
            if (manaStats[color] > 0) {
                const ratio = manaStats[color] / manaStats.total;
                const count = Math.round(neededCount * ratio);
                distribution[color] = count;
                distributed += count;
            }
        });

        // Adjust for rounding
        if (distributed > 0) {
            const colors = Object.keys(distribution).filter(k => distribution[k] > 0);
            colors.sort((a, b) => distribution[b] - distribution[a]);

            if (distributed < neededCount) {
                distribution[colors[0]] += (neededCount - distributed);
            } else if (distributed > neededCount) {
                distribution[colors[0]] -= (distributed - neededCount);
            }
        }

        Object.entries(distribution).forEach(([color, count]) => {
            if (count > 0) {
                const landInfo = basicLands[color];
                // Use a valid UUID for the mock candidate to allow backend DB insertion (requires UUID type)
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

    const isColorIdentityValid = (cardColors, commanderColors) => {
        if (!cardColors || cardColors.length === 0) return true; // Colorless
        if (!commanderColors || commanderColors.length === 0) return cardColors.length === 0;
        const commanderSet = new Set(commanderColors);
        return cardColors.every(c => commanderSet.has(c));
    };

    const startAnalysis = async () => {
        if (!userProfile?.settings?.geminiApiKey) {
            addToast("Gemini API Key missing in settings.", "error");
            navigate('/settings/ai');
            return;
        }

        setIsProcessing(true);
        setStatus('Scanning Collection...');
        // Force update log to prove new version
        addLog(`Starting analysis (Owned: ${analysisSettings.ownedOnly}, Exclude Assigned: ${analysisSettings.excludeAssigned}, Set: ${analysisSettings.restrictSet ? analysisSettings.setName : 'Any'})...`);

        try {
            const commanderColors = [...new Set([...(deck.commander?.color_identity || []), ...(deck.commander_partner?.color_identity || [])])];
            const blueprint = deck.aiBlueprint || {};
            const typesToFill = ['Synergy / Strategy', 'Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Land'];

            const currentDeckNames = new Set(deckCards.map(c => c.name));
            if (deck.commander?.name) currentDeckNames.add(deck.commander.name);
            if (deck.commander_partner?.name) currentDeckNames.add(deck.commander_partner.name);

            const typeTargets = {
                'Land': 36,
                'Mana Ramp': 10,
                'Card Draw': 10,
                'Targeted Removal': 10,
                'Board Wipes': 3,
                'Synergy / Strategy': 30,
                ...(blueprint.suggestedCounts || {})
            };

            const allNewSuggestions = {};
            const initialSelectedIds = new Set();
            const setFilterLower = analysisSettings.setName.toLowerCase().trim();

            // --- 1. Calculate Needs & Prepare Requirements ---
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

            // --- 2. Gather ALL Candidates Once ---
            addLog(`Scanning collection for candidates (Need ${totalNeeded} total items)...`);

            const candidates = [];
            const seenNames = new Set();
            // Removed duplicate variable declaration here

            for (const card of collection) {
                if (seenNames.has(card.name)) continue;

                // Loop Filters
                // 1. Ownership: If "Owned Only", skip Wishlist items
                if (analysisSettings.ownedOnly && card.is_wishlist) continue;

                // 2. Assignment: If "Exclude Assigned", skip cards in other decks
                if (analysisSettings.excludeAssigned && card.deckId) continue;

                // 3. Color Identity (STRICT - Minimize Payload)
                const identity = card.data?.color_identity || card.data?.colors || [];
                if (!isColorIdentityValid(identity, commanderColors)) continue;

                // 4. Current Deck Dupe Check
                if (currentDeckNames.has(card.name)) continue;

                // 5. Set Restriction
                if (analysisSettings.restrictSet && setFilterLower) {
                    const cardSet = (card.set_name || card.data?.set_name || '').toLowerCase();
                    const cardSetCode = (card.set || card.data?.set || '').toLowerCase();
                    if (!cardSet.includes(setFilterLower) && cardSetCode !== setFilterLower) continue;
                }

                candidates.push({
                    firestoreId: card.id,
                    name: card.name,
                    type_line: card.data?.type_line || card.type_line
                });
                seenNames.add(card.name);
            }

            if (candidates.length === 0) {
                addLog("No valid candidates found with current filters.");
                setIsProcessing(false);
                setStatus('Idle');
                return;
            }

            // --- Candidate Breakdown Logging ---
            const counts = { Creature: 0, Instant: 0, Sorcery: 0, Artifact: 0, Enchantment: 0, Land: 0, Planeswalker: 0 };
            candidates.forEach(c => {
                const t = (c.type_line || '').toLowerCase();
                if (t.includes('creature')) counts.Creature++;
                if (t.includes('instant')) counts.Instant++;
                if (t.includes('sorcery')) counts.Sorcery++;
                if (t.includes('artifact')) counts.Artifact++;
                if (t.includes('enchantment')) counts.Enchantment++;
                if (t.includes('land')) counts.Land++;
                if (t.includes('planeswalker')) counts.Planeswalker++;
            });
            addLog(`Payload: ${candidates.length} Cards available for Analysis.`);
            addLog(`Breakdown: ${counts.Creature} Creatures, ${counts.Instant} Instants, ${counts.Sorcery} Sorceries, ${counts.Artifact} Artifacts, ${counts.Enchantment} Enchantments, ${counts.Land} Lands`);

            // --- 3. Single-Pass API Call ---
            // Gemini 2.5 Flash has ~1M token window. 
            // 3500 cards = ~70k tokens. Safe.
            const promptData = {
                deckName: deck.name,
                commander: `${deck.commander?.name}${deck.commander_partner ? ' & ' + deck.commander_partner.name : ''}`,
                playerProfile: JSON.stringify(userProfile?.playstyle || {}),
                strategyGuide: blueprint?.strategy || 'No specific strategy guide.',
                helperPersona: userProfile?.settings?.helper,
                instructions: `Fill the following deck slots: ${JSON.stringify(deckRequirements)}.`,
                deckRequirements: deckRequirements, // Struct for AI
                candidates: candidates.slice(0, 3500),
                currentContext: Array.from(currentDeckNames),
                neededCount: totalNeeded,
                experienceLevel: "Advanced"
            };

            const LOADING_MESSAGES = [
                "Consulting the archives...",
                "Analysing mana curves...",
                "Simulating 10,000 games...",
                "Checking for infinite combos...",
                "Optimizing synergy lines...",
                "Reviewing EDHRec data...",
                "Considering card advantage engines...",
                "Balancing interaction package...",
                "Calculating probability of turn 3 win...",
                "Searching for hidden gems...",
                "Double-checking rule 0...",
                "Consulting the Oracle...",
                "Gathering arcane wisdom...",
                "Tapping into the leyline..."
            ];

            let attempts = 0;
            while (attempts < 2) {
                let loadingInterval;
                try {
                    addLog(`Consulting ${helperName} for Holistic Analysis (Need ${totalNeeded} cards from ${candidates.length} candidates)...`);

                    // Rotate status messages every 2.5s
                    loadingInterval = setInterval(() => {
                        const randomMsg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
                        setStatus(`${helperName}: ${randomMsg}`);
                    }, 2500);

                    setStatus(`Consulting ${helperName}...`);

                    // Increased delay for huge payload if needed
                    await delay(1500);

                    const result = await GeminiService.generateDeckSuggestions(userProfile.settings.geminiApiKey, promptData);

                    clearInterval(loadingInterval); // Stop rotating on success

                    if (result?.suggestions) {
                        result.suggestions.forEach(s => {
                            const original = candidates.find(c => c.firestoreId === s.firestoreId);
                            if (original) {
                                const fullCard = collection.find(c => c.id === s.firestoreId);
                                const id = s.firestoreId;
                                const assignedRole = s.role || 'Synergy / Strategy'; // Fallback

                                allNewSuggestions[id] = {
                                    ...s,
                                    firestoreId: id,
                                    name: fullCard?.name || original.name,
                                    type_line: fullCard?.data?.type_line || original.type_line,
                                    data: fullCard?.data || fullCard,
                                    rating: s.rating,
                                    reason: s.reason,
                                    suggestedType: assignedRole
                                };
                                initialSelectedIds.add(id);
                            }
                        });
                        addLog(`${helperName} provided ${result.suggestions.length} suggestions across all roles.`);
                        break; // Success
                    }
                } catch (e) {
                    if (loadingInterval) clearInterval(loadingInterval);
                    console.error(e);
                    addLog(`Error: ${e.message}. Retrying...`);
                    attempts++;
                    await delay(2000);
                }
            }

            // --- Basic Land Filler ---
            const currentLands = deckCards.filter(c => (c.data?.type_line || c.type_line || '').includes('Land')).length;
            const suggestedLands = Object.values(allNewSuggestions).filter(s => s.suggestedType === 'Land').length;
            const totalLands = currentLands + suggestedLands;
            const targetLands = typeTargets['Land'] || 36;
            const neededLands = Math.max(0, targetLands - totalLands);

            if (neededLands > 0) {
                addLog(`Calculating mana base for ${neededLands} remaining land slots...`);
                const manaStats = calculateManaStats(deckCards, allNewSuggestions);
                const basicLandSuggestions = generateBasicLands(neededLands, manaStats, collection);

                Object.assign(allNewSuggestions, basicLandSuggestions);
                Object.keys(basicLandSuggestions).forEach(id => initialSelectedIds.add(id));
                addLog(`Added ${Object.keys(basicLandSuggestions).length} Basic Lands to balance mana curve.`);
            }

            setSuggestions(allNewSuggestions);
            setSelectedCards(initialSelectedIds);
            addLog("Architecture complete. Proceeding to Architect view.");
            setStep(STEPS.ARCHITECT);
        } catch (err) {
            console.error(err);
            addToast("Architecture failed. Please check your AI key.", "error");
        } finally {
            setIsProcessing(false);
            setStatus('Ready.');
        }
    };

    const handleQuickSkip = () => {
        // Dev skip implementation (abbreviated for brevity, assuming standard skip)
        const isDev = currentUser?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3' || userProfile?.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
        if (!isDev) return;
        setStep(STEPS.ARCHITECT);
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedCards);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedCards(newSet);
    };

    // --- Components ---

    const FilterOption = ({ label, active, onClick }) => (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${active ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-gray-800/50 border-white/5 text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
            {label}
        </button>
    );

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

            {/* Analysis Settings Panel */}
            <div className="bg-gray-900/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-indigo-500/20 p-2 rounded-lg">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">Builder Configuration</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Filters */}
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

                    {/* Set Restrictions */}
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
                </div>
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
                <div className="p-8 h-[400px] overflow-y-auto font-mono text-xs space-y-3 custom-scrollbar bg-black/40 backdrop-blur-inner shadow-inner box-shadow-inner border-t border-white/5 font-medium leading-relaxed">
                    {logs.length === 0 ? (
                        <div className="text-gray-600 italic animate-pulse">Waiting for architecture to start...</div>
                    ) : (
                        logs.map((log, i) => <div key={i} className="text-gray-300 animate-fade-in pl-4 border-l-2 border-indigo-500/40 py-1 hover:bg-white/5 transition-colors rounded-r">{log}</div>)
                    )}
                    <div ref={logsEndRef} />
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
                                    <div className="space-y-1">
                                        <span className="block text-xl font-black text-white uppercase italic tracking-tight group-hover:text-indigo-300 transition-colors">{card.name}</span>
                                        <span className="text-[10px] font-black text-indigo-400 tracking-[0.2em] uppercase">{card.type_line}</span>
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
                                            src={card.data?.image_uris?.normal || `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image`}
                                            alt={card.name}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-60" />
                                        <div className={`absolute top-4 right-4 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${selectedCards.has(card.firestoreId) ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-black/40 border-white/20 group-hover:border-white/40'}`}>
                                            {selectedCards.has(card.firestoreId) && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <div className="absolute bottom-4 left-4 right-4">
                                            <span className="block text-lg font-black text-white uppercase italic tracking-tight line-clamp-1">{card.name}</span>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] font-black text-indigo-300 tracking-[0.2em] uppercase truncate max-w-[70%]">{card.type_line}</span>
                                                <span className="text-xs font-mono text-indigo-400 font-bold bg-black/60 px-2 py-0.5 rounded-lg border border-white/10">{card.rating}/10</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div className="text-xs text-gray-400 font-medium italic leading-relaxed line-clamp-3">
                                            "{card.reason}"
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {viewMode === 'table' && (
                        <div className="bg-gray-950/30 rounded-[2rem] border border-white/5 overflow-hidden">
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
                                                <span className="font-bold text-white uppercase italic tracking-tight">{card.name}</span>
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
                // Build a map of availability
                const availabilityMap = new Map(); // scryfall_id -> count of unassigned
                collection.forEach(c => {
                    const sid = c.scryfall_id || c.data?.scryfall_id;
                    if (sid && !c.deck_id) {
                        availabilityMap.set(sid, (availabilityMap.get(sid) || 0) + 1);
                    }
                });

                const existingDeckNames = new Set(deckCards.map(c => c.name));
                const processingNames = new Set();

                for (const s of cards) {
                    const data = s.data || s;
                    // Resolve Scryfall ID
                    const scryfallId = data.scryfall_id || data.id || (s.isVirtual ? null : s.firestoreId);

                    const isBasicLand = s.type_line && s.type_line.includes('Basic Land');
                    const isUnlimited = s.type_line && (s.type_line.includes('Relentless Rats') || s.type_line.includes('Shadowborn Apostle') || s.type_line.includes('Persistent Petitioners') || s.type_line.includes('Nazgûl') || s.type_line.includes('Slime Against Humanity'));

                    // SAFETY 1: Block Duplicates in Payload (unless Basic/Unlimited)
                    if (!isBasicLand && !isUnlimited && processingNames.has(s.name)) {
                        console.warn(`[Deploy] Skipping duplicate in batch: ${s.name}`);
                        continue;
                    }

                    // SAFETY 2: Block Already In Deck (unless Basic/Unlimited)
                    if (!isBasicLand && !isUnlimited && existingDeckNames.has(s.name)) {
                        console.warn(`[Deploy] Skipping card already in deck: ${s.name}`);
                        continue;
                    }

                    processingNames.add(s.name);

                    let useMinimal = false;

                    if (scryfallId && availabilityMap.has(scryfallId)) {
                        const count = availabilityMap.get(scryfallId);
                        if (count > 0) {
                            useMinimal = true;
                            availabilityMap.set(scryfallId, count - 1); // Decrement for next iteration
                        }
                    }

                    // STRICTNESS CHECK: Collection Decks cannot have Wishlist items
                    // EXCEPTION: Basic Lands are considered "infinite" resource
                    // (isBasicLand is already calculated above)

                    if (!useMinimal && deck.is_mockup === false && !isBasicLand) {
                        throw new Error(`Cannot add unowned card "${s.name}" to a Collection Deck.`);
                    }

                    // Always send full details to ensure backend has fallback data for INSERTs
                    // (Even if we think we own it, race conditions or logic gaps might force an INSERT)
                    cardsToApply.push({
                        scryfall_id: scryfallId,
                        name: s.name || data.name || 'Unknown Card',
                        set_code: data.set || data.set_code || '???',
                        collector_number: data.collector_number || '0',
                        finish: 'nonfoil',
                        image_uri: (data.image_uris && data.image_uris.normal) || data.image_uri || null,
                        data: data,
                        count: 1,
                        // If we found it in availabilityMap, it's not a wishlist item (it's collection). 
                        // If it's a Basic Land, it's also not wishlist (treated as infinite/owned).
                        // Otherwise (not found & not basic), it's wishlist.
                        is_wishlist: (useMinimal || isBasicLand) ? false : true
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
                <div className="text-center space-y-2">
                    <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Final Deployment</h2>
                    <p className="text-gray-500 font-medium">Review your selected additions before applying them to your deck.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map(card => (
                        <div key={card.firestoreId} className="bg-gray-950/30 p-6 rounded-[2rem] border border-white/10 space-y-4">
                            <span className="font-black text-white uppercase italic text-lg truncate block">{card.name}</span>
                            <div className="text-xs text-gray-400 leading-relaxed italic">"{card.reason}"</div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-6 justify-center">
                    <button onClick={() => setStep(STEPS.ARCHITECT)} className="px-12 py-4 bg-gray-900 hover:bg-gray-800 text-white font-black rounded-2xl border border-white/5 uppercase tracking-widest text-xs transition-all">Back to Architect</button>
                    <button onClick={handleDeploy} disabled={isProcessing} className="px-16 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/40 uppercase tracking-widest text-xs border border-white/10 transition-all">Apply to "{deck?.name}"</button>
                </div>
            </div>
        );
    };

    if (deckLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;

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
            ` }} />
        </div>
    );
};

export default DeckBuildWizardPage;
