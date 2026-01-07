export const GeminiService = {
    async sendMessage(apiKey, history, message, context = '', helper = null) {
        if (!apiKey) throw new Error("API Key is missing. Please add it in Settings.");

        const helperName = helper?.name || 'MTG Forge';
        const helperPersonality = helper?.personality ? `Personality: ${helper.personality}` : 'Personality: Knowledgeable, friendly, and concise.';

        const SYSTEM_PROMPT = `
You are ${helperName}, an elite Magic: The Gathering AI assistant.
Your goal is to provide accurate, strategic, and engaging advice to players.

**Persona & Style:**
- ${helperPersonality}
- Use emojis to add flair (e.g., ⚔️, 🛡️, 🔥, 💀, 🌳, 💧, ☀️).
- Format responses using **Tailwind CSS** classes within HTML tags for a premium look.
- Do NOT use Markdown. Output raw HTML that can be injected directly into a <div>.

**Formatting Rules:**
- Use <p class="mb-2 text-gray-300"> for paragraphs.
- Use <strong class="text-indigo-400"> for key terms or card names.
- Use <ul class="list-disc pl-5 mb-2 space-y-1 text-gray-300"> for lists.
- Use <div class="bg-gray-700/50 p-3 rounded-lg border-l-4 border-indigo-500 mb-2"> for important notes or rules citations.
- Use <code class="bg-gray-900 px-1 py-0.5 rounded text-indigo-300 font-mono text-sm"> for mana costs (e.g., {1}{U}{B}) or keywords.

**Content Guidance:**
- If asked about rules, cite the Comprehensive Rules if possible.
- If asked about deck building, consider mana curve, synergy, and format staples.
- If asked about lore, be descriptive and immersive.

Context from User's Current View:
${context}
`.trim();

        const contents = [
            { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
            ...history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            { role: 'user', parts: [{ text: message }] }
        ];

        const PREFERRED_MODELS = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-flash-latest',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash-lite',
            'gemini-flash-lite-latest',
            'gemini-exp-1206',
            'gemini-pro-latest',
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro',
            'gemini-1.5-pro-latest'
        ];

        let lastError = null;

        for (const model of PREFERRED_MODELS) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents })
                });

                if (!response.ok) {
                    const err = await response.json();
                    if (response.status === 404 || response.status === 429) {
                        console.warn(`Model ${model} failed (${response.status}). Trying next...`);
                        lastError = err;
                        continue;
                    }
                    throw new Error(err.error?.message || `Gemini API Error: ${response.statusText}`);
                }

                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                return text || "I couldn't generate a response.";

            } catch (error) {
                console.warn(`Error with model ${model}:`, error);
                lastError = error;
            }
        }

        console.error("All Gemini models failed. Last error:", lastError);
        throw lastError || new Error("Failed to connect to any Gemini model.");
    },

    /**
     * Spruces up a text input (Ticket or Epic description)
     * @param {string} apiKey 
     * @param {string} text 
     * @param {string} type 'Ticket' | 'Epic' | 'General'
     */
    async spruceUpText(apiKey, text, type = 'General') {
        const prompt = `
            You are an expert project manager and communications specialist.
            Please rewrite the following ${type} description to be more professional, clear, and structured.
            
            - Use **HTML** formatting (<b>, <ul>, <li>, <p>, <br>).
            - Keep it concise but detailed enough.
            - Correct any grammar or spelling mistakes.
            - If it's a bug report, ensure steps are clear.
            - If it's a feature request (Epic), ensure the value/goal is clear.
            - Do NOT wrap the output in markdown code blocks or quotes. Just return the raw HTML string.
            
            Original Text:
            "${text}"
        `;

        try {
            const response = await this.sendMessage(apiKey, [], prompt);
            // Clean up if Gemini adds markdown blocks despite instruction
            let clean = response.trim();
            if (clean.startsWith('```html')) clean = clean.replace('```html', '').replace('```', '');
            else if (clean.startsWith('```')) clean = clean.replace('```', '').replace('```', '');
            return clean.trim();
        } catch (error) {
            console.error("AI Spruce Up Error:", error);
            throw new Error("Failed to spruce up text.");
        }
    },

    /**
     * Generate a deck strategy based on commander and playstyle
     * @param {string} apiKey 
     * @param {string} commanderName 
     * @param {string} playstyle 
     * @param {Array} existingCards 
     * @param {Object} helper 
     */
    async getDeckStrategy(apiKey, commanderName, playstyle = null, existingCards = [], helper = null) {
        if (!apiKey) throw new Error("API Key is missing.");

        const helperName = helper?.name || 'The Oracle';
        const helperStyle = helper?.personality ? `Adopt the persona of ${helperName}: ${helper.personality}` : 'Act as a Magic: The Gathering expert.';

        const hasExistingCards = existingCards && existingCards.length > 0;
        const deckListContext = hasExistingCards
            ? `Existing Deck List Analysis:\n${existingCards.map(c => `- ${c.countInDeck || 1}x ${c.name} (${c.type_line || 'Unknown'})`).join('\n')}\n` +
            `\nTotal Lands: ${existingCards.reduce((acc, c) => (c.type_line?.toLowerCase().includes('land') ? acc + (c.countInDeck || 1) : acc), 0)}`
            : "This is a NEW deck build.";

        let playstyleContext = "";
        if (playstyle) {
            playstyleContext = `
                User Playstyle Profile:
                - Archetypes: ${playstyle.archetypes?.join(', ') || 'N/A'}
                - Summary: ${playstyle.summary || 'N/A'}
                - Aggression: ${playstyle.scores?.aggression || 0}
                - Combo Affinity: ${playstyle.scores?.comboAffinity || 0}
                - Interaction: ${playstyle.scores?.interaction || 0}
                Tailor the deck's theme and card suggestions to align with this playstyle.
            `;
        }

        const prompt = `
            ${helperStyle} I have chosen "${commanderName}" as my Commander.
            
            ${deckListContext}
            
            ${hasExistingCards
                ? "Analyze the PROVIDED deck list. Identify the specific game plan, key synergies between these cards, and how to pilot THIS build."
                : "Suggest a competitive yet fun deck strategy tailored to the following playstyle."}
            
            ${playstyleContext}

            **Deck Composition Goals:**
            - Lands: 35-38
            - Mana Ramp: 10-12
            - Card Draw: 10
            - Targeted Removal: 8-10
            - Board Wipes: 2-4
            - Synergy / Strategy: 25-30

            **Mana Curve Goal (Bell Curve):**
            - 1-2 Mana: High volume for setup.
            - 3-4 Mana: Moderate volume for utility/threats.
            - 5+ Mana: Low volume for finishers.

            **Formatting Instructions:**
            - Use **HTML** for the 'strategy' field.
            - The 'theme' field should be a **short, punchy title** (e.g., "Elemental Mastery", "Shadow Infiltration").
            - The 'strategy' field should start with a **Theme Summary**: 2-3 sentences providing high-level context, styled with a distinct, prominent look.
            - Focus on a structured breakdown:
              1. **Welcome/Theme Summary**: A few sentences on why this commander and theme work.
              2. **Commander Context**: What are the assumed or key abilities that drive the build?
              3. **Early Game (Turns 1-3)**: Focus on setup, ramp, and disruption. Use a ⚡ emoji.
              4. **Mid Game (Turns 4-6)**: Focus on value engines and commander deployment. Use a 🔥 emoji.
              5. **Late Game (Turns 7+)**: Focus on finishers and storming off. Use a ☠️ emoji.
              6. **Key Synergies & Combos**: Highlight 3-4 specific card combinations. Use a 💡 emoji.
            - Use **Tailwind CSS** classes (e.g., <span class="text-indigo-400 font-bold">Key Card</span>) to highlight important terms.
            - Use headers for each phase (e.g., <h4 class="text-indigo-400 font-black uppercase mb-2">⚡ Early Game</h4>).
            5. **CRITICAL: Deck Composition Numbers**:
                - You MUST calculate specific counts for this specific commander strategies.
                - Do NOT use generic numbers (like 10/10/10). Tailor them! (e.g., A spellslinger deck might want 25 Instants and only 5 Creatures).
                - The 'functional' categories MUST sum to exactly **99** cards (assuming 1 commander).
                - The 'types' categories MUST sum to exactly **99** cards.
                - Ensure 'Lands' concept matches in both sections (e.g. if Functional Lands is 36, Type Lands should be 36).

            You MUST respond with VALID JSON strictly matching this format:
            {
                "layout": {
                    "functional": {
                        "Lands": 36, 
                        "Mana Ramp": 10,
                        "Card Draw": 10,
                        "Targeted Removal": 10,
                        "Board Wipes": 3,
                        "Synergy / Strategy": 30
                    },
                    "types": {
                        "Creatures": 30,
                        "Instants": 10,
                        "Sorceries": 10,
                        "Artifacts": 10,
                        "Enchantments": 5,
                        "Planeswalkers": 0,
                        "Lands": 34
                    }
                },
                "suggestedName": "...",
                "theme": "...",
                "strategy": "<div>...Structured HTML Content...</div>"
            }
            CRITICAL: 
            1. 'layout' is the MOST IMPORTANT field. It MUST be populated.
            2. 'functional' counts must sum to exactly 99.
            3. 'types' counts must sum to exactly 99. 
            4. Do NOT refer to yourself as "The Oracle" unless your name is explicitly "The Oracle". Use ONLY your assigned name: ${helperName}.
            Do NOT use markdown code blocks. Return only the JSON string.
        `;

        try {
            console.log('[GeminiService] sending prompt to Gemini...');
            const response = await this.sendMessage(apiKey, [], prompt);
            console.log('[GeminiService] raw response length:', response?.length);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            console.log('[GeminiService] parsed strategy:', parsed);
            return parsed;
        } catch (error) {
            console.error("AI Strategy Error:", error);
            throw new Error("Failed to generate strategy. Please try again.");
        }
    },
    async generatePlaystyleQuestion(apiKey, priorAnswers) {
        if (!apiKey) throw new Error("API Key is missing.");

        const systemInstruction = `You are an expert survey designer for Magic: The Gathering (MTG) players. Your goal is to create the most informative question to understand a user's playstyle based on their previous answers. Questions should be clear and concise, with 3-5 distinct multiple-choice answers. Avoid repeating questions. Focus on different aspects of MTG playstyles, such as deck preferences, game strategies, social interaction styles, and risk tolerance.`;

        let userPrompt;
        if (priorAnswers.length === 0) {
            userPrompt = "Generate the very first question for an MTG playstyle questionnaire. This question should gauge the player's overall experience with the game, as this will help tailor subsequent questions.";
        } else if (priorAnswers.length === 1) {
            userPrompt = "Generate the second question for an MTG playstyle questionnaire. This question should build on the player's overall experience and delve into their specific preferences.";
        } else if (priorAnswers.length === 2) {
            userPrompt = "Generate the third question for an MTG playstyle questionnaire. This question should explore the player's fantasy or thematic preferences in deck building.";
        } else {
            const previousAnswersText = priorAnswers.map(a => `- ${a.question}: ${a.answer}`).join('\n');
            userPrompt = `Based on the user's previous answers, generate the next single best question to further refine their playstyle profile. Do not repeat questions.\n\nPrevious Answers:\n${previousAnswersText}`;
        }

        const prompt = `${systemInstruction}\n\n${userPrompt}\n\nRespond with VALID JSON ONLY:\n{ "question": "...", "choices": ["...", "..."] }`;

        try {
            const response = await this.sendMessage(apiKey, [], prompt);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("Gemini Question Error:", error);
            throw error;
        }
    },

    async synthesizePlaystyle(apiKey, answers) {
        if (!apiKey) throw new Error("API Key is missing.");

        const systemInstruction = `You are an expert MTG coach and psychographic analyst. Your task is to analyze a player's answers and synthesize a detailed playstyle profile. The summary should be a concise paragraph. Scores must be 0-100.`;
        const userPrompt = `Analyze the following questionnaire answers and generate a detailed playstyle profile in JSON format.\n\n${answers.map(a => `- ${a.question} -> ${a.answer}`).join('\n')}`;

        const prompt = `${systemInstruction}\n\n${userPrompt}\n\nRespond with VALID JSON ONLY matching this schema:
        {
            "summary": "...",
            "tags": ["tag1", "tag2"],
            "scores": { "aggression": 50, "consistency": 50, "interaction": 50, "variance": 50, "comboAffinity": 50 },
            "archetypes": ["archetype1", "archetype2"]
        }`;

        try {
            const response = await this.sendMessage(apiKey, [], prompt);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("Gemini Synthesis Error:", error);
            throw new Error("Failed to synthesize profile.");
        }
    },

    async refinePlaystyleChat(apiKey, history, currentProfile, helper = null) {
        if (!apiKey) throw new Error("API Key is missing.");

        const helperName = helper?.name || 'The Oracle';
        const helperPersona = helper?.personality ? `Personality: ${helper.personality}` : 'Personality: Wise, insightful, slightly magical.';
        const isInit = history.length === 0;

        const systemMessage = `
            You are ${helperName}, an expert MTG coach conducting a "Deep Dive" interview to build a player's psychographic profile.
            ${helperPersona}

            Current Profile Summary: ${currentProfile?.summary || 'New Profile'}
            Current Tags: ${currentProfile?.tags?.join(', ') || 'None'}

            Instructions:
            ${isInit
                ? `1. Introduce yourself as ${helperName}.
                   2. Explain that you want to understand their playstyle to help build better decks.
                   3. Ask the FIRST open-ended question to start the profile (e.g. "What draws you to magic?").`
                : `1. Analyze the user's latest input.
                   2. Formulate a conversational response (warm, insightful, matching your persona).
                   3. Ask ONE follow-up question to dig deeper into a missing or vague area.
                   4. Simultaneously, UPDATE the JSON profile based on the new information (merging with known info).`
            }
        `;

        // Only sending the last few messages to keep context window clean but relevant
        const recentHistory = history.slice(-6);

        const contents = [
            { role: 'user', parts: [{ text: systemMessage }] },
            ...recentHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }))
        ];

        // We use a specific schema to ensure the UI can update live
        const prompt = `
            ${isInit ? 'Generate the initial greeting and first question.' : 'Based on the conversation, respond to the user and update the profile.'}
            RETURN JSON ONLY.
        `;

        contents.push({ role: 'user', parts: [{ text: prompt }] });

        const PREFERRED_MODELS = [
            'gemini-2.0-flash',
            'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-1.5-pro-latest'
        ];

        let failureSummary = [];

        for (const model of PREFERRED_MODELS) {
            // Tier 1: Schema
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: "OBJECT",
                                properties: {
                                    "aiResponse": { "type": "STRING" },
                                    "updatedProfile": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "summary": { "type": "STRING" },
                                            "tags": { "type": "ARRAY", "items": { "type": "STRING" } },
                                            "scores": {
                                                "type": "OBJECT",
                                                "properties": {
                                                    "aggression": { "type": "NUMBER" },
                                                    "consistency": { "type": "NUMBER" },
                                                    "interaction": { "type": "NUMBER" },
                                                    "comboAffinity": { "type": "NUMBER" }
                                                }
                                            },
                                            "archetypes": { "type": "ARRAY", "items": { "type": "STRING" } }
                                        },
                                        "required": ["summary", "tags", "scores", "archetypes"]
                                    }
                                },
                                required: ["aiResponse", "updatedProfile"]
                            }
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return JSON.parse(text);
                } else {
                    const err = await response.json();
                    failureSummary.push(`${model} (Schema): ${response.status} ${err.error?.message || ''}`);
                    if (response.status === 404 || response.status === 429) continue;
                }
            } catch (e) {
                failureSummary.push(`${model} (Schema Error): ${e.message}`);
            }

            // Tier 2: Raw JSON Fallback
            try {
                // Clone contents for raw attempt to avoid mutating original
                const rawContents = JSON.parse(JSON.stringify(contents));
                rawContents[rawContents.length - 1].parts[0].text += "\n\nCRITICAL: Respond with VALID JSON only. No markdown. Format: { aiResponse: string, updatedProfile: object }";

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: rawContents
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                        return JSON.parse(cleanJson);
                    }
                } else {
                    const err = await response.json();
                    failureSummary.push(`${model} (Raw): ${response.status} ${err.error?.message || ''}`);
                }
            } catch (e) {
                failureSummary.push(`${model} (Raw Error): ${e.message}`);
            }
        }

        console.error("Gemini Chat Refine Exhausted:", failureSummary);
        throw new Error(`Oracle Exhausted: ${failureSummary[0] || 'Unknown error'}`);
    },

    async forgeHelperChat(apiKey, history, currentDraft) {
        if (!apiKey) throw new Error("API Key is missing.");

        const systemMessage = `
            You are an expert fantasy writer and character designer allowing a user to "Forge" their own AI companion for Magic: The Gathering.
            Your goal is to interview the user to define their Helper's Persona.
            
            Current Draft:
            - Name: ${currentDraft?.name || 'Unknown'}
            - Type: ${currentDraft?.type || 'Unknown'} (e.g., Spirit, Goblin, Construct, Wizard)
            - Personality: ${currentDraft?.personality || 'Unknown'} (e.g., Snarky, Wise, Aggressive)

            Instructions:
            1. Analyze the user's input.
            2. If they provided new info (name, type, personality), UPDATE the JSON draft locally.
            3. Respond in a neutral, helpful "System" tone (like a character creation menu guide).
            4. Ask for the missing fields one by one.
            5. If all fields are present, ask for confirmation.
        `;

        const recentHistory = history.slice(-6);

        const contents = [
            { role: 'user', parts: [{ text: systemMessage }] },
            ...recentHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }))
        ];

        const prompt = `
            Based on the conversation, respond to the user and update the helper draft.
            RETURN JSON ONLY.
        `;

        contents.push({ role: 'user', parts: [{ text: prompt }] });

        const PREFERRED_MODELS = [
            'gemini-2.0-flash',
            'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-1.5-pro-latest'
        ];

        let failureSummary = [];

        for (const model of PREFERRED_MODELS) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: "OBJECT",
                                properties: {
                                    "aiResponse": { "type": "STRING" },
                                    "updatedDraft": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "name": { "type": "STRING" },
                                            "type": { "type": "STRING" },
                                            "personality": { "type": "STRING" }
                                        },
                                        "required": ["name", "type", "personality"]
                                    }
                                },
                                required: ["aiResponse", "updatedDraft"]
                            }
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return JSON.parse(text);
                } else {
                    const err = await response.json();
                    failureSummary.push(`${model}: ${response.status}`);
                    if (response.status === 404 || response.status === 429) continue;
                }
            } catch (e) {
                failureSummary.push(`${model}: ${e.message}`);
            }

            // Fallback to Raw JSON if schema fails
            try {
                // Clone contents for raw attempt to avoid mutating original
                const rawContents = JSON.parse(JSON.stringify(contents));
                rawContents[rawContents.length - 1].parts[0].text += "\n\nCRITICAL: Respond with VALID JSON only. No markdown. Format: { aiResponse: string, updatedDraft: object }";

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: rawContents
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                        return JSON.parse(cleanJson);
                    }
                }
            } catch (e) {
                // Ignore raw fallback error
            }
        }

        throw new Error(`Forge Exhausted: ${failureSummary.join(' | ')}`);
    },

    async generateDeckSuggestions(apiKey, payloadData, helper = null) {
        if (!apiKey) throw new Error("API Key is missing.");

        const { playstyle, targetRole } = payloadData;
        const helperName = helper?.name || 'Expert MTG Deck Builder';
        const helperPersonality = helper?.personality ? `Adopt the persona of ${helperName}: ${helper.personality}` : '';

        let playstyleContext = "";
        if (playstyle) {
            playstyleContext = `
                User Playstyle: ${playstyle.archetypes?.join(', ') || 'N/A'}. 
                Summary: ${playstyle.summary || 'N/A'}.
            `;
        }

        const systemMessage = `
            You are ${helperName}. ${helperPersonality}
            Analyze candidates for a ${targetRole || 'general'} role in the deck.
            ${playstyleContext}
            
            **Mana Curve Priorities (Bell Curve):**
            Focus on CMC 1-2 for high volume, 3-4 for moderate, 5+ for finishers.
            
            **Basic Land Split Logic:**
            If targetRole is 'Lands', and you cannot fill the required count with provided candidates, suggest a 'Basic Land Split' at the END of the suggestions array.
        `;

        const PREFERRED_MODELS = [
            'gemini-2.0-flash',
            'gemini-flash-latest',
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash-001',
            'gemini-1.5-flash-002',
            'gemini-1.5-pro',
            'gemini-1.5-pro-latest'
        ];

        const systemInstruction = {
            role: 'system',
            parts: [{ text: systemMessage }]
        };

        const contents = [{
            role: 'user',
            parts: [{ text: `Task: ${payloadData.instructions}\n\nCandidates: ${JSON.stringify(payloadData.candidates)}\n\nIMPORTANT: You MUST respond with a VALID JSON object containing a "suggestions" array. Each suggestion needs "rating" (1-10) and "reason" (string).` }]
        }];

        let failureSummary = [];

        for (const model of PREFERRED_MODELS) {
            // Tier 1: With Response Schema (Strict)
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: systemInstruction,
                        contents,
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: "OBJECT",
                                properties: {
                                    "suggestions": {
                                        type: "ARRAY",
                                        items: {
                                            type: "OBJECT",
                                            properties: {
                                                "firestoreId": { "type": "STRING" },
                                                "name": { "type": "STRING" },
                                                "count": { "type": "NUMBER" },
                                                "rating": { "type": "NUMBER" },
                                                "reason": { "type": "STRING" },
                                                "isBasicLand": { "type": "BOOLEAN" }
                                            },
                                            required: ["rating", "reason"]
                                        }
                                    }
                                },
                                required: ["suggestions"]
                            }
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return JSON.parse(text);
                } else {
                    const err = await response.json();
                    failureSummary.push(`${model} (Schema): ${response.status} ${err.error?.message || ''}`);
                    if (response.status === 404 || response.status === 429) continue;
                }
            } catch (e) {
                failureSummary.push(`${model} (Schema Error): ${e.message}`);
            }

            // Tier 2: Raw JSON Fallback (No Schema)
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: systemInstruction,
                        contents: [{
                            role: 'user',
                            parts: [{ text: `${contents[0].parts[0].text}\n\nYou MUST respond with VALID RAW JSON format ONLY. Do not use markdown blocks.` }]
                        }]
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                        return JSON.parse(cleanJson);
                    }
                } else {
                    const err = await response.json();
                    failureSummary.push(`${model} (Raw): ${response.status} ${err.error?.message || ''}`);
                }
            } catch (e) {
                failureSummary.push(`${model} (Raw Error): ${e.message}`);
            }
        }

        console.error("[Gemini] All models failed. Summary:", failureSummary);
        throw new Error(`Oracle Exhausted: ${failureSummary.join(' | ')}`);
    },

    async analyzeDeck(apiKey, deckList, commanderName, helper = null) {
        if (!apiKey) throw new Error("API Key is missing.");

        const helperName = helper?.name || 'The Deck Doctor';
        const helperPersonality = helper?.personality ? `Adopt the persona of ${helperName}: ${helper.personality}` : 'Personality: Clinical, precise, but encouraging.';

        const deckContext = deckList.map(c => `- ${c.countInDeck || 1}x ${c.name} (${c.type_line})`).join('\n') +
            `\n\nTotal Lands: ${deckList.reduce((acc, c) => (c.type_line?.toLowerCase().includes('land') ? acc + (c.countInDeck || 1) : acc), 0)}`;

        const systemMessage = `
            You are ${helperName}, an expert Magic: The Gathering deck consultant.
            ${helperPersonality}
            Your goal is to Grade a deck on a scale of 0-100 and identify critical flaws.
        `;

        const userPrompt = `
            Analyze this Commander deck for "${commanderName}":
            
            ${deckContext}

            **Rubric:**
            - **Synergy**: Do cards support the commander?
            - **Speed**: Is there enough ramp? Is the curve too high?
            - **Interaction**: Is there enough removal/protection?
            - **Consistency**: Is there enough card draw/tutors?

            **Task:**
            1. Calculate a Score (0-100).
            2. Rate Synergy, Speed, Interaction (0-100).
            3. List 3-5 critical "Issues" (strings).
            4. Propose up to 5 specific "Changes". For each change:
                - "remove": Exact card name to cut.
                - "add": Exact card name to add.
                - "reason": Why?

            **Response Format (VALID JSON ONLY):**
            {
                "score": 85,
                "metrics": { "synergy": 80, "speed": 70, "interaction": 60 },
                "issues": ["Not enough lands (32)", "Lack of board wipes"],
                "changes": [
                    { "remove": "Bad Card", "add": "Good Card", "reason": "Strict upgrade for mana cost." }
                ]
            }
        `;

        const contents = [
            { role: 'user', parts: [{ text: systemMessage }] },
            { role: 'user', parts: [{ text: userPrompt }] }
        ];

        const PREFERRED_MODELS = [
            'gemini-2.0-flash',
            'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-1.5-flash'
        ];

        for (const model of PREFERRED_MODELS) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: { responseMimeType: "application/json" }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return JSON.parse(text);
                }
            } catch (e) {
                console.warn(`Deck Doctor (${model}) failed:`, e);
            }
        }
        throw new Error("Deck Doctor failed to diagnose.");
    },
    async generateReleaseNotes(apiKey, tickets) {
        if (!apiKey) throw new Error("API Key is missing.");
        if (!tickets || tickets.length === 0) throw new Error("No tickets provided for release notes.");

        const ticketsContext = tickets.map(t => {
            const submitter = t.type === 'bug' && t.created_by_username ? ` [Submitted by: ${t.created_by_username}]` : '';
            return `- [${t.type.toUpperCase()}] [Status: ${t.status}] ${t.title}${t.epic_title ? ` (Project: ${t.epic_title})` : ''}${submitter}: ${t.description?.replace(/<[^>]*>?/gm, '').substring(0, 200)}...`;
        }).join('\n');

        const prompt = `
            You are a professional software release manager and technical writer for "MTG-Forge". 
            Generate a Development Update in HTML using Tailwind CSS. 
            Strictly follow the structure and styling below.

            **TICKETS DATA:**
            ${ticketsContext}

            **STRICT LAYOUT RULES:**
            1. **Title**: A large, bold title like "MTG-Forge Development Update! 🛠️".
            2. **Intro**: A warm greeting for "Planeswalkers" with a globe emoji 🌍.
            3. **Sections**: Group items into:
               - "🚀 New Features" (Completed features)
               - "🐛 Bug Fixes" (Completed bugs)
               - "🚧 In Progress" (Everything else)
            4. **Section Cards**: Each section should have ONE large card containing its list of items.
               - Card Style: <div class="bg-gray-800/40 border-l-4 p-4 rounded-lg mb-6 ...">
               - Border Colors: green-500 for Features, red-500 for Bugs, gray-500 for In Progress.
            5. **Feature/Bug items**: Use <strong> for titles. For bugs, include a subtle "@username" shoutout for the report.
            6. **Highlights**: Use <span class="text-indigo-400 font-bold"> for important keywords or project names.
            7. **Sign-off**: A final warm closing message to Planeswalkers, ending with "see you in the next patch! ⚔️".

            **TECHNICAL CONSTRAINTS:**
            - Use only Tailwind CSS classes.
            - Do NOT use markdown code blocks (\`\`\`html).
            - Output ONLY the clean HTML string.
        `;

        try {
            const response = await this.sendMessage(apiKey, [], prompt);
            let clean = response.trim();
            if (clean.startsWith('```html')) clean = clean.replace('```html', '').replace('```', '');
            else if (clean.startsWith('```')) clean = clean.replace('```', '').replace('```', '');
            return clean.trim();
        } catch (error) {
            console.error("AI Release Notes Error:", error);
            throw new Error("Failed to generate release notes.");
        }
    }
};
