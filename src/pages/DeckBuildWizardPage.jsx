import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
    const queryClient = useQueryClient();
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
    const [latestDrafts, setLatestDrafts] = useState([]);
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
    const [analysisStats, setAnalysisStats] = useState({ drafted: 0, synergy: 0, deficit: 100 });

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
        const initialSelectedIds = new Set();
        if (!userProfile?.settings?.geminiApiKey) {
            addToast("Gemini API Key missing in settings.", "error");
            navigate('/settings/ai');
            return;
        }

        setIsProcessing(true);
        setStatus(`Preparing ${buildMode === 'discovery' ? 'Global Analysis' : 'Collection Analysis'}...`);
        const cmdCount = (deck.commander ? 1 : 0) + (deck.commander_partner ? 1 : 0);
        addLog(`Starting analysis (Mode: ${buildMode.toUpperCase()})...`);
        const updateStats = (suggestionsMap) => {
            const drafted = Object.keys(suggestionsMap).length;
            const syn = Object.values(suggestionsMap).filter(s => s.role === 'Synergy / Strategy' || s.suggestedType === 'Synergy / Strategy').length;
            const currentTotal = deckCards.length + drafted + cmdCount;
            setAnalysisStats({
                drafted: currentTotal,
                synergy: syn,
                deficit: Math.max(0, 100 - currentTotal)
            });
            const allVals = Object.values(suggestionsMap);
            setLatestDrafts(allVals.slice(-4).reverse());
        };

        // Initialize Analysis Variables
        const commander = deck.commander;
        const commanderColors = [...new Set([...(deck.commander?.color_identity || []), ...(deck.commander_partner?.color_identity || [])])];
        let allNewSuggestions = {};

        const helperName = userProfile?.settings?.helper?.name || "The Oracle";

        // Define Loading Interval
        const LOADING_MESSAGES = ["Consulting the archives...", "Analysing mana curves...", "Simulating games...", "Searching for hidden gems...", "Optimizing synergy lines..."];
        let loadingInterval = setInterval(() => {
            const randomMsg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
            setStatus(`${helperName}: ${randomMsg}`);
        }, 2500);

        // --- NEW BLUEPRINT ARCHITECTURE ---

        // STEP 1: THE ARCHITECT (Blueprint Generation)
        setStatus("Architecting deck strategy...");
        addLog(`[Architect] Designing blueprint for ${commander?.name}...`);

        let blueprint = null;
        try {
            const blueprintResponse = await GeminiService.generateDeckBlueprint(
                userProfile.settings.geminiApiKey,
                commander,
                userProfile,
                buildMode === 'collection'
            );

            blueprint = blueprintResponse.result;
            const meta = blueprintResponse.meta;

            // ADMIN TELEMETRY
            if (isAdmin && meta) {
                addToast(`BLUEPRINT: Used ${meta.model} (${meta.tokens} tokens)`, 'info');
            }

            addLog(`[Architect] Blueprint Created: "${blueprint.strategyName}"`);
            addLog(`[Architect] Plan: ${blueprint.description}`);
            // Safely handle if AI didn't return a perfect structure
            if (!blueprint.foundation) blueprint.foundation = { lands: 36, nonBasicLands: 15, creatures: 25, ramp: 10, draw: 10, interaction: 8, wipes: 2 };
        } catch (err) {
            console.error("Blueprint generation failed", err);
            addLog(`[Architect] Failed to generate bespoke blueprint. Falling back to default schema.`);
            // Fallback Blueprint
            blueprint = {
                strategyName: "Balanced Commander Build",
                packages: [
                    { name: "Primary Synergy", count: 15, description: "Cards that synergize with the commander." },
                    { name: "Secondary Support", count: 10, description: "Support pieces for the main strategy." }
                ],
                foundation: { lands: 37, nonBasicLands: 15, creatures: 25, ramp: 10, draw: 10, interaction: 10, wipes: 3 }
            };
        }

        // STEP 2: THE CONTRACTOR (Package Execution)
        const packages = blueprint.packages || [];

        // Breathing room between Blueprint and Contractor phases
        await new Promise(r => setTimeout(r, 3000));

        for (const pkg of packages) {
            setStatus(`Drafting Package: ${pkg.name}...`);
            addLog(`[Contractor] Sourcing ${pkg.count} cards for "${pkg.name}"...`);

            try {
                // Prepare candidate context for collection mode
                // Prepare Constraints (Contractor)
                const restrictedSetCodes = getRestrictedSets().map(s => s.code.toLowerCase());
                const constraints = {
                    restrictedSets: analysisSettings.restrictSet ? restrictedSetCodes : []
                };

                let pool = [];
                if (buildMode === 'collection') {
                    pool = collection.filter(c => {
                        const data = c.data || c;

                        // 1. Basic Validity
                        if (!isColorIdentityValid(c.color_identity || [], commanderColors)) return false;
                        if (deckCards.some(d => d.name === c.name)) return false;
                        if (Object.values(allNewSuggestions).some(n => n.name === c.name)) return false;

                        // 2. User Filters
                        if (analysisSettings.ownedOnly && (c.is_wishlist || c.quantity === 0)) return false;
                        if (analysisSettings.excludeAssigned && c.deck_id) return false;

                        // 3. Set Restriction
                        if (analysisSettings.restrictSet) {
                            const setCode = (data.set || data.set_code || '').toLowerCase();
                            if (!restrictedSetCodes.includes(setCode)) return false;
                        }

                        return true;
                    }).map(c => c.data || c);
                }

                const response = await GeminiService.fetchPackage(
                    userProfile.settings.geminiApiKey,
                    pkg,
                    { commander }, // Context
                    userProfile,
                    pool,
                    constraints
                );

                const result = response.result;
                const meta = response.meta;

                // ADMIN TELEMETRY
                if (isAdmin && meta) {
                    addToast(`PACKAGE (${pkg.name}): Used ${meta.model} (${meta.tokens} tokens)`, 'info');
                }

                if (result?.suggestions) {
                    let added = 0;
                    for (const s of result.suggestions) {
                        if (added >= pkg.count) break;

                        // Resolve Card Data (similar to before)
                        let scryData = null;
                        let isFromCollection = false;

                        // 1. Try Collection Match first (Fastest)
                        const inColl = collection.find(c => c.name === s.name);
                        if (inColl) {
                            scryData = inColl.data || inColl;
                            isFromCollection = true;
                        }

                        // 2. Try API Search if allowed (Discovery Mode or Fallback)
                        if (!scryData && buildMode !== 'collection') {
                            try {
                                const resp = await api.post('/api/cards/search', { query: s.name });
                                scryData = resp.data?.data?.[0];
                            } catch (e) { /* ignore search fail */ }
                        }

                        if (scryData) {
                            // Add to suggestions
                            const uuid = scryData.uuid || scryData.id;
                            if (allNewSuggestions[uuid] || deckCards.some(d => d.name === scryData.name)) continue;

                            allNewSuggestions[uuid] = {
                                ...s,
                                firestoreId: uuid,
                                name: scryData.name,
                                data: scryData,
                                suggestedType: pkg.name, // Tag it with the package name!
                                role: pkg.type || 'Synergy',
                                is_wishlist: !isFromCollection
                            };
                            added++;
                            if (typeof updateProgress === 'function') updateProgress(allNewSuggestions);
                        }
                    }
                    addLog(`[Contractor] Acquired ${added} cards for ${pkg.name}.`);
                }
            } catch (err) {
                addLog(`[Contractor] Failed to draft package ${pkg.name}: ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 5000));
        }

        // STEP 3: THE FOUNDATION (Vegetables)
        const foundation = blueprint.foundation;
        const roles = ['creatures', 'nonBasicLands', 'ramp', 'draw', 'interaction', 'wipes'];

        for (const role of roles) {
            // DYNAMIC TARGET (Ref: User Request)
            // Calculate how many we ALREADY have of this type from the Packages
            // This prevents "Double Dipping" (e.g. Package gives 20 creatures, Foundation asks for 30 more -> 50 total. Too many!)

            // Map 'role' to the 'suggestedType' or 'role' fields we used in packages
            // Note: Package cards might be tagged as 'Synergy' but are creatures. 
            // We need a robust count.

            let currentCount = 0;
            const currentDraft = Object.values(allNewSuggestions);

            if (role === 'creatures') {
                currentCount = currentDraft.filter(c => (c.data?.type_line || '').toLowerCase().includes('creature')).length;
            } else if (role === 'nonBasicLands') {
                currentCount = currentDraft.filter(c => (c.data?.type_line || '').toLowerCase().includes('land') && !(c.data?.type_line || '').toLowerCase().includes('basic')).length;
            } else {
                // For functional roles (ramp, draw, etc), we rely on the 'role' tag assigned by AI
                // Mapping: 'ramp' -> 'Mana Ramp'
                const roleTag = role === 'ramp' ? 'Mana Ramp' :
                    role === 'draw' ? 'Card Draw' :
                        role === 'wipes' ? 'Board Wipes' :
                            role === 'interaction' ? 'Targeted Removal' : role;

                currentCount = currentDraft.filter(c => c.role === roleTag || c.suggestedType === roleTag).length;
            }

            const desiredTotal = foundation[role] || 0;
            const target = Math.max(0, desiredTotal - currentCount);

            // HARD LIMIT CHECK
            // If we are already near 100, stop drafting.
            // (Assuming 1 commander)
            const TotalSoFar = deckCards.length + currentDraft.length + cmdCount;
            if (TotalSoFar >= 100) {
                addLog(`[Foundation] Deck full (${TotalSoFar}/100). Skipping ${role}.`);
                continue;
            }

            if (target <= 0) {
                addLog(`[Foundation] Sufficient ${role} already drafted (${currentCount}/${desiredTotal}). Skipping.`);
                continue;
            }

            // Cap target if it would push us way over 100
            const spaceRemaining = 100 - TotalSoFar;
            const actualTarget = Math.min(target, spaceRemaining);

            if (actualTarget <= 0) continue;

            setStatus(`Laying Foundation: ${role.toUpperCase()} (${actualTarget} slots)...`);

            try {
                // Prepare Constraints (Foundation)
                const restrictedSetCodes = getRestrictedSets().map(s => s.code.toLowerCase());
                const constraints = {
                    restrictedSets: analysisSettings.restrictSet ? restrictedSetCodes : []
                };

                let pool = [];
                if (buildMode === 'collection') {
                    pool = collection.filter(c => {
                        const data = c.data || c;

                        // 1. Basic Validity
                        if (!isColorIdentityValid(c.color_identity || [], commanderColors)) return false;
                        if (deckCards.some(d => d.name === c.name)) return false;
                        if (Object.values(allNewSuggestions).some(n => n.name === c.name)) return false;

                        // 2. User Filters
                        if (analysisSettings.ownedOnly && (c.is_wishlist || c.quantity === 0)) return false;
                        if (analysisSettings.excludeAssigned && c.deck_id) return false;

                        // 3. Set Restriction
                        if (analysisSettings.restrictSet) {
                            const setCode = (data.set || data.set_code || '').toLowerCase();
                            if (!restrictedSetCodes.includes(setCode)) return false;
                        }

                        return true;
                    }).map(c => c.data || c);
                }

                const roleDescriptions = {
                    creatures: "High-synergy creatures vital to the strategy.",
                    nonBasicLands: "Utility lands, dual lands, and command tower.",
                    ramp: "Mana rocks and ramp spells.",
                    draw: "Card draw and advantage engines.",
                    interaction: "Targeted removal and counterspells.",
                    wipes: "Board wipes and mass removal."
                };

                const result = await GeminiService.fetchPackage(
                    userProfile.settings.geminiApiKey,
                    { name: role, count: target, description: roleDescriptions[role] || `Efficient ${role} spells.` },
                    { commander },
                    userProfile,
                    pool,
                    constraints
                );

                if (result?.suggestions) {
                    for (const s of result.suggestions) {
                        // ... (Same resolving logic as above - refactor to helper in future)
                        let scryData = null;
                        let isFromCollection = false;
                        const inColl = collection.find(c => c.name === s.name);
                        if (inColl) { scryData = inColl.data || inColl; isFromCollection = true; }
                        if (!scryData && buildMode !== 'collection') {
                            try { const resp = await api.post('/api/cards/search', { query: s.name }); scryData = resp.data?.data?.[0]; } catch (e) { }
                        }

                        if (scryData) {
                            const uuid = scryData.uuid || scryData.id;
                            if (allNewSuggestions[uuid] || deckCards.some(d => d.name === scryData.name)) continue;

                            allNewSuggestions[uuid] = {
                                ...s, firestoreId: uuid, name: scryData.name, data: scryData,
                                suggestedType: role.charAt(0).toUpperCase() + role.slice(1),
                                role: role === 'ramp' ? 'Mana Ramp' :
                                    role === 'draw' ? 'Card Draw' :
                                        role === 'wipes' ? 'Board Wipes' :
                                            role === 'creatures' ? 'Synergy / Strategy' :
                                                role === 'nonBasicLands' ? 'Land' :
                                                    'Targeted Removal',
                                is_wishlist: !isFromCollection
                            };
                            if (typeof updateProgress === 'function') updateProgress(allNewSuggestions);
                        }
                    }
                }
            } catch (e) {
                console.warn(`Foundation draft for ${role} failed`, e);
            }
            await new Promise(r => setTimeout(r, 5000));
        }

        // STEP 4: ASSEMBLY (Land Fill)
        // STEP 4: ASSEMBLY (Land Fill & Polish)
        // STRICT 100 CARD CHECK (Ref: User Request)

        const currentDeckSize = deckCards.length + Object.keys(allNewSuggestions).length + cmdCount; // inclusive of drafted + existing + commander
        const targetDeckSize = 100;

        // 1. Check Land Count specifically
        const currentLandCount = Object.values(allNewSuggestions).filter(s => (s.data?.type_line || '').toLowerCase().includes('land')).length +
            deckCards.filter(c => (c.type_line || '').toLowerCase().includes('land')).length;

        const minLands = foundation.lands || 36;
        const landsNeeded = Math.max(0, minLands - currentLandCount);

        // 2. Budget for Lands
        // Only add lands if we have space OR if we are critically low on lands (in which case we might go over 100, but that's better than 20 lands)
        // Ideally, we respect the 100 cap.

        const slotsRemaining = targetDeckSize - currentDeckSize;

        if (landsNeeded > 0) {
            // If we have space, fill with lands. 
            // If landsNeeded > slotsRemaining, we fill slotsRemaining with lands (hitting 100) and warn user about land count?
            // Or we force add lands to reach minimum viable count even if > 100?
            // Decision: Strict 100 Cap is priority for "Over-generation" fix.

            const landsToAdd = Math.min(landsNeeded, Math.max(0, slotsRemaining));

            if (landsToAdd > 0) {
                setStatus(`Surveying Lands (${landsToAdd} slots)...`);
                addLog(`[Assembly] Adding ${landsToAdd} basic lands to reach capacity.`);
                const stats = calculateManaStats(deckCards, allNewSuggestions);
                const basics = generateBasicLands(landsToAdd, stats, collection);
                Object.assign(allNewSuggestions, basics);
            }
        }

        // 3. Final Polish (Deficit Check)
        const finalSize = deckCards.length + Object.keys(allNewSuggestions).length + cmdCount;
        const finalDeficit = targetDeckSize - finalSize;

        if (finalDeficit > 0) {
            addLog(`[Audit] Deck is at ${finalSize}/100. Top-up required.`);
            setStatus(`Finalizing Deck (${finalDeficit} slots)...`);

            // Fill remaining slots with basic lands to ensure legality
            const stats = calculateManaStats(deckCards, allNewSuggestions);
            const filler = generateBasicLands(finalDeficit, stats, collection);
            Object.assign(allNewSuggestions, filler);
            addLog(`[Audit] Added ${finalDeficit} basic lands to reach 100.`);
        } else if (finalDeficit < 0) {
            addLog(`[Audit] Deck is over capacity (${finalSize}/100). Please trim ${Math.abs(finalDeficit)} cards in Selection.`);
        }

        // Constraint 2: Fill to 100 if still short (with more basics or generic filler?)
        // For now, if we are short on spells, we might just add more lands or leave it for the user. 
        // The prompt says "stand up to others", so under-filling is better than garbage-filling? 
        // Actually, let's fill to 100 with basics if needed to ensure legality, or maybe warn.
        // Let's stick to the Land Cap. If we are under 100 but have 38 lands, maybe we stop.

        addLog(`[Assembly] Drafting Complete. Total Drafted: ${Object.keys(allNewSuggestions).length}`);

        if (loadingInterval) clearInterval(loadingInterval);

        // Finalize State
        initialSelectedIds.clear();
        Object.keys(allNewSuggestions).forEach(id => initialSelectedIds.add(id));
        setSuggestions(allNewSuggestions);
        setTimeout(() => setSelectedCards(new Set(initialSelectedIds)), 0);
        setStatus('Ready.');
        setStep(STEPS.ARCHITECT);
        setIsProcessing(false);
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

            // Invalidate caches
            await queryClient.invalidateQueries({ queryKey: ['decks'] });
            await queryClient.invalidateQueries({ queryKey: ['deck', deckId] });

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

        // Execution View (Terminal & Dashboard)
        return (
            <div className="max-w-5xl mx-auto py-8 space-y-6 h-full flex flex-col animate-fade-in relative z-10">
                <div className="text-center space-y-2">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 animate-pulse mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,1)]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Active Connection</span>
                        </div>
                    </div>
                    <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">
                        Architecting Interface
                    </h2>
                    <p className="text-indigo-400 font-mono text-xs tracking-widest uppercase opacity-70">{status}</p>
                </div>

                {/* KPI Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-16 h-16 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Cards Drafted</p>
                            <h3 className="text-4xl font-black text-white tabular-nums tracking-tighter">{analysisStats.drafted}</h3>
                            <div className="mt-2 w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (analysisStats.drafted / 100) * 100)}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-16 h-16 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Synergy Core</p>
                            <h3 className="text-4xl font-black text-white tabular-nums tracking-tighter">{analysisStats.synergy}</h3>
                            <p className="text-[10px] text-gray-500 mt-2 font-medium">Strategic Matches Found</p>
                        </div>
                    </div>

                    <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-16 h-16 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Remaining Gap</p>
                            <h3 className="text-4xl font-black text-white tabular-nums tracking-tighter">{analysisStats.deficit}</h3>
                            <p className="text-[10px] text-gray-500 mt-2 font-medium">Slots to Fill</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
                    {/* LEFT: Terminal Logs */}
                    <div className="bg-black/80 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col relative">
                        {/* Terminal Header */}
                        <div className="h-10 bg-gray-900 border-b border-white/10 flex items-center px-4 justify-between">
                            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">System Log</div>
                            <div className="text-[10px] text-indigo-400 font-mono uppercase">root@aetherius:~</div>
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

                    {/* RIGHT: Visual Feed */}
                    <div className="bg-gray-900/20 backdrop-blur-xl rounded-[2rem] border border-white/5 overflow-hidden flex flex-col">
                        <div className="h-10 bg-white/5 border-b border-white/5 flex items-center px-6 justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Feed</span>
                            </div>
                        </div>
                        <div className="flex-1 p-6 grid grid-cols-2 gap-4 overflow-y-auto custom-scrollbar">
                            {latestDrafts.length === 0 ? (
                                <div className="col-span-2 flex flex-col items-center justify-center p-8 text-center opacity-40">
                                    <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                    <p className="text-[10px] uppercase tracking-widest">Waiting for data stream...</p>
                                </div>
                            ) : (
                                latestDrafts.map((card) => (
                                    <div key={card.firestoreId} className="relative group aspect-[2.5/3.5] bg-black/40 rounded-xl overflow-hidden border border-white/10 animate-fade-in-up">
                                        <img
                                            src={card.data?.image_uris?.normal || card.data?.image_uris?.small || (card.data?.card_faces?.[0]?.image_uris?.normal) || 'https://c1.scryfall.com/file/scryfall-card-backs/large/59/597b79b3-7d77-4261-871a-60dd17403388.jpg'}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                            alt={card.name}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                            <div>
                                                <p className="text-xs font-bold text-white leading-tight">{card.name}</p>
                                                <p className="text-[10px] text-indigo-300 font-mono">{card.set?.toUpperCase()} • {card.role || 'Synergy'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
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

        // DYNAMIC TABS (Ref: User Request)
        // Extract unique types from the suggestion pool and sort them
        const uniqueTypes = [...new Set(Object.values(suggestions).map(s => s.suggestedType || 'Unknown'))].sort();
        const tabs = ['All', ...uniqueTypes];

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
                                        {deployAnalysis.grade?.powerLevel || deployAnalysis.grade?.grade || '7'}
                                        <span className="text-lg text-gray-500 ml-4 not-italic">/ 10</span>
                                    </div>
                                </div>
                                <div className="text-right space-y-1">
                                    <div className="text-xs font-black text-indigo-400 uppercase tracking-widest">Est. Win Rate</div>
                                    <div className="text-3xl font-black text-white">{deployAnalysis.grade?.metrics?.winTurn ? `T${deployAnalysis.grade.metrics.winTurn}` : (deployAnalysis.grade?.winRate || '25%')}</div>
                                </div>
                            </div>

                            {/* Strategy Summary */}
                            <div className="space-y-6">
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-3">
                                    <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                    Strategic Analysis
                                </h3>
                                <div className="prose prose-invert prose-indigo max-w-none">
                                    <div
                                        className="bg-black/20 p-6 rounded-2xl border border-white/5 text-gray-300 leading-relaxed font-medium shadow-inner"
                                        dangerouslySetInnerHTML={{ __html: deployAnalysis.strategy?.strategy || deployAnalysis.strategy?.summary || "Analysis complete." }}
                                    />
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
            <main className="flex-1 relative z-10 px-4 max-w-7xl mx-auto w-full min-h-0 flex flex-col overflow-y-auto custom-scrollbar">
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
