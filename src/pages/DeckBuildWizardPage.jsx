import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDeck } from '../hooks/useDeck';
import { useCollection } from '../hooks/useCollection';
import { GeminiService } from '../services/gemini';
import { api } from '../services/api';
import CardGridItem from '../components/common/CardGridItem';
import { getTierConfig } from '../config/tiers';

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

    useEffect(() => {
        if (!userProfile) return;
        const tier = getTierConfig(userProfile.subscription_tier);
        if (!tier.features.deckSuggestions) {
            addToast("Deck Builder requires Magician tier or higher.", "error");
            navigate(`/decks/${deckId}`);
        }
    }, [userProfile, deckId]);

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

    const [deployAnalysis, setDeployAnalysis] = useState(null);
    const [isDeployAnalyzing, setIsDeployAnalyzing] = useState(false);
    const [allSets, setAllSets] = useState([]);

    useEffect(() => {
        api.get('/api/sets').then(res => {
            // api.js returns the parsed JSON body directly.
            // Server response structure: { data: [...] }
            const sets = res.data || res;
            if (Array.isArray(sets)) {
                setAllSets(sets);
                // console.debug(`DEBUG: Loaded ${sets.length} sets for restriction logic.`);
            } else {
                console.warn("DEBUG: API returned non-array for sets:", res);
            }
        }).catch(err => console.error("Failed to fetch sets for cohort analysis", err));
    }, []);

    const getRestrictedSets = () => {
        // console.error("!!! getRestrictedSets CALLED !!!"); // ENTRY LOG

        const cmdSetCode = (deck?.commander?.set || '').trim().toLowerCase();
        const cmdSetName = (deck?.commander?.set_name || '').trim().toLowerCase();

        // Helpers
        const virtualSet = {
            code: cmdSetCode || 'unk',
            name: deck?.commander?.set_name || 'Current Set',
            released_at: deck?.commander?.released_at || '2025-01-01',
            virtual: true
        };

        if (!allSets.length) {
            // console.warn("DEBUG: allSets is empty. Using virtual fallback.");
            return (cmdSetCode || cmdSetName) ? [virtualSet] : [];
        }

        if (!cmdSetCode && !cmdSetName) {
            console.warn("DEBUG: Commander missing set info:", deck?.commander);
            return [];
        }

        // Robust Find
        const cmdSet = allSets.find(s => s.code.toLowerCase() === cmdSetCode)
            || allSets.find(s => s.name.toLowerCase() === cmdSetName);

        if (!cmdSet) {
            console.warn(`DEBUG: Set not found for '${cmdSetCode}' / '${cmdSetName}' in ${allSets.length} sets. Using virtual fallback.`);
            // Log first few sets to check what IS there
            if (allSets.length > 0) console.log("DEBUG: Available Sets (Sample):", allSets.slice(0, 5).map(s => `${s.code} (${s.released_at})`));

            console.log(`DEBUG: Virtual Set Date: ${virtualSet.released_at}`);
            return [virtualSet];
        }

        if (!cmdSet.released_at) {
            console.warn("DEBUG: Found set but no release date:", cmdSet);
            return [cmdSet];
        }

        // Parse date for comparison (handle strings vs Date objects if any)
        const targetDate = new Date(cmdSet.released_at).toISOString().split('T')[0];
        console.log(`DEBUG: Found Real Set '${cmdSet.code}'. Release Date: ${targetDate} (Raw: ${cmdSet.released_at})`);

        const cohort = allSets.filter(s => {
            if (!s.released_at) return false;
            const sDate = new Date(s.released_at).toISOString().split('T')[0];
            return sDate === targetDate;
        });

        console.log(`DEBUG: Cohort size: ${cohort.length} for date ${targetDate}. Matches:`, cohort.map(c => c.code));
        return cohort;
    };

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

    // Trigger Deploy Analysis
    useEffect(() => {
        if (step === STEPS.DEPLOY && !deployAnalysis && !isDeployAnalyzing) {
            const runAnalysis = async () => {
                setIsDeployAnalyzing(true);
                try {
                    const cards = Array.from(selectedCards).map(id => suggestions[id]);
                    const combinedCards = [...deckCards, ...cards];

                    const gradePayload = {
                        deckName: deck.name,
                        commander: deck.commander?.name || 'Unknown Commander',
                        cards: combinedCards,
                        playerProfile: userProfile.settings?.playstyle || "Unknown",
                        strategyGuide: strategyInput || "Balanced",
                        helperPersona: userProfile.settings?.helper
                    };

                    // Run logic in parallel
                    // getDeckStrategy(apiKey, commanderInput, playstyle, existingCards, helper, userProfile)
                    // gradeDeck(apiKey, payload, userProfile)
                    const [strat, grade] = await Promise.all([
                        GeminiService.getDeckStrategy(
                            userProfile.settings.geminiApiKey,
                            deck.commander || { name: deck.commander?.name || 'Commander' },
                            userProfile.settings?.playstyle,
                            combinedCards,
                            userProfile.settings?.helper,
                            userProfile
                        ),
                        GeminiService.gradeDeck(userProfile.settings.geminiApiKey, gradePayload, userProfile)
                    ]);

                    setDeployAnalysis({ strategy: strat, grade: grade });
                } catch (e) {
                    console.error("Deploy analysis failed", e);
                    addToast("Could not complete final analysis.", "error");
                } finally {
                    setIsDeployAnalyzing(false);
                }
            };
            runAnalysis();
        }
    }, [step, deployAnalysis, isDeployAnalyzing, userProfile, deck, selectedCards, suggestions, deckCards]);

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
            const DRAFT_ROLES = ['Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Synergy / Strategy'];

            const currentDeckNames = new Set(deckCards.map(c => c.name));
            const cmdCount = (deck.commander ? 1 : 0) + (deck.commander_partner ? 1 : 0);
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

            // Balance Spell counts to hit exactly 99 slots (100 - 1 cmd)
            const totalSpellTarget = 100 - (typeTargets['Land'] || 36) - cmdCount;
            const currentNonLandReqs = DRAFT_ROLES.reduce((sum, role) => sum + (typeTargets[role] || 0), 0);
            const extraSynergyNeeded = totalSpellTarget - currentNonLandReqs;

            if (extraSynergyNeeded > 0) {
                typeTargets['Synergy / Strategy'] = (typeTargets['Synergy / Strategy'] || 30) + extraSynergyNeeded;
            }

            const allNewSuggestions = {};
            const initialSelectedIds = new Set();
            const setFilterLower = (analysisSettings.setName || '').toLowerCase().trim();

            const deckRequirements = {};
            let totalNeeded = 0;

            for (const type of typesToFill) {
                const currentTypeCount = deckCards
                    .filter(c => {
                        const t = (c.data?.type_line || c.type_line || '').toLowerCase();
                        if (type === 'Land') return t.includes('land');
                        // Use reason or metadata for functional roles as type_line usually just says 'Instant', 'Creature'
                        return t.includes(type.toLowerCase()) || (c.reason || '').toLowerCase().includes(type.toLowerCase());
                    })
                    .reduce((acc, c) => acc + (c.countInDeck || 1), 0);

                const target = typeTargets[type] || 0;
                let needed = Math.max(0, target - currentTypeCount);
                if (needed > 0) {
                    deckRequirements[type] = needed;
                    totalNeeded += needed;
                }
            }

            // Global Cap Check
            const currentDeckCount = deckCards.length + cmdCount;
            const maxSlotsAvailable = 100 - currentDeckCount;

            if (totalNeeded > maxSlotsAvailable) {
                let excess = totalNeeded - maxSlotsAvailable;
                addLog(`Detected over-request (${totalNeeded} needed, ${maxSlotsAvailable} available). Balancing...`);

                if (deckRequirements['Synergy / Strategy'] > 0) {
                    const reduction = Math.min(deckRequirements['Synergy / Strategy'], excess);
                    deckRequirements['Synergy / Strategy'] -= reduction;
                    excess -= reduction;
                }
                totalNeeded = Object.values(deckRequirements).reduce((a, b) => a + b, 0);
            }

            if (totalNeeded === 0) {
                addLog("Deck goals appear met! No missing slots found based on targets.");
                setIsProcessing(false);
                setStatus('Idle');
                return;
            }

            const restrictedCohort = analysisSettings.restrictSet ? getRestrictedSets() : [];
            const restrictedSetCodes = restrictedCohort.map(s => s.code.toLowerCase());

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

                    if (analysisSettings.restrictSet && restrictedSetCodes.length > 0) {
                        const cardSetCode = (card.set || card.data?.set || '').toLowerCase();
                        if (!restrictedSetCodes.includes(cardSetCode)) continue;
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

            // --- ROBUST DATA PREPARATION (Matches DeckStrategyModal) ---

            // 1. Sanitize Commander Data
            const rawCommanders = [deck.commander, deck.commander_partner].filter(Boolean);
            const sanitizedCommanders = rawCommanders.map(c => ({
                name: c.name || c.data?.name || 'Unknown',
                mana_cost: c.mana_cost || c.cmc || c.data?.mana_cost || c.data?.cmc || '0',
                type_line: c.type_line || c.data?.type_line || 'Legendary Creature',
                oracle_text: c.oracle_text || c.data?.oracle_text || ''
            }));

            // Construct Commander String for Prompt
            const commanderString = sanitizedCommanders.map(c => c.name).join(' & ');

            // 2. Robust Playstyle Check
            let activePlaystyle = userProfile.playstyle || userProfile.settings?.playstyle || userProfile.data?.playstyle || null;

            // Deep check for "data" if it's a JSON string or nested
            if (!activePlaystyle && userProfile.data && userProfile.data.playstyle) {
                activePlaystyle = userProfile.data.playstyle;
            }

            if (!activePlaystyle) {
                addLog("⚠️ Playstyle undefined in profile. Using generic fallback.");
                activePlaystyle = {
                    summary: "Balanced Magic player enjoying strategic depth and interaction.",
                    archetypes: ["Midrange", "Control"],
                    scores: { aggression: 5 }
                };
            }

            const promptData = {
                deckName: deck.name,
                commander: commanderString,
                strategyGuide: blueprint?.strategy || 'No specific strategy guide.',
                helperPersona: userProfile?.settings?.helper,
                restrictedSets: restrictedSetCodes.map(c => c.toUpperCase()),
                instructions: `Fill the following deck slots: ${JSON.stringify(deckRequirements)}. 
                ${strategyInput ? `STRATEGY FOCUS: ${strategyInput}` : ''}
                ${analysisSettings.restrictSet && restrictedCohort.length > 0
                        ? `\nRESTRICTION: Only suggest cards from the following sets: ${restrictedCohort.map(s => `${s.name} (${s.code})`).join(', ')}. Do NOT suggest cards from any other sets.`
                        : ''}
                IMPORTANT: For non-land roles (Ramp, Draw, etc.), do NOT suggest basic lands. Only suggest non-land spells unless specifically asked for lands. For every card suggested, 'name' MUST be the English card name (e.g. "Sol Ring"). You MUST provide the specific 'set' code and 'collectorNumber' from Scryfall.`,
                deckRequirements: deckRequirements,
                candidates: buildMode === 'collection' ? candidates.slice(0, 3500) : [],
                buildMode: buildMode,
                currentContext: Array.from(currentDeckNames),
                neededCount: totalNeeded,
                commanderColorIdentity: commanderColors.join('') || 'Colorless',
                // Pass full commander objects for advanced parsing if needed by service
                commanders: sanitizedCommanders
            };

            setStatus(`Consulting ${helperName} for a strategy centered around ${commanderString}...`);
            addLog(`Core Directive: Synergize with ${commanderString}'s specific triggers and playstyle.`);

            const fetchAndResolveSuggestions = async (requirements, context, options = {}) => {
                const finalSuggestions = {};
                const runningContext = new Set(context);
                let attempts = 0;
                const maxAttempts = options.noChunking ? 1 : 8; // If noChunking (Pro), we usually try once then fail fast to fallback

                const LOADING_MESSAGES = ["Consulting the archives...", "Analysing mana curves...", "Simulating games...", "Searching for hidden gems...", "Optimizing synergy lines..."];
                let loadingInterval = setInterval(() => {
                    const randomMsg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
                    setStatus(`${helperName}: ${randomMsg}`);
                }, 2500);

                try {
                    while (attempts < maxAttempts) {
                        attempts++;

                        // Determine remaining deficit
                        const currentDeficit = {};
                        let totalDeficit = 0;

                        if (typeof requirements === 'object' && !requirements.count) {
                            // Multi-role mode (e.g. Support Batch)
                            for (const role in requirements) {
                                if (role === 'count') continue;
                                const currentFound = Object.values(finalSuggestions).filter(s => s.role === role || s.suggestedType === role).length;
                                const stillNeeded = Math.max(0, (requirements[role] || 0) - currentFound);
                                if (stillNeeded > 0) {
                                    currentDeficit[role] = stillNeeded;
                                    totalDeficit += stillNeeded;
                                }
                            }
                        } else {
                            // Single role or count-based mode
                            const target = requirements.count || Object.values(requirements)[0] || 0;
                            const stillNeeded = Math.max(0, target - Object.keys(finalSuggestions).length);
                            if (stillNeeded > 0) {
                                // If it's count-based, we keep the original roles or use options.role
                                currentDeficit[options.role || 'Synergy / Strategy'] = stillNeeded;
                                totalDeficit = stillNeeded;
                            }
                        }

                        if (totalDeficit <= 0) break; // We are done!

                        addLog(`[Drafting] Deficit: ${totalDeficit} cards remaining to fulfill reqs.`);

                        // CHUNKING: Pro models handle 100 cards easily. Flash needs chunks.
                        const CHUNK_SIZE = options.noChunking ? 99 : 15;
                        const chunkDeficit = {};
                        let chunkTotal = 0;

                        for (const role in currentDeficit) {
                            const take = Math.min(currentDeficit[role], CHUNK_SIZE - chunkTotal);
                            if (take > 0) {
                                chunkDeficit[role] = take;
                                chunkTotal += take;
                            }
                            if (chunkTotal >= CHUNK_SIZE) break;
                        }

                        const currentPromptData = {
                            ...promptData,
                            deckRequirements: chunkDeficit,
                            currentContext: Array.from(runningContext),
                            neededCount: chunkTotal
                        };

                        try {
                            const result = await GeminiService.generateDeckSuggestions(
                                userProfile.settings.geminiApiKey,
                                currentPromptData,
                                null,
                                userProfile,
                                { models: options.modelList } // Explicitly pass the tier
                            );

                            if (!result?.suggestions || result.suggestions.length === 0) {
                                if (attempts < maxAttempts) {
                                    addLog(`[WARNING] AI returned 0 results. Waiting and retrying...`);
                                    await new Promise(r => setTimeout(r, 4000));
                                    continue;
                                }
                                break;
                            }

                            let foundInThisBatch = 0;

                            for (const s of result.suggestions) {
                                // 1. MATCHING
                                let scryData = null;
                                let isFromCollection = false;

                                if (s.firestoreId && s.firestoreId !== 'discovery') {
                                    const inColl = collection.find(c => c.id === s.firestoreId);
                                    if (inColl) {
                                        scryData = inColl.data || inColl;
                                        isFromCollection = true;
                                    }
                                }

                                if (!scryData) {
                                    const resp = await api.post('/api/cards/search', { query: s.name });
                                    const results = resp.data || resp.data?.data || [];
                                    scryData = results.find(card => {
                                        const cardSet = (card.set || '').toLowerCase();
                                        const aiSet = (s.set || '').toLowerCase();
                                        return cardSet === aiSet || (restrictedSetCodes.length > 0 && restrictedSetCodes.includes(cardSet));
                                    }) || results[0];

                                    if (scryData) {
                                        const inColl = collection.find(c => (c.scryfall_id || c.uuid) === (scryData.uuid || scryData.id));
                                        if (inColl) {
                                            scryData = inColl.data || inColl;
                                            isFromCollection = true;
                                        }
                                    }
                                }

                                // 2. ELIGIBILITY
                                if (scryData) {
                                    const id = scryData.uuid || scryData.id;
                                    if (finalSuggestions[id] || runningContext.has(scryData.name)) continue;

                                    const globalTotal = deckCards.length + Object.keys(allNewSuggestions).length + Object.keys(finalSuggestions).length + cmdCount;
                                    if (globalTotal >= 100) break;

                                    const typeStr = (scryData.type_line || scryData.type || '').toLowerCase();
                                    const isLand = typeStr.includes('land');
                                    const roleIsLand = options.role === 'Land' || options.role === 'Non-Basic Lands' || requirements['Land'] || requirements['Non-Basic Lands'] || chunkDeficit['Land'] || chunkDeficit['Non-Basic Lands'];

                                    let resolvedType = options.role || s.role || 'Synergy';

                                    if (isLand && !roleIsLand) {
                                        // Land leaked into a spell role
                                        const targetLands = typeTargets['Land'] || 36;
                                        const currLands = Object.values(allNewSuggestions).filter(ls => (ls.data?.type_line || '').toLowerCase().includes('land')).length
                                            + deckCards.filter(dc => (dc.type_line || '').toLowerCase().includes('land')).length
                                            + Object.values(finalSuggestions).filter(fs => (fs.data?.type_line || '').toLowerCase().includes('land')).length;

                                        if (currLands < targetLands) {
                                            const isBasic = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].some(bn => scryData.name.includes(bn));
                                            if (isBasic) continue;
                                            console.log(`[DEBUG] Role Integrity: Re-categorizing leaked utility land "${scryData.name}" as Land`);
                                            resolvedType = 'Land';
                                            // Leakage doesn't count towards foundInThisBatch if we want a spell
                                        } else {
                                            continue;
                                        }
                                    } else {
                                        foundInThisBatch++;
                                    }

                                    const isOwned = isFromCollection || collection.some(c => (c.scryfall_id || c.uuid) === id);
                                    if (buildMode === 'collection' && analysisSettings.ownedOnly && !isOwned) continue;

                                    finalSuggestions[id] = {
                                        ...s, firestoreId: id, name: scryData.name,
                                        type_line: scryData.type_line || scryData.type,
                                        data: scryData,
                                        isDiscovery: !isOwned,
                                        is_wishlist: !isOwned,
                                        suggestedType: resolvedType
                                    };
                                    runningContext.add(scryData.name);
                                }
                            }

                            // If we got some results but not enough, the next loop iteration will try again for the remainder
                            if (foundInThisBatch < chunkTotal && !options.noChunking) {
                                addLog(`[Attempt ${attempts}] Yielded ${foundInThisBatch}/${chunkTotal} cards. Retrying for remainder...`);
                            }

                            // Small delay between successful attempts to avoid rate limit spikes
                            await new Promise(r => setTimeout(r, 1000));

                        } catch (apiErr) {
                            console.warn(`[Attempt ${attempts}] API call failed:`, apiErr.message);
                            if (apiErr.reason === 'rate_limit') {
                                // Only fail-fast (skip current pass) if explicitly requested (e.g. for Elite pass)
                                if (options.failFast) throw apiErr;

                                addLog(`Rate limit hit. Waiting for backoff...`);
                                await new Promise(r => setTimeout(r, 6000));
                            }
                            if (attempts >= maxAttempts) throw apiErr;
                        }
                    }
                } catch (err) {
                    if (loadingInterval) clearInterval(loadingInterval);
                    throw err;
                } finally {
                    if (loadingInterval) clearInterval(loadingInterval);
                }
                return { suggestions: finalSuggestions, ids: new Set(Object.keys(finalSuggestions)) };
            };

            // --- ELITE DRAFTING PASS (PRO-TIER) ---
            let elitePassActive = true;
            try {
                addLog(`[Elite Pass] Attempting high-quality drafting with Pro-tier models...`);
                setStatus(`Consulting the Elite archives with Pro models...`);

                const { suggestions: eliteS } = await fetchAndResolveSuggestions(
                    deckRequirements,
                    currentDeckNames,
                    { modelList: GeminiService.PRO_MODELS, noChunking: true, failFast: true }
                );

                Object.assign(allNewSuggestions, eliteS);
                addLog(`[Elite Pass] Successfully drafted ${Object.keys(eliteS).length} cards.`);
            } catch (err) {
                if (err.reason === 'rate_limit' || err.reason === 'exhausted') {
                    addToast("Pro Tier limit hit. Falling back to High-Speed Flash drafting...", "warning");
                    addLog(`[Elite Pass] Pro-Tier unavailable (${err.reason}). Switching to robust fallback...`);
                } else {
                    console.warn("[Elite Pass] Non-rate-limit error:", err);
                }
                elitePassActive = false;
            }

            // --- ROBUST LAYERED DRAFTING (FALLBACK / FLASH) ---
            // 1. CONSOLIDATED DRAFTING PASS
            const supportRoles = ['Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes'];
            const supportReqs = {};
            let supportTotal = 0;
            for (const r of supportRoles) {
                const currentInAll = Object.values(allNewSuggestions).filter(s => s.role === r || s.suggestedType === r).length;
                const n = Math.max(0, (deckRequirements[r] || 0) - currentInAll);
                if (n > 0) {
                    supportReqs[r] = n;
                    supportTotal += n;
                }
            }
            if (supportTotal > 0) {
                supportReqs.count = supportTotal;
                setStatus(`Drafting Support Spells (${supportTotal})...`);
                try {
                    const { suggestions: supportS } = await fetchAndResolveSuggestions(
                        supportReqs,
                        [...currentDeckNames, ...Object.keys(allNewSuggestions)],
                        { modelList: GeminiService.FLASH_MODELS }
                    );
                    Object.assign(allNewSuggestions, supportS);
                    await new Promise(r => setTimeout(r, 1500));
                } catch (e) { console.warn("Support pass failed", e); }
            }

            // 1.2 CORE STRATEGY PASS
            const currentSynergy = Object.values(allNewSuggestions).filter(s => s.role === 'Synergy / Strategy' || s.suggestedType === 'Synergy / Strategy').length;
            const synergyTarget = Math.max(0, (deckRequirements['Synergy / Strategy'] || 0) - currentSynergy);
            if (synergyTarget > 0) {
                setStatus(`Drafting Core Strategy (${synergyTarget})...`);
                try {
                    const { suggestions: synergyS } = await fetchAndResolveSuggestions(
                        { 'Synergy / Strategy': synergyTarget, count: synergyTarget },
                        [...Array.from(currentDeckNames), ...Object.keys(allNewSuggestions)],
                        { role: 'Synergy / Strategy', modelList: GeminiService.FLASH_MODELS }
                    );
                    Object.assign(allNewSuggestions, synergyS);
                    await new Promise(r => setTimeout(r, 1500));
                } catch (e) { console.warn("Synergy pass failed", e); }
            }

            // 1.5 NON-BASIC LAND PASS
            const landTarget = deckRequirements['Land'] || 36;
            const currentLandCount = Object.values(allNewSuggestions).filter(s => (s.data?.type_line || '').toLowerCase().includes('land')).length
                + deckCards.filter(c => (c.type_line || '').toLowerCase().includes('land')).length;

            let neededLands = Math.max(0, landTarget - currentLandCount);
            if (neededLands > 10) {
                const nonBasicRequest = Math.floor(neededLands * 0.5); // Asking for half non-basics
                setStatus(`Requesting ${nonBasicRequest} non-basic lands...`);
                try {
                    const { suggestions: landS } = await fetchAndResolveSuggestions(
                        { 'Non-Basic Lands': nonBasicRequest, count: nonBasicRequest },
                        [...Array.from(currentDeckNames), ...Object.keys(allNewSuggestions)],
                        { role: 'Land' }
                    );
                    Object.assign(allNewSuggestions, landS);
                } catch (e) { console.warn("Non-basic pass failed", e); }
            }

            // 2. INTEGRITY CHECK - Fill to 100 with Synergy prioritization
            const ensureCountIntegrity = async () => {
                let currentTotal = deckCards.length + Object.keys(allNewSuggestions).length + cmdCount;
                if (currentTotal >= 100) return;

                const getLandCount = () => {
                    return Object.values(allNewSuggestions).filter(s => (s.data?.type_line || s.suggestedType === 'Land' || '').toLowerCase().includes('land')).length
                        + deckCards.filter(c => (c.type_line || '').toLowerCase().includes('land')).length;
                };

                const targetLands = typeTargets['Land'] || 36;
                const totalGap = 100 - currentTotal;
                const landGap = Math.max(0, targetLands - getLandCount());

                // 1. Fill with basics ONLY up to the land goal
                const basicsToFill = Math.min(landGap, totalGap);
                if (basicsToFill > 0) {
                    setStatus(`Filling ${basicsToFill} basics to meet land cap...`);
                    const stats = calculateManaStats(deckCards, allNewSuggestions);
                    const basics = generateBasicLands(basicsToFill, stats, collection);
                    Object.assign(allNewSuggestions, basics);
                    currentTotal = deckCards.length + Object.keys(allNewSuggestions).length + cmdCount;
                }

                // 2. If still short, get more Synergy cards from AI (Catch-up pass)
                let catchupDeficit = 100 - currentTotal;
                if (catchupDeficit > 0) {
                    setStatus(`Synergy Catch-up: Requesting ${catchupDeficit} strategy cards...`);
                    try {
                        // Attempt Pro first for catch-up too
                        const { suggestions: extraS } = await fetchAndResolveSuggestions(
                            { 'Synergy / Strategy': catchupDeficit, count: catchupDeficit },
                            [...Array.from(currentDeckNames), ...Object.keys(allNewSuggestions)],
                            { role: 'Synergy / Strategy', modelList: GeminiService.PRO_MODELS, noChunking: true, failFast: true }
                        );
                        Object.assign(allNewSuggestions, extraS);
                        currentTotal = deckCards.length + Object.keys(allNewSuggestions).length + cmdCount;
                    } catch (e) {
                        console.warn("Synergy catch-up (Pro) failed, trying Flash...", e);
                        try {
                            const { suggestions: extraS } = await fetchAndResolveSuggestions(
                                { 'Synergy / Strategy': catchupDeficit, count: catchupDeficit },
                                [...Array.from(currentDeckNames), ...Object.keys(allNewSuggestions)],
                                { role: 'Synergy / Strategy', modelList: GeminiService.FLASH_MODELS }
                            );
                            Object.assign(allNewSuggestions, extraS);
                            currentTotal = deckCards.length + Object.keys(allNewSuggestions).length + cmdCount;
                        } catch (e2) {
                            console.error("Synergy catch-up (Flash) also failed", e2);
                        }
                    }
                }

                // 3. Absolute Final Fallback (Basics) - Respecting Land Cap
                currentTotal = deckCards.length + Object.keys(allNewSuggestions).length + cmdCount;
                if (currentTotal < 100) {
                    const finalGap = 100 - currentTotal;
                    const capGap = Math.max(0, targetLands - getLandCount());
                    const safeBasics = Math.min(finalGap, capGap);

                    if (safeBasics > 0) {
                        addLog(`AI catch-up incomplete. Filling ${safeBasics} slots with basics to meet land cap.`);
                        const stats = calculateManaStats(deckCards, allNewSuggestions);
                        const basics = generateBasicLands(safeBasics, stats, collection);
                        Object.assign(allNewSuggestions, basics);
                    } else {
                        addLog(`Deck complete at ${currentTotal} cards (Land cap reached).`);
                    }
                }
            };

            await ensureCountIntegrity();

            console.log(`[DEBUG] Drafting Complete. Total: ${deckCards.length + Object.keys(allNewSuggestions).length + cmdCount}`);

            // 3. REFINEMENT
            setStatus("Optimizing deck synergy...");
            try {
                const refineResult = await GeminiService.refineDeckBuild(
                    userProfile.settings.geminiApiKey,
                    Array.from(currentDeckNames),
                    Object.values(allNewSuggestions).map(s => s.name),
                    strategyInput || blueprint?.strategy,
                    null,
                    userProfile
                );

                if (refineResult?.swaps?.length > 0) {
                    for (const swap of refineResult.swaps) {
                        try {
                            if (!swap.remove || !swap.add) continue;
                            const targetToRemove = allNewSuggestions[swap.remove] ? swap.remove : Object.keys(allNewSuggestions).find(k => allNewSuggestions[k].name === swap.remove);
                            if (!targetToRemove) continue;

                            // Resolve ADD
                            const resp = await api.post('/api/cards/search', { query: swap.add });
                            const resolved = resp.data.data?.[0] || resp.data?.[0];
                            if (resolved) {
                                const ident = resolved.color_identity || [];
                                if (isColorIdentityValid(ident, commanderColors)) {
                                    const uuid = resolved.uuid || resolved.id;
                                    // ONLY remove if add is successful
                                    delete allNewSuggestions[targetToRemove];
                                    allNewSuggestions[uuid] = {
                                        ...resolved,
                                        firestoreId: uuid,
                                        suggestedType: (resolved.type_line || '').includes('Land') ? 'Land' : 'Synergy',
                                        reason: swap.reason || "Refinement Swap",
                                        is_wishlist: !collection.some(c => (c.scryfall_id || c.uuid) === uuid)
                                    };
                                    console.log(`[DEBUG] Refined: Swapped ${swap.remove} -> ${swap.add}`);
                                }
                            }
                        } catch (e) { console.error("Swap failed", e); }
                    }
                }
            } catch (err) { console.error("Refinement failed", err); }

            // Re-verify integrity if refinement dropped any cards
            await ensureCountIntegrity();

            initialSelectedIds.clear();
            Object.keys(allNewSuggestions).forEach(id => initialSelectedIds.add(id));
            setSuggestions(allNewSuggestions);
            setTimeout(() => setSelectedCards(new Set(initialSelectedIds)), 0);
            setStatus('Ready.');
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

    const handleDeploy = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const cards = Array.from(selectedCards).map(id => suggestions[id]).filter(Boolean);
            if (cards.length === 0) {
                console.warn("No valid cards found in selection", selectedCards, suggestions);
                addToast("No valid cards selected to deploy.", "error");
                setIsProcessing(false);
                return;
            }
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

    const handleDeployTransition = () => {
        // PERMISSIONS CHECK
        const currentTier = userProfile.override_tier || userProfile.subscription_tier || 'free';
        const isTrial = userProfile.subscription_status === 'trial';

        // Magician (tier_2) and above get the Analysis step
        const isHighTier = ['tier_2', 'tier_3', 'tier_4', 'tier_5'].includes(currentTier);

        const allowed = isHighTier || isTrial;

        if (allowed) {
            setStep(STEPS.DEPLOY);
        } else {
            handleDeploy();
        }
    };

    const renderAnalysis = () => {
        // State to track if we have started (to switch views)
        const hasStarted = isProcessing || logs.length > 0;

        // Configuration View
        if (!hasStarted) {
            return (
                <div className="max-w-5xl mx-auto py-12 space-y-10 animate-fade-in">
                    {/* Header */}
                    <div className="text-center space-y-4">
                        <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic drop-shadow-2xl">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{helperName}</span> Architect
                        </h1>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto font-medium">
                            Configure how the Oracle should construct your <span className="text-white font-bold">{deck?.name}</span>.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left Col: Mode Selection */}
                        <div className="lg:col-span-7 space-y-6">
                            <div className="bg-gray-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 space-y-8">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <div className="w-8 h-[1px] bg-gray-700"></div> STEP 01: SOURCE MATERIAL
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setBuildMode('collection')}
                                            className={`relative group p-6 rounded-3xl border-2 text-left transition-all duration-300 ${buildMode === 'collection' ? 'bg-indigo-600/10 border-indigo-500 shadow-xl shadow-indigo-500/10' : 'bg-gray-950/50 border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${buildMode === 'collection' ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700'}`}>
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            </div>
                                            <h4 className={`text-lg font-black uppercase italic mb-2 ${buildMode === 'collection' ? 'text-white' : 'text-gray-300'}`}>My Collection</h4>
                                            <p className="text-xs text-gray-500 leading-relaxed font-medium">Build strictly from cards you own. Best for paper decks and budget builds.</p>
                                            {buildMode === 'collection' && <div className="absolute top-4 right-4 w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
                                        </button>

                                        <button
                                            onClick={() => setBuildMode('discovery')}
                                            className={`relative group p-6 rounded-3xl border-2 text-left transition-all duration-300 ${buildMode === 'discovery' ? 'bg-purple-600/10 border-purple-500 shadow-xl shadow-purple-500/10' : 'bg-gray-950/50 border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${buildMode === 'discovery' ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700'}`}>
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                            <h4 className={`text-lg font-black uppercase italic mb-2 ${buildMode === 'discovery' ? 'text-white' : 'text-gray-300'}`}>Global Discovery</h4>
                                            <p className="text-xs text-gray-500 leading-relaxed font-medium">Search the entire MTG history. Finds the absolute best cards for your strategy.</p>
                                            {buildMode === 'discovery' && <div className="absolute top-4 right-4 w-3 h-3 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="w-full h-px bg-white/5"></div>

                                {/* Shared Settings */}
                                <div className="space-y-6">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <div className="w-8 h-[1px] bg-gray-700"></div> STEP 02: PARAMETERS
                                    </h3>

                                    {buildMode === 'collection' && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="flex items-center justify-between p-4 bg-gray-950/30 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                                <div className="space-y-1">
                                                    <span className="block text-sm font-bold text-gray-200">Only Owned Cards</span>
                                                    <span className="block text-xs text-gray-500">Hide wishlist items from suggestions</span>
                                                </div>
                                                <button
                                                    onClick={() => setAnalysisSettings(s => ({ ...s, ownedOnly: !s.ownedOnly }))}
                                                    className={`w-14 h-8 rounded-full p-1 transition-colors ${analysisSettings.ownedOnly ? 'bg-indigo-600' : 'bg-gray-800'}`}
                                                >
                                                    <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform ${analysisSettings.ownedOnly ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-gray-950/30 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                                <div className="space-y-1">
                                                    <span className="block text-sm font-bold text-gray-200">Exclude Assigned</span>
                                                    <span className="block text-xs text-gray-500">Skip cards already used in other decks</span>
                                                </div>
                                                <button
                                                    onClick={() => setAnalysisSettings(s => ({ ...s, excludeAssigned: !s.excludeAssigned }))}
                                                    className={`w-14 h-8 rounded-full p-1 transition-colors ${analysisSettings.excludeAssigned ? 'bg-indigo-600' : 'bg-gray-800'}`}
                                                >
                                                    <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform ${analysisSettings.excludeAssigned ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {buildMode === 'discovery' && (
                                        <div className="animate-fade-in">
                                            <textarea
                                                value={strategyInput}
                                                onChange={(e) => setStrategyInput(e.target.value)}
                                                placeholder={`Tell ${helperName} specifically what you're looking for... (e.g. 'Aggressive dinosaur ramp', 'Blue/Black control with mill finisher')`}
                                                className="w-full h-32 bg-gray-950/50 border border-purple-500/20 rounded-2xl p-5 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-purple-500/30 outline-none resize-none shadow-inner"
                                            />
                                        </div>
                                    )}

                                    {/* Set Restriction - Available in both? Yes, Discovery can be set restricted too logically */}
                                    <div className="p-4 bg-gray-950/30 rounded-2xl border border-white/5 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-bold text-gray-200">Set Restriction</span>
                                            <button
                                                onClick={() => setAnalysisSettings(s => ({ ...s, restrictSet: !s.restrictSet }))}
                                                className={`w-10 h-6 rounded-full p-1 transition-colors ${analysisSettings.restrictSet ? 'bg-indigo-600' : 'bg-gray-800'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${analysisSettings.restrictSet ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        {/* Cohort Display */}
                                        <div className={`transition-all duration-300 ${analysisSettings.restrictSet ? 'opacity-100 max-h-40' : 'opacity-50 max-h-12'}`}>
                                            {analysisSettings.restrictSet ? (
                                                <div className="bg-black/20 border border-indigo-500/30 rounded-xl p-3 space-y-2">
                                                    <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
                                                        Allowed Sets ({getRestrictedSets().length})
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5 h-full overflow-y-auto max-h-20 custom-scrollbar">
                                                        {getRestrictedSets().map(s => (
                                                            <span key={s.code} className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-[9px] text-indigo-200 font-mono">
                                                                {s.name} ({s.code.toUpperCase()})
                                                            </span>
                                                        ))}
                                                        {getRestrictedSets().length === 0 && <span className="text-[10px] text-gray-500 italic">Finding cohort...</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-black/20 border border-white/5 rounded-xl p-3">
                                                    <p className="text-xs text-gray-600 italic">Enable to restrict cards to the Commander's release window.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Col: Preferences & Action */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="bg-gray-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 space-y-8 h-full flex flex-col">
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <div className="w-8 h-[1px] bg-gray-700"></div> PREFERENCES
                                </h3>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Printing Preference</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { id: 'cheapest', label: 'Cheapest', sub: 'Best Value' },
                                            { id: 'nonfoil', label: 'Standard', sub: 'Prefer Non-Foil' },
                                            { id: 'foil', label: 'Premium', sub: 'Prefer Foil' },
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setAnalysisSettings(s => ({ ...s, finishPreference: opt.id }))}
                                                className={`flex items-center justify-between px-5 py-3 rounded-xl border transition-all ${analysisSettings.finishPreference === opt.id ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-gray-950/30 border-white/5 text-gray-500 hover:bg-white/5'}`}
                                            >
                                                <span className="font-bold text-sm">{opt.label}</span>
                                                <span className="text-[10px] opacity-60 uppercase tracking-wider">{opt.sub}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1"></div>

                                {/* CTA */}
                                <button
                                    onClick={startAnalysis}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-lg py-6 rounded-2xl shadow-2xl shadow-indigo-500/30 border border-white/10 uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] group"
                                >
                                    <span className="flex items-center justify-center gap-3">
                                        INITIALIZE ARCHITECT
                                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    </span>
                                </button>
                                <p className="text-center text-[10px] text-gray-600 font-mono">
                                    Aetherius v2.5-Lite • {deckCards.length} Cards Loaded
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Execution View (Terminal)
        return (
            <div className="max-w-4xl mx-auto py-12 space-y-8 h-full flex flex-col animate-fade-in">
                <div className="text-center space-y-4">
                    <div className="inline-block p-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 animate-pulse">
                        <div className="w-4 h-4 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)]" />
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-widest">
                        Architecting Interface
                    </h2>
                    <p className="text-indigo-400 font-mono text-sm tracking-widest">{status}</p>
                </div>

                <div className="flex-1 bg-black/80 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col relative">
                    {/* Terminal Header */}
                    <div className="h-10 bg-gray-900 border-b border-white/10 flex items-center px-4 justify-between">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                        </div>
                        <div className="text-[10px] text-gray-600 font-mono uppercase">root@aetherius:~</div>
                        <div className="w-10" />
                    </div>

                    {/* Terminal Body */}
                    <div className="flex-1 p-6 overflow-y-auto font-mono text-xs space-y-2 custom-scrollbar">
                        {logs.map((log, i) => (
                            <div key={i} className="text-gray-300 animate-fade-in pl-2 border-l-2 border-indigo-500/30">
                                <span className="text-indigo-500 mr-2">➜</span>
                                {log}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>

                    {/* Progress Bar overlay at bottom */}
                    <div className="h-1 bg-gray-800 w-full">
                        <div className="h-full bg-indigo-500 animate-progress-indeterminate opacity-50" />
                    </div>
                </div>

                {/* Controls */}
                <div className="flex justify-center gap-4">
                    {(currentUser?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3' || userProfile?.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3') && (
                        <button onClick={handleQuickSkip} className="text-[10px] text-amber-500 uppercase tracking-widest hover:text-amber-400">
                            [DEV] Bypass Sequence
                        </button>
                    )}
                </div>
            </div>
        );
    };

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

                <div className="flex-1 overflow-y-auto px-4 custom-scrollbar min-h-0">
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
                        <button onClick={handleDeployTransition} className="px-10 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 uppercase tracking-widest text-[11px] border border-white/10 transition-all">Review & Deploy</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderDeploy = () => {
        const cards = Array.from(selectedCards).map(id => suggestions[id]);

        return (
            <div className="max-w-5xl mx-auto space-y-8 py-8 h-full flex flex-col">
                <div className="text-center space-y-2">
                    <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Final Deployment</h2>
                    <p className="text-gray-500 font-medium">Review your deck's final verified state.</p>
                </div>

                {/* Analysis Section */}
                <div className="flex-1 bg-gray-950/40 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 overflow-y-auto custom-scrollbar shadow-2xl">
                    {isDeployAnalyzing ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-6 animate-pulse">
                            <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black text-white uppercase italic tracking-widest">Analysing Synergy...</h3>
                                <p className="text-indigo-400 font-mono text-sm">Running 10,000 simulations against meta decks...</p>
                            </div>
                        </div>
                    ) : deployAnalysis ? (
                        <div className="space-y-10 animate-fade-in">
                            {/* Grade Header */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-8">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-gray-400 uppercase tracking-[0.2em]">Power Level</h3>
                                    <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 italic font-mono">
                                        {deployAnalysis.grade?.grade || '7'}
                                        <span className="text-lg text-gray-500 ml-4 not-italic">/ 10</span>
                                    </div>
                                </div>
                                <div className="text-right space-y-1">
                                    <div className="text-xs font-black text-indigo-400 uppercase tracking-widest">Est. Win Rate</div>
                                    <div className="text-3xl font-black text-white">{deployAnalysis.grade?.winRate || '25%'}</div>
                                </div>
                            </div>

                            {/* Strategy Summary */}
                            <div className="space-y-6">
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-3">
                                    <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                    Strategic Analysis
                                </h3>
                                <div className="prose prose-invert prose-indigo max-w-none">
                                    <div className="bg-black/20 p-6 rounded-2xl border border-white/5 text-gray-300 leading-relaxed whitespace-pre-line font-medium shadow-inner">
                                        {deployAnalysis.strategy?.summary || deployAnalysis.strategy || "Analysis complete."}
                                    </div>
                                </div>
                            </div>

                            {/* New Additions Preview */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">Adding {cards.length} Cards</h3>
                                <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                                    {cards.map(c => (
                                        <div key={c.id || c.name} className="w-24 h-32 flex-shrink-0 rounded-lg overflow-hidden relative group border border-white/10 hover:border-indigo-500/50 transition-all">
                                            <img src={c.data?.image_uris?.normal || c.image_uri} className="w-full h-full object-cover" alt={c.name} />
                                            <div className="absolute inset-x-0 bottom-0 bg-black/80 p-1 text-[8px] truncate text-center text-white font-bold">{c.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500">Initializing analysis module...</div>
                    )}
                </div>

                <div className="flex gap-6 justify-center pt-4">
                    <button
                        onClick={() => setStep(STEPS.ARCHITECT)}
                        className="px-12 py-4 bg-gray-900/50 hover:bg-gray-800 text-white font-black rounded-2xl border border-white/5 uppercase tracking-widest text-xs transition-all shadow-xl"
                    >
                        Back to Architect
                    </button>
                    <button
                        onClick={handleDeploy}
                        disabled={isProcessing || isDeployAnalyzing}
                        className="px-16 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/40 uppercase tracking-widest text-xs border border-white/10 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {isProcessing ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        )}
                        Confirm & Deploy
                    </button>
                </div>
            </div>
        );
    };

    if (deckLoading) return <div className="flex items-center justify-center h-screen bg-gray-950"><div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;

    const commanderArt = getArtCrop(deck?.commander) || getArtCrop(deck?.commander_partner);

    return (
        <div className="h-screen bg-gray-950 text-gray-200 font-sans relative flex flex-col pt-16 overflow-hidden">
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

            {/* Content using flex-1 and min-h-0 to force internal scrolling */}
            <main className="flex-1 relative z-10 px-4 max-w-7xl mx-auto w-full min-h-0 flex flex-col">
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
