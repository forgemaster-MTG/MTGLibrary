import fetch from 'node-fetch';
import 'dotenv/config';

const API_KEY = process.env.VITE_AI_SDK_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

async function listModels() {
    console.log("Fetching models...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.models) {
            const imagenModels = data.models.filter(m => m.name.includes('imagen') || m.name.includes('image'));
            console.log("Found Image Models:");
            console.log(JSON.stringify(imagenModels, null, 2));

            console.log("All Models ending in 'generateContent':");
            const generateModels = data.models.filter(m => m.supportedGenerationMethods?.includes('generateContent'));
            console.log(generateModels.map(m => m.name).join(', '));
        } else {
            console.log("No models array returned:", data);
        }

    } catch (e) {
        console.error("Fetch failed", e);
    }
}

listModels();
