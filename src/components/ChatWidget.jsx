import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GeminiService } from '../services/gemini';
import { getPageDoc } from '../data/helpDocs';
import { useAuth } from '../contexts/AuthContext';
import HelperSettingsModal from './modals/HelperSettingsModal';

const ChatWidget = () => {
    const { userProfile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHelperModalOpen, setIsHelperModalOpen] = useState(false);

    // Helper Data
    const helper = userProfile?.settings?.helper;
    const helperName = helper?.name || "MTG Forge";
    const helperAvatar = helper?.avatar_url || helper?.avatar;

    // Initial message state (loading state for intro)
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [introFetched, setIntroFetched] = useState(false);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    // Fetch dynamic intro only when opened for the first time
    useEffect(() => {
        // Event Listener for external open
        const handleOpenEvent = () => {
            setIsOpen(true);
        };
        window.addEventListener('open-chat-widget', handleOpenEvent);

        return () => window.removeEventListener('open-chat-widget', handleOpenEvent);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const fetchIntro = async () => {
            if (introFetched) return;

            setIntroFetched(true); // Prevent double fetch

            // If we already have messages (restored session?), skip intro
            if (messages.length > 0) return;

            const apiKey = userProfile?.settings?.geminiApiKey;

            try {
                const introPrompt = `
                    You are about to have a conversation with a user.
                    your name is ${helperName}.
                    Your personality is: ${helper?.personality || "Knowledgeable and friendly"}.
                    It is not their first time working with you, interact with them appropriately.
                    Use emojis. 
                `;

                // We use a history of [] so it treats it as a fresh start
                const response = await GeminiService.sendMessage(apiKey, [], introPrompt, '', helper, userProfile);
                setMessages([{ role: 'model', content: response.result }]);
            } catch (err) {
                console.error("Intro fetch failed", err);
                setMessages([{ role: 'model', content: `<p>Greetings. I am ${helperName}. How may I assist?</p>` }]);
            }
        };

        fetchIntro();
    }, [isOpen, userProfile?.settings?.geminiApiKey, helperName, introFetched]);

    // Page Context for AI
    const location = useLocation();


    // Playstyle Context
    const playstyle = userProfile?.settings?.playstyle;
    const playstyleContext = playstyle ? `
User's Playstyle Profile:
- Archetypes: ${playstyle.archetypes?.join(', ') || 'Unknown'}
- Summary: ${playstyle.summary || 'Unknown'}
- Combat Preference: ${playstyle.scores?.aggression > 50 ? 'Aggressive' : 'Defensive'}
- Interaction Level: ${playstyle.scores?.interaction > 50 ? 'High' : 'Low'}
    `.trim() : '';

    // Combine Page Docs + Playstyle
    const pageDoc = getPageDoc ? getPageDoc(location.pathname) : '';
    const fullContext = `
${pageDoc}

${playstyleContext}
    `.trim();

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            const history = messages.map(m => ({ role: m.role, content: m.content }));

            // Pass full context (Docs + Playstyle)
            const response = await GeminiService.sendMessage(apiKey, history, userMsg, fullContext, helper, userProfile);

            setMessages(prev => [...prev, { role: 'model', content: response.result }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                role: 'model',
                content: `<div class="p-3 bg-red-900/30 border border-red-700 rounded text-red-200">Error: ${error.message}</div>`
            }]);
        } finally {
            setLoading(false);
        }
    };

    // Dynamic Classes for Expanded Mode
    // Assuming standard nav height of h-16 (4rem or 64px)
    const containerClasses = isExpanded
        ? 'w-full fixed top-16 bottom-0 right-0 left-0 rounded-none border-0 z-40' // Full screen minus nav
        : 'w-full md:w-96 h-[600px] mb-0 mr-0 bottom-0 right-0 rounded-tl-2xl md:rounded-tr-2xl border-t border-l md:border-r absolute'; // Widget mode - absolute within container

    const wrapperClasses = isExpanded
        ? 'fixed inset-0 top-16 z-40'
        : `fixed bottom-0 right-0 z-[60] transition-all duration-300 ${isOpen ? '' : 'w-16 h-16 mb-20 mr-4 md:mb-6 md:mr-6'}`;

    return (
        <div className={`${wrapperClasses} ${!isExpanded && isOpen ? 'w-full md:w-96 h-[600px] mb-16 md:mb-0 mr-0' : ''}`}>
            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-16 h-16 bg-gradient-to-r from-primary-600 to-purple-600 rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center hover:scale-110 transition-transform animate-bounce-slow"
                >
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className={`flex flex-col h-full bg-gray-800 border-t border-l border-gray-700 shadow-2xl overflow-hidden ${isExpanded ? 'w-full h-full' : 'rounded-tl-2xl md:rounded-tr-2xl md:border-r'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
                        <div className="flex items-center gap-2">
                            {helperAvatar ? (
                                <img src={helperAvatar} alt={helperName} className="w-6 h-6 rounded-full object-cover border border-purple-500/50" />
                            ) : (
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            )}
                            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">{helperName}</span>
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
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[85%] p-2.5 rounded-2xl ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'} shadow-md text-sm`}
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
                    <form onSubmit={handleSend} className="p-4 bg-gray-900 border-t border-gray-700">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={`Ask ${helperName}...`}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-gradient-to-r from-primary-600 to-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg hover:shadow-primary-500/20 transition-all disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Helper Settings Modal instance for ChatWidget access */}
            <HelperSettingsModal isOpen={isHelperModalOpen} onClose={() => setIsHelperModalOpen(false)} />
        </div>
    );
};

export default ChatWidget;
