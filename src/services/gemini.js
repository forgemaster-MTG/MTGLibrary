export const GeminiService = {
    async sendMessage(apiKey, history, message, context = '') {
        if (!apiKey) throw new Error("API Key is missing. Please add it in Settings.");

        const SYSTEM_PROMPT = `
You are MTG Forge, an elite Magic: The Gathering AI assistant.
Your goal is to provide accurate, strategic, and engaging advice to players.

**Persona & Style:**
- Knowledgeable, friendly, and concise.
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

        // Convert history to Gemini format
        // History format: [{ role: 'user'|'model', parts: [{ text: ... }] }]
        const contents = [
            { role: 'user', parts: [{ text: SYSTEM_PROMPT }] }, // Prime the system prompt as first user message? Or use system_instruction if available. Gemini 1.5 supports system_instruction.
            // For simple 'gemini-pro' (1.0), we often just prepend to first message or history.
            // Let's assume standard chat structure.
            ...history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            { role: 'user', parts: [{ text: message }] }
        ];

        const MODEL_NAME = 'gemini-2.5-flash';

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            });

            if (!response.ok) {
                const err = await response.json();

                // Debug: List models if "not found"
                if (response.status === 404 || err.error?.message?.includes('not found')) {
                    console.warn('Model not found. Fetching available models...');
                    try {
                        const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                        const modelsData = await modelsRes.json();
                        console.table(modelsData.models?.map(m => ({ name: m.name, methods: m.supportedGenerationMethods })));
                    } catch (e) {
                        console.error('Failed to list models:', e);
                    }
                }

                throw new Error(err.error?.message || `Gemini API Error: ${response.statusText}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            return text || "I couldn't generate a response.";

        } catch (error) {
            console.error("Gemini Request Failed:", error);
            throw error;
        }
    },

    async getDeckStrategy(apiKey, commanderName) {
        if (!apiKey) throw new Error("API Key is missing.");

        const prompt = `
            Act as a Magic: The Gathering expert. I have chosen "${commanderName}" as my Commander.
            Suggest a competitive yet fun deck strategy strings and a recommended numeric breakdown of card types.
            
            You MUST respond with VALID JSON strictly matching this format:
            {
                "suggestedName": "Atraxa's Toxic Embrace",
                "theme": "Board Wipe Tribal",
                "strategy": "Control the board with repeated wipes until you can reanimate a massive threat.",
                "layout": {
                    "Lands": 36,
                    "Creatures": 20,
                    "Instants": 15,
                    "Sorceries": 15,
                    "Artifacts": 10,
                    "Enchantments": 3,
                    "Planeswalkers": 1
                }
            }
            Do NOT use markdown code blocks. Return only the JSON string.
        `;

        try {
            const response = await this.sendMessage(apiKey, [], prompt);
            // Clean markdown if present
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
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
            // Using sendMessage allows us to reuse the fetch logic, but we need to ensure JSON output.
            // prompting for JSON specifically.
            const response = await this.sendMessage(apiKey, [], prompt);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("Gemini Question Error:", error);
            throw error; // Rethrow to let UI handle it
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
    }
};
