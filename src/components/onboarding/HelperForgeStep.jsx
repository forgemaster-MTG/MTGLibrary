import React, { useState, useEffect, useRef } from 'react';
import { GeminiService } from '../../services/gemini';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getTierConfig } from '../../config/tiers';

const MAX_TURNS = 15;

export const HelperForgeStep = ({ onNext, onBack }) => {
    const { userProfile, updateSettings } = useAuth();
    const [mode, setMode] = useState('selection'); // selection, forge, synthesis, complete
    const [helperDraft, setHelperDraft] = useState({ name: '', type: '', personality: '' });

    // Chat State
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Default Oracle Config
    const ORACLE_DEFAULT = {
        name: "Oracle",
        type: "Mystic Construct",
        personality: "Wise, Efficient, Slightly Mystical"
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    const handleSelectDefault = () => {
        onNext(ORACLE_DEFAULT);
    };

    const startForge = async () => {
        setMode('forge');
        setIsLoading(true);
        const greeting = "Booting Forge System... I am the construct builder. Let's create your companion. First, does your helper have a name, or shall we define their personality first?";
        setChatHistory([{ role: 'model', content: greeting }]);
        setIsLoading(false);
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const userMsg = { role: 'user', content: chatInput };
        const newHistory = [...chatHistory, userMsg];
        setChatHistory(newHistory);
        setChatInput("");
        setIsLoading(true);

        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            // if (!apiKey) throw new Error("API Key missing."); // REMOVED: Let Service handle fallback

            const result = await GeminiService.forgeHelperChat(apiKey, newHistory, helperDraft, userProfile);

            setHelperDraft(prev => ({ ...prev, ...result.updatedDraft }));
            setChatHistory(prev => [...prev, { role: 'model', content: result.aiResponse }]);

        } catch (err) {
            console.error("Forge Error:", err);
            let errorMessage = "System Glitch. Please repeat.";

            if (err.message.includes("Leaked") || err.message.includes("Exhausted") || err.message.includes("429")) {
                errorMessage = "⚠️ ORACLE DISCONNECTED: The shared connection is exhausted or blocked. Please enter a custom Gemini API Key below to continue.";
            } else if (err.message.includes("403")) {
                errorMessage = "⚠️ ACCESS DENIED: The current key does not have permission. Please verify your API Key.";
            }

            setChatHistory(prev => [...prev, { role: 'model', content: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinishForge = () => {
        // Fallback checks
        const finalProfile = {
            name: helperDraft.name || "Companion",
            type: helperDraft.type || "Construct",
            personality: helperDraft.personality || "Helpful"
        };
        onNext(finalProfile);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="w-full max-w-5xl animate-fade-in mx-auto">
            {mode === 'selection' && (
                <div className="text-center space-y-8">
                    <div className="w-24 h-24 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center ring-1 ring-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                        <svg className="w-12 h-12 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </div>

                    <div>
                        <h2 className="text-3xl font-bold text-white mb-4">Forge Your Helper</h2>
                        <p className="text-gray-300 max-w-2xl mx-auto">
                            Who will guide you through the multiverse? You can use our standard "Oracle" construct, or forge a completely custom AI companion with its own name and personality.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="col-span-1 md:col-span-2 mx-auto text-gray-500 hover:text-white mb-2 underline"
                            >
                                ← Go Back
                            </button>
                        )}
                        <button
                            onClick={handleSelectDefault}
                            className="p-6 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-500 rounded-xl transition-all group text-left"
                        >
                            <div className="text-xl font-bold text-white mb-2 group-hover:text-amber-400">Default: The Oracle</div>
                            <p className="text-gray-400 text-sm mb-4">A wise, mystical construct focused on efficient and accurate advice.</p>
                            <span className="text-xs font-bold uppercase text-gray-500 group-hover:text-white tracking-wider">Select Oracle →</span>
                        </button>

                        <button
                            onClick={() => {
                                // ENABLED FOR ONBOARDING TRIAL
                                // const allowed = getTierConfig(userProfile?.subscription_tier).features.customAiPersona;
                                // if (!allowed) return;
                                startForge();
                            }}
                            // disabled={!getTierConfig(userProfile?.subscription_tier).features.customAiPersona}
                            className={`p-6 border rounded-xl transition-all group text-left relative overflow-hidden bg-amber-900/20 hover:bg-amber-900/30 border-amber-500/30 hover:border-amber-500 cursor-pointer`}
                        >
                            <div className={`absolute top-0 right-0 p-2 opacity-50`}>
                                <svg className={`w-16 h-16 text-amber-500`} fill="currentColor" viewBox="0 0 24 24"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                            </div>
                            <div className="relative z-10">
                                <div className={`text-xl font-bold mb-2 text-white group-hover:text-amber-400`}>
                                    Forge Custom Helper
                                </div>
                                <p className="text-gray-400 text-sm mb-4">Create a unique companion. Define their name, species, and personality via chat.</p>
                                <span className={`text-xs font-bold uppercase tracking-wider text-green-400 group-hover:text-white block`}>
                                    Included in Trial
                                </span>
                                <span className="text-[10px] text-gray-500 mt-1 block group-hover:text-gray-300">
                                    Retained with Magician tier or higher.
                                </span>
                            </div>
                        </button>
                    </div>

                    {/* Optional API Key Input - REMOVED PER NEW SUBSCRIPTION MODEL */}

                </div>
            )}

            {mode === 'forge' && (
                <div className="flex flex-col md:flex-row h-[600px] border border-gray-700 rounded-2xl overflow-hidden bg-gray-900">
                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col border-r border-gray-800">
                        <div className="p-4 border-b border-gray-800 bg-gray-800/50 flex justify-between items-center">
                            <span className="font-mono text-amber-400 text-sm">SYSTEM: FORGE PROTOCOL ENGAGED</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="text-gray-500 text-xs animate-pulse ml-2"> Processing...</div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 border-t border-gray-800 bg-gray-900">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Ex: Name him 'Gobbo', make him a goblin..."
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-amber-500 focus:outline-none"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isLoading || !chatInput.trim()}
                                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-bold"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Live Draft Panel */}
                    <div className="w-full md:w-80 bg-gray-950 p-6 flex flex-col">
                        <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-6">Blueprint Status</h3>

                        <div className="space-y-6 flex-1">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">DESIGNATION (NAME)</label>
                                <div className={`text-lg font-bold ${helperDraft.name ? 'text-amber-400' : 'text-gray-700 italic'}`}>
                                    {helperDraft.name || "Undefined"}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">CLASSIFICATION (TYPE)</label>
                                <div className={`text-sm font-medium ${helperDraft.type ? 'text-white' : 'text-gray-700 italic'}`}>
                                    {helperDraft.type || "Undefined"}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">PARAMETERS (PERSONALITY)</label>
                                <div className={`text-sm font-medium ${helperDraft.personality ? 'text-white' : 'text-gray-700 italic'}`}>
                                    {helperDraft.personality || "Undefined"}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleFinishForge}
                            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg hover:shadow-green-500/20 transition-all mt-4"
                        >
                            Complete Forge Protocol
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
