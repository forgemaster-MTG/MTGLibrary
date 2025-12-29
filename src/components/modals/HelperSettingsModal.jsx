import React, { useState } from 'react';
import { GeminiService } from '../../services/gemini';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
// Note: Assuming api.updateUser exists and works as in SettingsPage

const HelperSettingsModal = ({ isOpen, onClose }) => {
    const { userProfile, refreshUserProfile } = useAuth();
    const [isForging, setIsForging] = useState(false);

    // Edit Form State (Manual)
    const [name, setName] = useState(userProfile?.settings?.helper?.name || '');
    const [type, setType] = useState(userProfile?.settings?.helper?.type || '');
    const [personality, setPersonality] = useState(userProfile?.settings?.helper?.personality || '');
    const [saving, setSaving] = useState(false);

    // Chat Forge State
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [draftHelper, setDraftHelper] = useState({}); // { name, type, personality }

    // Init state on open
    React.useEffect(() => {
        if (isOpen) {
            const h = userProfile?.settings?.helper || {};
            setName(h.name || '');
            setType(h.type || '');
            setPersonality(h.personality || '');
            setIsForging(false);
            setChatHistory([]);
            setDraftHelper({});
        }
    }, [isOpen, userProfile]);

    const handleSaveManual = async () => {
        setSaving(true);
        try {
            const currentSettings = userProfile?.settings || {};
            const newSettings = {
                ...currentSettings,
                helper: { name, type, personality }
            };
            await api.updateUser(userProfile.id, { settings: newSettings });
            await refreshUserProfile();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to save helper.");
        } finally {
            setSaving(false);
        }
    };

    const startForge = async () => {
        setIsForging(true);
        setChatLoading(true);
        setDraftHelper({});
        setChatHistory([]);

        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            if (!apiKey) throw new Error("API Key missing");

            // Initial kickoff
            const result = await GeminiService.forgeHelperChat(apiKey, [], {});
            setChatHistory([{ role: 'model', content: result.aiResponse }]);
        } catch (err) {
            console.error(err);
            setChatHistory([{ role: 'model', content: "Error connecting to the Forge. Please try again." }]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleForgeSend = async () => {
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
        setChatLoading(true);

        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            const history = chatHistory.map(m => ({ role: m.role, content: m.content }));
            history.push({ role: 'user', content: userMsg }); // Add current

            const result = await GeminiService.forgeHelperChat(apiKey, history, draftHelper);

            setDraftHelper(result.updatedDraft || {});
            setChatHistory(prev => [...prev, { role: 'model', content: result.aiResponse }]);

        } catch (err) {
            console.error(err);
            setChatHistory(prev => [...prev, { role: 'model', content: "Reviewing the blueprints... (Error, try again)" }]);
        } finally {
            setChatLoading(false);
        }
    };

    const applyForge = () => {
        if (draftHelper.name) setName(draftHelper.name);
        if (draftHelper.type) setType(draftHelper.type);
        if (draftHelper.personality) setPersonality(draftHelper.personality);
        setIsForging(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-500">
                            Helper Settings
                        </span>
                        <span className="text-xs bg-gray-800 text-gray-500 px-2 py-1 rounded border border-gray-700">Beta</span>
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {!isForging ? (
                        <div className="space-y-6">
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex gap-4 items-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-700 rounded-full flex items-center justify-center text-2xl shadow-lg">
                                    🤖
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{name || 'Unknown Helper'}</h3>
                                    <p className="text-emerald-400 text-sm font-medium">{type || 'Generic Construct'}</p>
                                    <p className="text-gray-400 text-sm italic mt-1">"{personality || 'Standard protocol.'}"</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={name} onChange={e => setName(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                                        <input
                                            type="text"
                                            value={type} onChange={e => setType(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Personality</label>
                                        <input
                                            type="text"
                                            value={personality} onChange={e => setPersonality(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4 border-t border-gray-800">
                                <button
                                    onClick={startForge}
                                    className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-2 px-4 py-2 hover:bg-emerald-900/20 rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                    Re-Forge Persona
                                </button>
                                <button
                                    onClick={handleSaveManual}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Forge Chat UI */}
                            <div className="bg-gray-800/30 p-4 rounded-lg mb-4 text-sm text-gray-400 flex justify-between items-center">
                                <span>Forging new identity...</span>
                                <button onClick={() => setIsForging(false)} className="text-white hover:underline">Cancel</button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2 bg-gray-950/30 rounded-lg border border-gray-800">
                                {chatHistory.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="flex justify-start"><span className="animate-pulse text-emerald-500">...</span></div>
                                )}
                            </div>

                            {/* Live Draft Preview */}
                            {(draftHelper.name || draftHelper.type) && (
                                <div className="bg-black/40 p-3 rounded border border-emerald-500/30 mb-4 flex gap-4 text-xs">
                                    <div><span className="text-gray-500">Name:</span> <span className="text-white">{draftHelper.name || '-'}</span></div>
                                    <div><span className="text-gray-500">Type:</span> <span className="text-white">{draftHelper.type || '-'}</span></div>
                                    <div><span className="text-gray-500">Personality:</span> <span className="text-white">{draftHelper.personality || '-'}</span></div>
                                    <button onClick={applyForge} className="ml-auto bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-500">Apply This</button>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleForgeSend()}
                                    placeholder="Describe your helper..."
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 outline-none"
                                />
                                <button onClick={handleForgeSend} disabled={chatLoading} className="bg-emerald-600 p-2 rounded-lg text-white">
                                    ➜
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HelperSettingsModal;
