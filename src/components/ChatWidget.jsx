import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GeminiService } from '../services/gemini';
import HelperSettingsModal from './modals/HelperSettingsModal';

const ChatWidget = () => {
    const { userProfile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isHelperModalOpen, setIsHelperModalOpen] = useState(false);
    const messagesEndRef = useRef(null);

    const helper = userProfile?.settings?.helper;
    const helperName = helper?.name || "MTG Forge";
    // Robust avatar resolution checking all common fields
    const helperAvatar = helper?.avatar_url || helper?.avatar || helper?.photo_url || null;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen, loading]);

    // Handle incoming custom events to toggle chat
    useEffect(() => {
        const handleToggleChat = () => setIsOpen(prev => !prev);
        window.addEventListener('toggle-chat', handleToggleChat);
        return () => window.removeEventListener('toggle-chat', handleToggleChat);
    }, []);

    // Trigger welcome message when chat is opened for the first time
    useEffect(() => {
        if (isOpen && messages.length === 0 && !loading) {
            handleWelcome();
        }
    }, [isOpen]);

    const handleWelcome = async () => {
        const apiKey = userProfile?.settings?.geminiApiKey;
        if (!apiKey) return;

        setLoading(true);
        try {
            // Send a hidden initialization prompt to get the persona to introduce themselves
            const result = await GeminiService.sendMessage(
                apiKey,
                [],
                "Introduce yourself and offer your services as my Magic: The Gathering deck-building companion.",
                "This is the very first message of the session.",
                helper || {},
                userProfile
            );

            setMessages([{ role: 'model', content: result.result }]);
        } catch (err) {
            console.error("Welcome message failed:", err);
            // Don't show an error message in the chat for the welcome fail, just leave it blank
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            if (!apiKey) throw new Error("Please add a Gemini API Key in Settings to chat.");

            // Get history for context
            const history = messages.map(m => ({ role: m.role, content: m.content }));

            // Use the standard personified sendMessage which is lighter and supports HTML
            const result = await GeminiService.sendMessage(
                apiKey,
                history,
                input,
                "", // Context
                helper || {},
                userProfile
            );

            setMessages(prev => [...prev, { role: 'model', content: result.result }]);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'model', content: `<div class="text-red-400 font-bold p-2 border border-red-500/30 rounded bg-red-950/20">Forge Connection Interrupted: ${err.message}</div>` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`fixed bottom-0 right-0 z-50 pointer-events-none transition-all duration-300 ${isExpanded ? 'w-full h-full p-0 flex flex-col' : isOpen ? 'w-full md:w-[450px] md:right-4 h-[600px] mb-4' : 'w-full h-full max-h-[100px] max-w-[100px] bg-transparent'}`}>
            {/* Overlay for expanded mode on mobile */}
            {isExpanded && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 pointer-events-auto" onClick={() => setIsExpanded(false)}></div>}

            {/* Toggle Button (when closed) */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="pointer-events-auto absolute bottom-4 right-4 w-14 h-14 bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center border-2 border-primary-400 group overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors"></div>
                    {helperAvatar ? (
                        <img src={helperAvatar} alt={helperName} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                        <svg className="w-8 h-8 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                    )}
                    <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className={`pointer-events-auto flex flex-col h-full bg-gray-800 border-t border-l border-gray-700 shadow-2xl overflow-hidden ${isExpanded ? 'w-full h-full' : 'rounded-tl-2xl md:rounded-tr-2xl md:border-r'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                {helperAvatar ? (
                                    <img src={helperAvatar} alt={helperName} className="w-10 h-10 rounded-full object-cover border-2 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-primary-500/50 flex items-center justify-center text-xl shadow-lg shadow-primary-500/10">🤖</div>
                                )}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-gray-900 shadow-sm"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 leading-tight">{helperName}</span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{helper?.type || 'AI Assistant'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Edit Persona Button */}
                            <button
                                onClick={() => setIsHelperModalOpen(true)}
                                className="text-gray-400 hover:text-white p-1 hover:bg-gray-800 rounded transition-colors"
                                title="Change Persona"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                            {/* Expand/Collapse Button */}
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="text-gray-400 hover:text-white p-1 hover:bg-gray-800 rounded transition-colors"
                                title={isExpanded ? "Collapse" : "Expand"}
                            >
                                {isExpanded ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 14h6m-6 0v6M20 10h-6m6 0V4" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M20 8V4m0 0h-4M4 16v4m0 0h4M20 16v4m0 0h-4" />
                                    </svg>
                                )}
                            </button>
                            <button onClick={() => { setIsOpen(false); setIsExpanded(false); }} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-800/95 backdrop-blur">
                        {messages.length === 0 && !loading ? (
                            <div className="flex justify-center items-center h-full text-gray-500 italic">
                                Summoning {helperName}...
                            </div>
                        ) : (
                            messages.map((msg, i) => (
                                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start items-start'}`}>
                                    {msg.role !== 'user' && (
                                        <div className="shrink-0 mt-1">
                                            {helperAvatar ? (
                                                <img src={helperAvatar} alt={helperName} className="w-8 h-8 rounded-full object-cover border border-purple-500/30 shadow-sm" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-sm shadow-inner">🤖</div>
                                            )}
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-none shadow-primary-500/10' : 'bg-gray-700 text-gray-200 rounded-bl-none border border-gray-600/50'} shadow-md text-sm`}
                                    >
                                        {msg.role === 'user' ? (
                                            msg.content
                                        ) : (
                                            <div
                                                className="prose-chat leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: msg.content }}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-700 rounded-2xl rounded-bl-none p-3 flex gap-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-gray-900 border-t border-gray-700">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                placeholder={`Ask ${helperName}...`}
                                className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:border-primary-500 text-sm"
                            />
                            <button
                                onClick={handleSend}
                                disabled={loading}
                                className="bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-xl transition-all shadow-lg active:scale-90 disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Helper Settings Modal instance for ChatWidget access */}
            <HelperSettingsModal
                isOpen={isHelperModalOpen}
                onClose={() => setIsHelperModalOpen(false)}
            />
        </div>
    );
};

export default ChatWidget;
