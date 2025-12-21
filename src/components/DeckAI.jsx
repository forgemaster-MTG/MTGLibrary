import React, { useState } from 'react';
import { GeminiService } from '../services/gemini';
import { useAuth } from '../contexts/AuthContext';

const DeckAI = ({ deck, cards }) => {
    const { userProfile } = useAuth();
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            if (!apiKey) throw new Error("Please add your Gemini API Key in Settings first.");

            const cardList = cards.map(c => `${c.countInDeck || 1}x ${c.name}`).join('\n');
            const prompt = `
Analyze this Magic: The Gathering deck:
Commander: ${deck.commander ? deck.commander.name : 'None'}
Format: ${deck.format || 'Commander'}
Cards:
${cardList}

Please provide:
1. Power Level Estimate (1-10)
2. key Strengths & Weaknesses
3. 3-5 Card Suggestions to Add (with reasons)
4. 3-5 Card Suggestions to Cut (with reasons)
            `.trim();

            const history = []; // No history for single analysis, or maybe keep it if we want chat?
            // For now, single shot.
            const response = await GeminiService.sendMessage(apiKey, history, prompt);
            setAnalysis(response);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        AI Deck Analysis
                    </span>
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded border border-gray-600">Beta</span>
                </h2>
                <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            {analysis ? 'Re-Analyze Deck' : 'Generate Analysis'}
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
                    {error} <br />
                    {!userProfile?.settings?.geminiApiKey && <a href="/settings" className="underline font-bold">Go to Settings</a>}
                </div>
            )}

            {analysis && (
                <div className="prose prose-invert max-w-none animate-fade-in">
                    <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700">
                        <div dangerouslySetInnerHTML={{ __html: analysis }} />
                    </div>
                </div>
            )}

            {!analysis && !loading && !error && (
                <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    <p className="text-lg">Click generic analysis to get insights on your deck stats, power level, and suggested improvements.</p>
                </div>
            )}
        </div>
    );
};

export default DeckAI;
