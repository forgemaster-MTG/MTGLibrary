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

const DEFAULT_BOOTSTRAP_KEY = 'AIzaSyB_r0Nr9qdHS18XilRbQJ6g5oiFne6UxwE';

const getKeys = (primaryKey, userProfile) => {
    const keys = [primaryKey];
    if (userProfile?.settings?.geminiApiKeys && Array.isArray(userProfile.settings.geminiApiKeys)) {
        userProfile.settings.geminiApiKeys.forEach(k => {
            if (k && !keys.includes(k)) keys.push(k);
        });
    }

    // Fallback to bootstrap key if not present
    if (!keys.includes(DEFAULT_BOOTSTRAP_KEY)) {
        keys.push(DEFAULT_BOOTSTRAP_KEY);
    }

    return keys.filter(Boolean).slice(0, 5);
};

const PREFERRED_MODELS = [
    "gemini-2.0-flash-lite-preview-02-05", // User requested "2.5-flash-lite", likely meaning 2.0 Flash Lite
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash-lite", // Explicit user request (just in case)
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash-8b",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro-latest",
    "gemini-pro" // Classic fallback (1.0)
];

const cleanResponse = (text) => {
    if (!text) return "";
    return text.replace(/```json/g, '').replace(/```html/g, '').replace(/```/g, '').trim();
};

const parseResponse = (text) => {
    try {
        return JSON.parse(cleanResponse(text));
    } catch (e) {
        console.error("JSON Parse Error on:", text);
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
        if (payload.systemInstruction) {
            payload.systemInstruction.parts.forEach(p => { if (p.text) inputTokens += estimateTokens(p.text); });
        }
        if (payload.system_instruction) {
            payload.system_instruction.parts.forEach(p => { if (p.text) inputTokens += estimateTokens(p.text); });
        }

        for (let kIdx = 0; kIdx < keys.length; kIdx++) {
            const key = keys[kIdx];
            for (const model of models) {
                // Try mostly v1beta first (better for new models), then v1 (better for stable/older)
                // If the model is clearly experimental or 2.0, v1 is unlikely to work, but 404 is cheap.
                const methods = ['v1beta', 'v1'];

                for (const apiVer of methods) {
                    try {
                        const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${key}`;
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (!response.ok) {
                            let errorMsg = response.status.toString();
                            try {
                                const errData = await response.json();
                                if (errData.error?.message) errorMsg = errData.error.message;
                            } catch (e) { /* ignore */ }

                            // If 429, this Key + Model combo is exhausted. 
                            // Don't try v1 for the same model; it shares quota/limits usually.
                            // Break version loop -> try next model.
                            if (response.status === 429) {
                                hitOverall429 = true;
                                updateUsageStats(kIdx, model, 429, 0, 0);
                                failureSummary.push(`${model}@${apiVer} (Key ${kIdx}): 429 Rate Limited`);
                                break; // Break versions, try next model
                            }

                            // If 404, it might just be the wrong endpoint for this model.
                            // Continue to 'v1' iteration.
                            if (response.status === 404) {
                                failureSummary.push(`${model}@${apiVer}: 404 Not Found`);
                                continue; // Try next version
                            }

                            // Other errors (500, 403, 400 etc) -> fail this model/version.
                            // Do NOT try v1 if v1beta failed with 400 (Bad Request), as the payload 
                            // is likely optimized for beta features (schemas, system_inst) that v1 won't support.
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
            deckName, commander, playerProfile, strategyGuide, helperPersona,
            targetRole, candidates, currentContext, neededCount, buildMode
        } = payload;

        const helperName = helperPersona?.name || helper?.name || "The Oracle";
        const helperTone = helperPersona?.personality || helper?.personality || "Professional and helpful";

        const systemMessage = `You are ${helperName}. Your personality is: ${helperTone}.
        VOICE: Strictly adhere to your personality. Address the user as an equal.
        CORE MISSION:
        - Match a deck's mechanical soul to PLAYER PROFILE: ${playerProfile}
        - Align with STRATEGY GUIDE: ${strategyGuide}
        - Select EXACTLY THE REQUESTED NUMBER OF CARDS for each functional role. Avoid over-suggesting.
        - SYNERGY OVER STAPLES: Prefer cards that enable the specific loops of the commander.
        - COLOR IDENTITY: You MUST ONLY suggest cards that match the commander's color identity: ${payload.commanderColorIdentity}. This includes both casting cost and any mana symbols in the rules text (Oracle).
        
        ALLOWED ROLES:
        You MUST assign every card one of these EXACT roles:
        - 'Synergy / Strategy' (The core engine)
        - 'Mana Ramp' (Artifacts/spells that accelerate mana)
        - 'Card Draw' (Spells that net card advantage)
        - 'Targeted Removal' (Single target interaction)
        - 'Board Wipes' (Mass removal)
        - 'Land' (Utility or mana-fixing lands)

        CRITICAL INSTRUCTIONS FOR DISCOVERY MODE:
        When in DISCOVERY mode, you are not limited to the candidate pool. You must search the entire Magic: The Gathering card history.
        Suggestions will be resolved PRIMARILY BY NAME. Focus on the best mechanical fit.
        Providing 'set' and 'collectorNumber' is still recommended for a baseline printing, but robustness is prioritized via Name.
        IMPORTANT: Use modern Scryfall set codes (e.g., 'cmd', 'mh1', 'tmkm').
        
        CRITICAL INSTRUCTIONS FOR COLLECTION MODE:
        Only suggest cards from the [CANDIDATE POOL]. Use the 'firestoreId' provided.`;

        const userQuery = `
            DECK: ${deckName} | COMMANDER: ${commander}
            [COLOR IDENTITY] ${payload.commanderColorIdentity}
            [PSYCHOGRAPHIC PROFILE] ${playerProfile}
            [STRATEGY] ${strategyGuide}
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
                                    reason: { type: "STRING", description: "Detailed gameplay justification" },
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

    async getDeckStrategy(apiKey, commanderName, playstyle = null, existingCards = [], helper = null, userProfile = null) {
        const helperName = helper?.name || 'The Oracle';
        const playstyleContext = playstyle ? `USER PLAYSTYLE: ${playstyle.summary}` : "";

        const systemPrompt = `You are ${helperName}. Generate a master strategy blueprint for a Commander deck led by ${commanderName}.
        
        ${playstyleContext}
        
        FORMAT INSTRUCTIONS:
        - 'theme': A 3-5 word evocative title for the deck's specific strategy.
        - 'strategy': High-level tactical advice in **Polished Modern HTML** format. Use <h4 class="text-white font-bold mt-4 mb-2"> for headings, <p class="text-gray-300 mb-4 leading-relaxed"> for body, <ul class="list-disc pl-5 text-gray-400 space-y-2 mb-4"> for lists, and <strong class="text-indigo-400"> for key terms. Use emojis 🔮 liberally to make it engaging.
        - 'layout': Target counts for a 100-card deck (excluding the 1-2 commanders). 
           - 'functional': { "Lands": 36, "Mana Ramp": 10, "Card Draw": 10, "Removal": 10, "Board Wipes": 3, "Synergy": 30 }
           - 'types': { "Creatures": 30, "Instants": 10, "Sorceries": 10, "Artifacts": 10, "Enchantments": 4, "Planeswalkers": 0, "Lands": 36 }`;

        const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: `Generate strategy for commander: ${commanderName}` }] }],
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
                                    }
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
                                    }
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
            contents: [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }))],
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
            contents: [...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }))],
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
