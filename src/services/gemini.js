/**
 * Gemini Service
 * Handles all AI interactions with built-in rotation and usage tracking.
 */

const PRICING = {
    'pro': { input: 1.25 / 1000000, output: 5.00 / 1000000 },
    'flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
    'flash-lite': { input: 0.0375 / 1000000, output: 0.15 / 1000000 }
};

const getModelTier = (model) => {
    if (model.includes('pro')) return 'pro';
    if (model.includes('lite') || model.includes('8b')) return 'flash-lite';
    return 'flash';
};

const estimateTokens = (text) => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
};

const updateUsageStats = (keyIndex, model, status, inputTokens, outputTokens) => {
    try {
        const stats = JSON.parse(localStorage.getItem('gemini_usage_stats') || '{}');
        const key = `key_${keyIndex}`;
        if (!stats[key]) stats[key] = {};
        if (!stats[key][model]) stats[key][model] = { success: 0, failure: 0, "429": 0, inputTokens: 0, outputTokens: 0 };

        const mStats = stats[key][model];
        if (status === 'success') {
            mStats.success++;
            mStats.inputTokens += inputTokens;
            mStats.outputTokens += outputTokens;
        } else if (status === 429) {
            mStats["429"]++;
        } else {
            mStats.failure++;
        }

        localStorage.setItem('gemini_usage_stats', JSON.stringify(stats));
    } catch (e) {
        console.error("Failed to update usage stats", e);
    }
};

const DEFAULT_BOOTSTRAP_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const getKeys = (primaryKey, userProfile) => {
    let rawKeys = [primaryKey];
    if (userProfile?.settings?.geminiApiKeys && Array.isArray(userProfile.settings.geminiApiKeys)) {
        userProfile.settings.geminiApiKeys.forEach(k => {
            if (k && !rawKeys.includes(k)) rawKeys.push(k);
        });
    }

    // Fallback to bootstrap key if not present
    if (!rawKeys.includes(DEFAULT_BOOTSTRAP_KEY)) {
        rawKeys.push(DEFAULT_BOOTSTRAP_KEY);
    }

    // Harden: Split by space and trim to remove any shell redirection junk (like '>> .env')
    const keys = rawKeys.filter(Boolean).map(k => k.split(' ')[0].trim());

    return [...new Set(keys)].slice(0, 5);
};

const PREFERRED_MODELS = [
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b"
];

const cleanResponse = (text) => {
    if (!text) return "";
    let cleaned = text.replace(/```json/g, '').replace(/```html/g, '').replace(/```/g, '').trim();

    // Enhanced Truncation Repair
    if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
        console.warn("AI response appears truncated. Implementing structural repair...");

        // Strategy: 
        // 1. If it ends inside a string (odd number of unescaped quotes), close the quote.
        // 2. Walk backwards to find the last complete object in the array if possible.
        // 3. Close the array and object.

        // Fix open strings
        const quotes = (cleaned.match(/"/g) || []).length;
        if (quotes % 2 !== 0) {
            cleaned += '"';
        }

        // Close common structures
        if (cleaned.includes('"suggestions"')) {
            // If it cut off inside an object in the suggestions array
            if (cleaned.lastIndexOf('{') > cleaned.lastIndexOf('}')) {
                // We are inside an incomplete object. We must close it or strip it.
                // Stripping the last incomplete object is safer for a clean JSON parse.
                cleaned = cleaned.substring(0, cleaned.lastIndexOf('{')).trim();
                if (cleaned.endsWith(',')) cleaned = cleaned.slice(0, -1);
            }

            if (!cleaned.endsWith(']')) cleaned += ']';
            if (!cleaned.endsWith('}')) cleaned += '}';
        } else {
            // General fallback
            if (cleaned.lastIndexOf('[') > cleaned.lastIndexOf(']')) cleaned += ']';
            if (cleaned.lastIndexOf('{') > cleaned.lastIndexOf('}')) cleaned += '}';
        }

        // Final sanity check: if it ends in a comma, remove it
        cleaned = cleaned.trim().replace(/,$/, '');
        if (!cleaned.endsWith('}')) cleaned += '}';
    }
    return cleaned;
};

const parseResponse = (text) => {
    try {
        return JSON.parse(cleanResponse(text));
    } catch (e) {
        console.error("JSON Parse Error at position:", e.message.match(/position (\d+)/)?.[1] || "unknown");
        // Log a snippet of where it failed
        const posMatch = e.message.match(/position (\d+)/);
        if (posMatch) {
            const pos = parseInt(posMatch[1]);
            console.error("Context around error:", text.substring(Math.max(0, pos - 50), pos + 50));
        }
        throw new Error("Failed to parse AI response: " + e.message);
    }
};

const GeminiService = {
    async executeWithFallback(payload, userProfile, options = {}) {
        const primaryKey = options.apiKey;
        const keys = getKeys(primaryKey, userProfile);
        const models = options.models || PREFERRED_MODELS;

        let failureSummary = [];
        let hitOverall429 = true;

        let inputTokens = 0;
        if (payload.contents) {
            payload.contents.forEach(c => c.parts.forEach(p => { if (p.text) inputTokens += estimateTokens(p.text); }));
        }
        if (payload.systemInstruction || payload.system_instruction) {
            const sysParts = (payload.systemInstruction || payload.system_instruction).parts;
            sysParts.forEach(p => { if (p.text) inputTokens += estimateTokens(p.text); });
        }

        // Check compatibility
        const requiresBeta = !!(payload.system_instruction || payload.systemInstruction || payload.generationConfig?.responseSchema || payload.generationConfig?.responseMimeType);

        const deadKeys = new Set();

        for (let kIdx = 0; kIdx < keys.length; kIdx++) {
            const key = keys[kIdx];
            if (deadKeys.has(key)) continue;

            let hit429ForKey = false;
            for (const model of models) {
                if (hit429ForKey) break;

                // Try mostly v1beta first (better for new models), then v1 (better for stable/older)
                const methods = ['v1beta', 'v1']; // Always try both to be safe, unless specifically restricted

                for (const apiVer of methods) {
                    try {
                        const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${key}`;

                        // v1 (stable) does not support system_instruction or JSON schema in the same way as v1beta
                        let finalPayload = { ...payload };
                        if (apiVer === 'v1') {
                            // Extract instruction text if it exists
                            const systemText = (finalPayload.system_instruction || finalPayload.systemInstruction)?.parts?.[0]?.text;

                            // Strip v1beta fields
                            delete finalPayload.system_instruction;
                            delete finalPayload.systemInstruction;

                            if (finalPayload.generationConfig) {
                                finalPayload.generationConfig = { ...finalPayload.generationConfig };
                                delete finalPayload.generationConfig.responseMimeType;
                                delete finalPayload.generationConfig.responseSchema;
                            }

                            // v1 fallback: Merge system instruction into contents as the first user message
                            if (systemText) {
                                finalPayload.contents = [
                                    { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${systemText}\n\nUNDERSTOOD. I will follow those instructions exactly.` }] },
                                    { role: 'model', parts: [{ text: "Understood. I am ready." }] },
                                    ...(finalPayload.contents || [])
                                ];
                            }
                        }

                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(finalPayload)
                        });

                        if (!response.ok) {
                            let errorMsg = response.status.toString();
                            let isInvalidKey = false;
                            try {
                                const errData = await response.json();
                                if (errData.error?.message) {
                                    errorMsg = errData.error.message;
                                    if (errorMsg.toLowerCase().includes('api key not valid') || errorMsg.toLowerCase().includes('invalid api key')) {
                                        isInvalidKey = true;
                                    }
                                }
                            } catch (e) { /* ignore */ }

                            if (isInvalidKey) {
                                failureSummary.push(`Key ${kIdx}: Invalid/Expired`);
                                deadKeys.add(key);
                                hit429ForKey = true; // Use this to break models loop too
                                break; // Skip all models for this key
                            }

                            if (response.status === 429) {
                                hitOverall429 = true;
                                updateUsageStats(kIdx, model, 429, 0, 0);
                                failureSummary.push(`${model}@${apiVer} (Key ${kIdx}): 429 Rate Limited`);

                                // INCREASED: Buffer delay to avoid hammering the next key/model immediately
                                await new Promise(resolve => setTimeout(resolve, 3000));

                                hit429ForKey = true;
                                break; // Skip other versions and MODELS for this key
                            }

                            if (response.status === 404) {
                                failureSummary.push(`${model}@${apiVer}: 404 Not Found`);
                                continue; // Try next version
                            }

                            // Other errors (500, 403, 400 etc) -> fail this model/version.
                            failureSummary.push(`${model}@${apiVer} (Key ${kIdx}): ${errorMsg}`);
                            updateUsageStats(kIdx, model, response.status, 0, 0);
                            hitOverall429 = false;

                            break; // Break versions, try next model
                        }

                        // SUCCESS
                        const data = await response.json();
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            const outTokens = estimateTokens(text);
                            updateUsageStats(kIdx, model, 'success', inputTokens, outTokens);
                            return text;
                        }
                    } catch (e) {
                        // Network error?
                        failureSummary.push(`${model}@${apiVer} Error: ${e.message}`);
                    }
                }
            }
        }

        if (hitOverall429 && typeof window !== 'undefined' && window.addToast) {
            window.addToast("All free tiers of Gemini have been used today across all provided keys.", "warning");
        }

        throw new Error(`Oracle Exhausted: ${failureSummary.join(' | ')}`);
    },

    async generateDeckSuggestions(apiKey, payload, helper = null, userProfile = null) {
        const {
            deckName, commander, strategyGuide, helperPersona,
            targetRole, candidates, currentContext, neededCount, buildMode,
            commanders, instructions
        } = payload;

        const helperName = helperPersona?.name || helper?.name || "The Oracle";
        const helperTone = helperPersona?.personality || helper?.personality || "Professional and helpful";

        const systemMessage = `You are ${helperName}. Your personality is: ${helperTone}.
        VOICE: Strictly adhere to your personality. Address the user as an equal.
        CORE MISSION:
        - EXECUTE THE DECK STRATEGY: ${strategyGuide}
        - SPECIAL INSTRUCTIONS: ${instructions || 'None provided.'}
        - STAMP OF COMPLETION (CRITICAL): You are being asked to provide a COMPLETE deck skeleton. You must return EXACTLY the number of cards requested in [REQUEST]. 
        - UNDER-REPORTING IS A FAILURE: If I ask for 99 cards, returning 40 or 60 is a failure. You must fill the "suggestions" array until the requested count is met.
        - SYNERGY PRIORITIZATION: Prioritize cards that enable triggers or mechanics mentioned in the commander's text.
        - COLOR IDENTITY: Suggest cards matching: ${payload.commanderColorIdentity}.
        - CONTEXT AWARENESS: DO NOT suggest cards already in deck: ${JSON.stringify(currentContext)}.
        - TOKEN EFFICIENCY: Your 'reason' for each card MUST be a short fragment (3-6 words). Example: "Top-tier ramp." or "Key synergy piece." Do not waste tokens on full sentences.
        
        ALLOWED ROLES:
        Assign one of: 'Synergy / Strategy', 'Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Land'.

        CRITICAL INSTRUCTIONS FOR DISCOVERY MODE:
        Search entire MTG history. Resolve by Name. Recommend 'set' and 'collectorNumber'.
        
        CRITICAL INSTRUCTIONS FOR COLLECTION MODE:
        Only suggest from [CANDIDATE POOL]. Use 'firestoreId'.`;

        const commanderDetail = (commanders || []).map(c => `[${c.name}] (${c.type_line}) - Oracle: ${c.oracle_text}`).join('\n');

        const userQuery = `
            DECK: ${deckName}
            [COMMANDER(S)]
            ${commanderDetail || commander}
            
            [COLOR IDENTITY] ${payload.commanderColorIdentity}
            [STRATEGY] ${strategyGuide}
            [SPECIAL FOCUS] ${instructions || 'None'}
            [STATUS] Current deck contains: ${JSON.stringify(currentContext)}
            [REQUEST] I need the following counts for these specific roles: ${JSON.stringify(payload.deckRequirements || { [targetRole]: neededCount })}
            [MODE] ${buildMode === 'discovery' ? 'DISCOVERY (Global Search)' : 'COLLECTION (Strict Pool)'}
            
            ${buildMode !== 'discovery' ? `[CANDIDATE POOL]\n${candidates.map(c => `ID: ${c.firestoreId || c.id} | Name: ${c.name} | Type: ${c.type_line}`).join('\n')}` : ''}
        `;

        const payload_obj = {
            system_instruction: { parts: [{ text: systemMessage }] },
            contents: [{ role: 'user', parts: [{ text: userQuery }] }],
            generationConfig: {
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        suggestions: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    firestoreId: { type: "STRING", description: "The ID from the pool, or 'discovery' for new cards" },
                                    name: { type: "STRING" },
                                    rating: { type: "NUMBER", description: "1-10 how well it fits" },
                                    reason: { type: "STRING", description: "Brief justification (max 12 words)" },
                                    set: { type: "STRING", description: "Scryfall set code (e.g. 'mkm')" },
                                    collectorNumber: { type: "STRING", description: "Scryfall collector number" },
                                    role: {
                                        type: "STRING",
                                        description: "MUST be one of: 'Synergy / Strategy', 'Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Land'"
                                    }
                                },
                                required: ["name", "rating", "reason", "set", "collectorNumber", "role"]
                            }
                        }
                    }
                }
            }
        };

        const result = await this.executeWithFallback(payload_obj, userProfile, { apiKey });
        return parseResponse(result);
    },

    async analyzeDeck(apiKey, deckList, commanderName, helper = null, userProfile = null) {
        const helperName = helper?.name || 'The Deck Doctor';
        const deckContext = deckList.map(c => `- ${c.countInDeck || 1}x ${c.name} (${c.type_line})`).join('\n') +
            `\n\nTotal Lands: ${deckList.reduce((acc, c) => (c.type_line?.toLowerCase().includes('land') ? acc + (c.countInDeck || 1) : acc), 0)}`;

        const prompt = `You are ${helperName}. Analyze this Commander deck for "${commanderName}".
        
        [DECKLIST]
        ${deckContext}
        
        [INSTRUCTIONS]
        Perform a clinical evaluation. Be critical but constructive.
        1. Calculate a Score (0-100).
        2. Identify 3-5 critical structural Issues.
        3. Propose up to 5 surgical Swaps with 'remove', 'add', 'reason'.
        4. Focus on Mana Curve, Synergy density, and Interaction package.`;

        const payload = {
            system_instruction: { parts: [{ text: prompt }] },
            contents: [{ role: 'user', parts: [{ text: `Analyze this Commander deck for "${commanderName}"` }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        score: { type: "NUMBER" },
                        metrics: {
                            type: "OBJECT",
                            properties: {
                                synergy: { type: "NUMBER" },
                                speed: { type: "NUMBER" },
                                interaction: { type: "NUMBER" }
                            }
                        },
                        issues: { type: "ARRAY", items: { type: "STRING" } },
                        changes: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    remove: { type: "STRING" },
                                    add: { type: "STRING" },
                                    reason: { type: "STRING" }
                                },
                                required: ["remove", "add", "reason"]
                            }
                        }
                    },
                    required: ["score", "metrics", "issues", "changes"]
                }
            }
        };

        const result = await this.executeWithFallback(payload, userProfile, { apiKey });
        return parseResponse(result);
    },

    async sendMessage(apiKey, history, message, context = '', helper = null, userProfile = null) {
        const helperName = helper?.name || 'MTG Forge';
        const helperPersonality = helper?.personality || 'Knowledgeable, friendly, and concise.';

        const systemPrompt = `You are ${helperName}, an elite Magic: The Gathering AI strategist and companion.
        
        [PERSONALITY]
        ${helperPersonality}
        
        [RESPONSE GUIDELINES]
        - Output ONLY raw HTML. Do not use Markdown blocks (no \`\`\`html).
        - Use Tailwind CSS classes for styling.
        - Primary font color should be text-gray-300 unless highlighting.
        - Use <strong class="text-indigo-400"> for card names or key terms.
        - Use <ul class="space-y-2 list-disc pl-5 my-4"> for lists.
        - Use <div class="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl my-4"> for emphasis or summary blocks.
        
        [CONTEXT]
        ${context}
        
        You are interacting with the user inside their personal deck-building laboratory. Be helpful, strategic, and stay in character.`;

        const contents = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            ...history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            { role: 'user', parts: [{ text: message }] }
        ];

        const payload = { contents };
        const result = await this.executeWithFallback(payload, userProfile, { apiKey });
        return cleanResponse(result);
    },

    async spruceUpText(apiKey, text, type = 'General', userProfile = null) {
        const prompt = `Rewrite this ${type} to be professional, evocative, and structured for a high-end gaming application. 
        Use basic HTML (<b>, <i>, <ul>, <li>). Do not use markdown blocks. 
        
        Original Text: "${text}"`;
        const payload = {
            system_instruction: { parts: [{ text: `You are a professional editor. Rewrite the following ${type} text to be professional, evocative, and structured for a high-end gaming application. Use basic HTML (<b>, <i>, <ul>, <li>). Do not use markdown blocks.` }] },
            contents: [{ role: 'user', parts: [{ text: text }] }]
        };
        const result = await this.executeWithFallback(payload, userProfile, { apiKey });
        return result.replace(/```html/g, '').replace(/```/g, '').trim();
    },

    async getDeckStrategy(apiKey, commanderInput, playstyle = null, existingCards = [], helper = null, userProfile = null) {
        const helperName = helper?.name || 'The Oracle';
        const helperPersona = helper?.personality || 'Wise, mystical, and strategic.';

        // Parse Commander Details
        const commanders = Array.isArray(commanderInput) ? commanderInput : [commanderInput];
        const commanderContext = commanders.map(c => {
            const name = c.name || c.data?.name || "Unknown Commander";
            const cost = c.mana_cost || c.cmc || c.data?.mana_cost || c.data?.cmc || "N/A";
            const type = c.type_line || c.data?.type_line || "Legendary Creature";
            const text = c.oracle_text || c.data?.oracle_text || "Refer to global knowledge";
            return `NAME: ${name}\nMANA COST: ${cost}\nTYPE: ${type}\nTEXT: ${text}`;
        }).join('\n---\n');

        const playstyleContext = playstyle
            ? `USER PLAYSTYLE PROFILE:\n- Summary: ${playstyle.summary}\n- Archetypes: ${playstyle.archetypes?.join(', ')}\n- Aggression: ${playstyle.scores?.aggression}/10`
            : "USER PLAYSTYLE: Unknown, assume balanced competitive-casual.";

        const systemPrompt = `You are ${helperName}. Your personality is: ${helperPersona}.
        
        MISSION:
        Generate a unique, high-level Commander STRATEGY BLUEPRINT for a deck led by:
        ${commanderContext}

        ${playstyleContext}
        
        CRITICAL RULES:
        1. **100 CARDS TOTAL**: The 'layout' counts MUST sum up to exactly 100 cards when including the ${commanders.length} commander(s).
        2. **DYNAMIC LAYOUT**: Tailor "Functional" and "Type" counts to the strategy.
        3. **VISUAL AESTHETICS**: You are a UI Designer as much as a Strategist. Your output must be VISUALLY STUNNING.
           - Use **EMOJIS** in every section header and list item. 🔮 ⚔️ 🛡️
           - Use **BANNERS**: Wrap key concepts in styled divs.
           - Use **COLORS**: specific tailwind text colors for types (e.g., text-green-400 for lands/ramp, text-red-400 for aggression).

        FORMAT INSTRUCTIONS:
        - 'theme': A 3-5 word evocative title (e.g., "Eldritch Spellslinger Chaos").
        - 'strategy': Tactical advice in **RICH HTML**. Do *not* use Markdown.
           
           Required HTML Elements & Styling:
           - **Headers**: <h4 class="text-xl font-black text-white mt-6 mb-3 flex items-center gap-2"><span class="text-2xl">⚡</span> SECTION TITLE</h4>
           - **Banners**: <div class="bg-indigo-500/10 border-l-4 border-indigo-500 p-4 rounded-r-lg my-4 text-gray-200">Content...</div>
           - **Keywords**: <span class="font-bold text-indigo-400">Keyword</span>
           - **Lists**: <ul class="space-y-2 mb-4"><li class="flex items-start gap-2"><span class="mt-1">🔹</span><span>Point...</span></li></ul>
           
           Required Sections:
           1. **The Grand Vision** (Intro)
           2. **The Game Plan** (Early/Mid/Late game - use a timeline or steps)
           3. **Winning the Game** (Win Conditions)
           4. **Secret Tech & Synergies** (Highlight specific interactions)
           
        - 'layout': Target counts for the remaining deck slots (Total 100 - Commanders).
           - 'functional': { "Lands": N, "Mana Ramp": N, "Card Draw": N, "Removal": N, "Board Wipes": N, "Synergy/Core": N }
           - 'types': { "Creatures": N, "Instants": N, "Sorceries": N, "Artifacts": N, "Enchantments": N, "Planeswalkers": N, "Lands": N }
        `;

        const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: `Generate unique strategy for this commander.` }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        suggestedName: { type: "STRING" },
                        theme: { type: "STRING" },
                        strategy: { type: "STRING" },
                        layout: {
                            type: "OBJECT",
                            properties: {
                                functional: {
                                    type: "OBJECT",
                                    properties: {
                                        "Lands": { type: "NUMBER" },
                                        "Mana Ramp": { type: "NUMBER" },
                                        "Card Draw": { type: "NUMBER" },
                                        "Removal": { type: "NUMBER" },
                                        "Board Wipes": { type: "NUMBER" },
                                        "Synergy": { type: "NUMBER" }
                                    },
                                    required: ["Lands", "Mana Ramp", "Card Draw", "Removal", "Board Wipes", "Synergy"]
                                },
                                types: {
                                    type: "OBJECT",
                                    properties: {
                                        "Creatures": { type: "NUMBER" },
                                        "Instants": { type: "NUMBER" },
                                        "Sorceries": { type: "NUMBER" },
                                        "Artifacts": { type: "NUMBER" },
                                        "Enchantments": { type: "NUMBER" },
                                        "Planeswalkers": { type: "NUMBER" },
                                        "Lands": { type: "NUMBER" }
                                    },
                                    required: ["Creatures", "Instants", "Sorceries", "Artifacts", "Enchantments", "Planeswalkers", "Lands"]
                                }
                            },
                            required: ["functional", "types"]
                        }
                    },
                    required: ["suggestedName", "theme", "strategy", "layout"]
                }
            }
        };
        const result = await this.executeWithFallback(payload, userProfile, { apiKey });
        return parseResponse(result);
    },

    async gradeDeck(apiKey, payload, userProfile = null) {
        const { deckName, commander, cards, playerProfile, strategyGuide, helperPersona } = payload;
        const helperName = helperPersona?.name || "The Oracle";

        const systemInstruction = `You are ${helperName}, a Tier-1 MTG competitive analyst.
        
        MISSION:
        Evaluate the power level of the provided decklist based on the "Commander Bracket" system.
        
        CRITIQUE FORMATTING:
        Provide the 'critique' and 'bracketJustification' fields as **Polished Modern HTML**. 
        - Use <strong class="text-white"> for emphasis.
        - Use emojis 🧪 🧬 ⚡ liberally to enhance the "Deck Doctor" persona.
        - Do NOT use markdown.
        
        BRACKET DEFINITIONS:
        - Bracket 1 (Exhibition): Precons, low-powered themes, extreme budget, or jank.
        - Bracket 2 (Core): Standard casual decks with basic synergies and upgrades.
        - Bracket 3 (Upgraded): High-synergy decks with efficient win conditions and strong mana bases.
        - Bracket 4 (Optimized): High-power casual, infinite combos, tutors, and fast mana (short of cEDH).
        - Bracket 5 (cEDH): Tier-0 competitive decks designed for Turn 1-3 wins or hard stax.
        
        METRICS (1-10):
        - Efficiency: Average CMC vs Mana acceleration quality.
        - Interaction: Density and quality of removal, counters, and protection.
        - winTurn: The average turn the deck projects to present a lethal threat.`;

        const userQuery = `
            DECK: "${deckName}"
            COMMANDER: ${commander}
            STRATEGY: ${strategyGuide}
            USER PROFILE: ${playerProfile}
            DECKLIST:
            ${cards.map(c => `- ${c.name}`).join('\n')}
        `;

        const body = {
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: userQuery }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        powerLevel: { type: "NUMBER", description: "Float between 1.0 and 10.0" },
                        commanderBracket: { type: "INTEGER", description: "1 to 5 based on rubric" },
                        metrics: {
                            type: "OBJECT",
                            properties: {
                                efficiency: { type: "NUMBER" },
                                interaction: { type: "NUMBER" },
                                winTurn: { type: "NUMBER" }
                            }
                        },
                        bracketJustification: { type: "STRING" },
                        critique: { type: "STRING", description: "Emotional/Strategic feedback" },
                        mechanicalImprovements: { type: "ARRAY", items: { type: "STRING" } },
                        recommendedSwaps: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    remove: { type: "STRING" },
                                    add: { type: "STRING" },
                                    reason: { type: "STRING" }
                                },
                                required: ["remove", "add", "reason"]
                            }
                        }
                    },
                    required: ["powerLevel", "commanderBracket", "metrics", "bracketJustification", "critique", "mechanicalImprovements", "recommendedSwaps"]
                }
            }
        };

        const result = await this.executeWithFallback(body, userProfile, { apiKey });
        return parseResponse(result);
    },

    async generatePlaystyleQuestion(apiKey, priorAnswers, userProfile = null) {
        const systemPrompt = `You are the Oracle of the Multiverse. You are conducting a psychographic assessment of a Magic: The Gathering player.
        
        Your questions should be evocative, thematic, and cover:
        - Aggression (Face vs Board)
        - Interaction (Control vs Proactive)
        - Complexity (Linear vs Rube Goldberg)
        - Archetypes (Aggro, Control, Combo, Midrange, Stax)`;

        const userQuery = `Current Assessment State: ${JSON.stringify(priorAnswers)}. Generate the next clinical question.`;

        const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userQuery }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        question: { type: "STRING" },
                        choices: { type: "ARRAY", items: { type: "STRING" } }
                    },
                    required: ["question", "choices"]
                }
            }
        };
        const result = await this.executeWithFallback(payload, userProfile, { apiKey });
        return parseResponse(result);
    },

    async synthesizePlaystyle(apiKey, answers, userProfile = null) {
        const systemPrompt = `Analyze the following MTG session answers and synthesize a permanent psychographic profile for the player.
        
        FORMATTING:
        - 'summary': A 3-4 sentence evocative summary in **Polished HTML**. Use <strong class="text-white"> for emphasis and emojis 🎭. Make it feel like a mythical prophecy.

        CATEGORIES:
        - Aggression: Desire for combat and early pressure.
        - Interaction: Desire to stop opponents or control the stack.
        - Complexity: Preference for intricate loops vs simple power.
        - Social: Preference for group hug/politics vs kingmaking.`;

        const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: `PLAYER ANSWERS: ${JSON.stringify(answers)}` }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        summary: { type: "STRING", description: "3-4 sentence evocative summary" },
                        tags: { type: "ARRAY", items: { type: "STRING" }, description: "Short traits like 'Combo Fiend', 'Stax Master'" },
                        scores: {
                            type: "OBJECT",
                            properties: {
                                aggression: { type: "NUMBER" },
                                interaction: { type: "NUMBER" },
                                complexity: { type: "NUMBER" },
                                political: { type: "NUMBER" }
                            }
                        },
                        archetypes: { type: "ARRAY", items: { type: "STRING" } }
                    },
                    required: ["summary", "tags", "scores", "archetypes"]
                }
            }
        };
        const result = await this.executeWithFallback(payload, userProfile, { apiKey });
        return parseResponse(result);
    },

    async refinePlaystyleChat(apiKey, history, currentProfile, helper = null, userProfile = null) {
        const helperName = helper?.name || 'The Oracle';
        const systemPrompt = `You are ${helperName}. Carry out a conversation with the user to refine their MTG Playstyle Profile. 
        Current State: ${JSON.stringify(currentProfile)}.
        
        In every response:
        1. Keep the AI personality intact.
        2. Silently update the 'updatedProfile' object based on their responses.
        3. Be insightful and slightly assertive about your observations.`;

        const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: history.length > 0
                ? [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }))]
                : [{ role: 'user', parts: [{ text: "Begin the session." }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        aiResponse: { type: "STRING", description: "Evocative conversation" },
                        updatedProfile: {
                            type: "OBJECT",
                            properties: {
                                summary: { type: "STRING" },
                                tags: { type: "ARRAY", items: { type: "STRING" } },
                                scores: {
                                    type: "OBJECT",
                                    properties: {
                                        aggression: { type: "NUMBER" },
                                        interaction: { type: "NUMBER" },
                                        complexity: { type: "NUMBER" },
                                        political: { type: "NUMBER" }
                                    }
                                },
                                archetypes: { type: "ARRAY", items: { type: "STRING" } }
                            }
                        }
                    },
                    required: ["aiResponse", "updatedProfile"]
                }
            }
        };
        const result = await this.executeWithFallback(payload, userProfile, { apiKey });
        return JSON.parse(result);
    },

    async forgeHelperChat(apiKey, history, currentDraft, userProfile = null) {
        const systemPrompt = `You are the MTG Spark-Forge. You are interviewing the user to create their permanent AI Deck-Building companion.
        
        CURRENT DRAFT: ${JSON.stringify(currentDraft)}
        
        You need to determine:
        - Name
        - Type (e.g. Eldrazi Construct, Faerie Spirit, Thran AI)
        - Personality (e.g. Grumpy, Whimsical, Calculating)
        
        Keep the conversation immersive. Update 'updatedDraft' with every response.`;

        const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: history.length > 0
                ? [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }))]
                : [{ role: 'user', parts: [{ text: "Initialize Forge." }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        aiResponse: { type: "STRING" },
                        updatedDraft: {
                            type: "OBJECT",
                            properties: {
                                name: { type: "STRING" },
                                type: { type: "STRING" },
                                personality: { type: "STRING" },
                                visualDescription: { type: "STRING" }
                            }
                        }
                    },
                    required: ["aiResponse", "updatedDraft"]
                }
            }
        };
        const result = await this.executeWithFallback(payload, userProfile, { apiKey });
        return JSON.parse(result);
    },

    async generateReleaseNotes(apiKey, tickets, userProfile = null) {
        const systemPrompt = `You are the Lead Developer of MTG Forge. Generate professional, evocative release notes for the latest update.
        Use HTML with Tailwind (text-gray-300, indigo-400 highlights). 
        Include sections: [New Mechanics], [Bug Squashing], [In the Forge].`;

        const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: `Tickets: ${JSON.stringify(tickets)}` }] }]
        };
        const result = await this.executeWithFallback(payload, userProfile, { apiKey });
        return result.replace(/```html/g, '').replace(/```/g, '').trim();
    }
};

export { GeminiService, PRICING, getModelTier };
export default GeminiService;
