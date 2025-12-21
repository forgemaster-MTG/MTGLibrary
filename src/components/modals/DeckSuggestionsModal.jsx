import React, { useState, useEffect } from 'react';
import { GeminiService } from '../../services/gemini';
import { useAuth } from '../../contexts/AuthContext';

const DeckSuggestionsModal = ({ isOpen, onClose, deck, cards }) => {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);

    // Load existing analysis if saved? For now, we generate fresh or rely on parent state.
    // If we want to persist, we'd need to save to DB.

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            if (!apiKey) throw new Error("API Key missing. Please check Settings.");

            const cardList = cards.map(c => `${c.countInDeck || 1}x ${c.name} (${c.type_line})`).join('\n');

            const prompt = `
You are an expert MTG deck builder. Analyze this Commander deck:
Name: ${deck.name}
Commander: ${deck.commander ? deck.commander.name : 'Unknown'}
Cards:
${cardList}

Provide a strategic analysis in HTML format (using Tailwind CSS for styling):
1. **Power Level Assessment** (1-10) with brief reasoning.
2. **Key Archetypes/Themes** identified.
3. **Win Conditions** detected.
4. **Weaknesses/Gaps** (e.g., low draw, bad curve).
5. **Suggested Additions** (3-5 cards with reasons).
6. **Suggested Cuts** (3-5 cards with reasons).

Format rules:
- Use <h3> for section headers (text-indigo-300 font-bold mb-2 uppercase text-sm tracking-wider).
- Use <ul class="list-disc pl-5 space-y-1 text-gray-300"> for lists.
- Highlight card names in <span class="text-indigo-400 font-bold">.
- Keep it concise but helpful.
`.trim();

            const response = await GeminiService.sendMessage(apiKey, [], prompt);
            setAnalysis(response);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-gray-900/50 rounded-t-xl">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Deck Strategy & Analysis</span>
                        {deck.name && <span className="text-sm font-normal text-gray-400 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">{deck.name}</span>}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-900/30">

                    {!analysis && !loading && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                            <div className="bg-indigo-500/10 p-6 rounded-full">
                                <svg className="w-16 h-16 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            </div>
                            <div className="max-w-md">
                                <h3 className="text-xl font-bold text-white mb-2">Ready to Analyze</h3>
                                <p className="text-gray-400 mb-6">Our AI will review your deck list, check your mana curve, and suggest optimal cards to improve your strategy.</p>
                                <button
                                    onClick={handleAnalyze}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-1"
                                >
                                    Generate Analysis
                                </button>
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                            <p className="text-purple-300 animate-pulse">Consulting the Oracle...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl text-center">
                            <h3 className="text-red-400 font-bold mb-2">Analysis Failed</h3>
                            <p className="text-red-200">{error}</p>
                            <button onClick={handleAnalyze} className="mt-4 text-sm text-red-300 hover:text-white underline">Try Again</button>
                        </div>
                    )}

                    {analysis && (
                        <div className="animate-fade-in space-y-6">
                            <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-indigo-300">
                                <div dangerouslySetInnerHTML={{ __html: analysis }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 bg-gray-800 rounded-b-xl flex justify-between items-center">
                    <span className="text-xs text-gray-500">Powered by Gemini 1.5 Flash</span>
                    <div className="flex gap-3">
                        {analysis && (
                            <button onClick={handleAnalyze} className="text-gray-400 hover:text-white text-sm font-medium px-3 py-2 rounded hover:bg-gray-700 transition-colors">
                                Regenerate
                            </button>
                        )}
                        <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-lg font-medium transition-colors">
                            Close
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DeckSuggestionsModal;
