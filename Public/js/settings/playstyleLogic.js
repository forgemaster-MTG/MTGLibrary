/**
 * playstyleLogic.js
 * 
 * Contains the core business logic for the Playstyle feature.
 * Responsible for:
 * 1. Generating dynamic questions via Gemini API.
 * 2. Synthesizing the final Playstyle Profile from user answers.
 * 3. Managing data persistence (Load/Save/Clear) for playstyle data.
 * 4. Providing helper functions to inject playstyle context into other AI prompts.
 */

import { db, appId } from '../main/index.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { showToast } from '../lib/ui.js';

// Shared state object holding the current profile and answers
export let playstyleState = {
    summary: null,
    answers: []
};

// --- Core Gemini API Call Helper ---
async function callGeminiWithRetry(payload, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const url = (typeof window.getGeminiUrl === 'function') ? await window.getGeminiUrl() : null;
            if (!url) {
                console.error('[playstyle] Gemini API Key is not defined (per-user key missing).');
                try { if (typeof window.renderGeminiSettings === 'function') window.renderGeminiSettings(); } catch (e) { }
                try { if (typeof window.showView === 'function') window.showView('settings'); } catch (e) { }
                return null;
            }
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                throw new Error(`Gemini API error: ${resp.status}`);
            }

            const data = await resp.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error("Invalid or empty response from Gemini.");
            }
            return JSON.parse(text);
        } catch (err) {
            console.error(`Gemini call attempt ${i + 1} failed:`, err);
            if (i === retries - 1) {
                return null;
            }
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
    return null;
}

// --- Logic Functions ---

/**
 * Generates the next question for the wizard using Gemini.
 * Uses the history of previous answers to tailor the next question.
 * 
 * @param {Array} priorAnswers - List of {question, answer} objects.
 * @returns {Object} - { question: string, choices: string[] }
 */
export async function askNextQuestion(priorAnswers) {
    const systemInstruction = `You are an expert survey designer for Magic: The Gathering (MTG) players. Your goal is to create the most informative question to understand a user's playstyle based on their previous answers. Questions should be clear and concise, with 3-5 distinct multiple-choice answers. Avoid repeating questions. Focus on different aspects of MTG playstyles, such as deck preferences, game strategies, social interaction styles, and risk tolerance.`;

    let userPrompt;
    if (priorAnswers.length === 0) {
        userPrompt = "Generate the very first question for an MTG playstyle questionnaire. This question should gauge the player's overall experience with the game, as this will help tailor subsequent questions.";
    }
    else if (priorAnswers.length === 1) {
        userPrompt = "Generate the second question for an MTG playstyle questionnaire. This question should build on the player's overall experience and delve into their specific preferences.";
    }
    else if (priorAnswers.length === 2) {
        userPrompt = "Generate the third question for an MTG playstyle questionnaire. This question should explore the player's fantasy or thematic preferences in deck building.";
    } else {
        const previousAnswersText = priorAnswers.map(a => `- ${a.question}: ${a.answer}`).join('\n');
        userPrompt = `Based on the user's previous answers, generate the next single best question to further refine their playstyle profile. Do not repeat questions.\n\nPrevious Answers:\n${previousAnswersText}`;
    }

    const payload = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING", description: "The next question to ask the user." },
                    choices: {
                        type: "ARRAY",
                        description: "An array of 3-5 concise answer choices.",
                        items: { type: "STRING" }
                    }
                },
                required: ["question", "choices"]
            }
        }
    };

    const result = await callGeminiWithRetry(payload);

    if (result) {
        return result;
    } else {
        console.warn('askNextQuestion failed, falling back to static question');
        return { question: 'Which of these classic archetypes appeals to you most?', choices: ['Aggro (fast creatures)', 'Control (spells and answers)', 'Combo (synergistic engine)', 'Midrange (value and efficiency)'] };
    }
}

/**
 * Synthesizes a structured Playstyle Profile from the collected answers.
 * Requests a JSON object from Gemini containing:
 * - Summary text
 * - Tags (e.g., "Combo", "Spike")
 * - Numeric scores (Aggression, Consistency, etc.)
 * - Suggested archetypes
 * 
 * @param {Array} answers - The full list of user answers.
 * @returns {Object|null} - The synthesized profile object or null on error.
 */
export async function synthesizeStructuredPlaystyle(answers) {
    const uid = window.userId || null;
    const systemInstruction = `You are an expert MTG coach and psychographic analyst. Your task is to analyze a player's answers and synthesize a detailed playstyle profile. The summary should be a concise paragraph that can inform other AI agents about the user's preferences. Scores must be between 0 and 100.`;

    const userPrompt = `Analyze the following questionnaire answers and generate a detailed playstyle profile in the specified JSON format.\n\n${answers.map(a => `- ${a.question} -> ${a.answer}`).join('\n')}`;

    const payload = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    summary: {
                        type: "STRING",
                        description: "A plain-text summary of the user's playstyle for other AI agents."
                    },
                    tags: {
                        type: "ARRAY",
                        description: "Short tags (e.g., 'Ramp', 'Political', 'Combo', 'Stax').",
                        items: { type: "STRING" }
                    },
                    scores: {
                        type: "OBJECT",
                        description: "Numeric 0-100 scores for different playstyle axes.",
                        properties: {
                            aggression: { type: "NUMBER" },
                            consistency: { type: "NUMBER" },
                            interaction: { type: "NUMBER" },
                            variance: { type: "NUMBER" },
                            comboAffinity: { type: "NUMBER" }
                        },
                        required: ["aggression", "consistency", "interaction", "variance", "comboAffinity"]
                    },
                    archetypes: {
                        type: "ARRAY",
                        description: "Suggested MTG archetype labels (e.g., 'Izzet Spellslinger', 'Golgari Midrange').",
                        items: { type: "STRING" }
                    }
                },
                required: ["summary", "tags", "scores", "archetypes"]
            }
        }
    };

    showToast('Generating playstyle profile...', 'info');
    const parsed = await callGeminiWithRetry(payload);

    if (parsed) {
        parsed.rawAnswers = answers;
        playstyleState = parsed;
        window.playstyleSummary = parsed.summary || null;
        if (uid) await savePlaystyleForUser(uid, playstyleState);
        showToast('Playstyle profile saved.', 'success');
        // Note: We cannot call renderPlaystyleWidget here directly to avoid circular dep.
        // Instead, we rely on the caller or a listener to update the UI.
        // However, for backward compatibility, we can try to dispatch an event or check for the global function.
        if (typeof window.renderPlaystyleWidget === 'function') window.renderPlaystyleWidget();
        return parsed;
    } else {
        console.error('Error synthesizing structured playstyle');
        showToast('Failed to synthesize playstyle profile.', 'error');
        return null;
    }
}

// Data persistence functions (moved here to keep logic together)
export async function loadPlaystyleForUser(userId) {
    if (!userId) return null;
    try {
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
        const snap = await getDoc(userDocRef);
        const settings = snap.exists() ? (snap.data().settings || {}) : {};
        const ps = settings.playstyle || null;
        playstyleState = ps || { summary: null, answers: [] };
        window.playstyleSummary = playstyleState.summary || null;
        if (typeof window.renderPlaystyleWidget === 'function') window.renderPlaystyleWidget();
        return playstyleState;
    } catch (err) {
        console.error('Error loading playstyle for user', err);
        return null;
    }
}

export async function savePlaystyleForUser(userId, playstyleObj) {
    if (!userId) return false;
    try {
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
        const snap = await getDoc(userDocRef);
        const currentSettings = snap.exists() ? snap.data().settings || {} : {};
        const newSettings = { ...currentSettings, playstyle: playstyleObj };
        await setDoc(userDocRef, { settings: newSettings }, { merge: true });

        playstyleState = playstyleObj;
        window.playstyleSummary = playstyleState.summary || null;
        if (typeof window.renderPlaystyleWidget === 'function') window.renderPlaystyleWidget();
        return true;
    } catch (err) {
        console.error('Error saving playstyle for user', err);
        return false;
    }
}

export async function clearPlaystyleForUser(userId) {
    if (!userId) return false;
    try {
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
        const snap = await getDoc(userDocRef);
        const currentSettings = snap.exists() ? snap.data().settings || {} : {};
        currentSettings.playstyle = null;
        await setDoc(userDocRef, { settings: currentSettings }, { merge: true });

        playstyleState = { summary: null, answers: [] };
        window.playstyleSummary = null;
        if (typeof window.renderPlaystyleWidget === 'function') window.renderPlaystyleWidget();
        return true;
    } catch (err) {
        console.error('Error clearing playstyle for user', err);
        return false;
    }
}

export function attachPlaystyleToPrompt(prompt) {
    const summary = playstyleState.summary || window.playstyleSummary || null;
    if (!summary) return prompt;
    return `${prompt}\n\nFor context, here is the user's MTG Playstyle Summary:\n${summary}\n`;
}
