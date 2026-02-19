import React, { useState, useEffect, useRef } from 'react';
import { GeminiService } from '../../services/gemini';
import { useAuth } from '../../contexts/AuthContext';

const MAX_QUICK_QUESTIONS = 10;

const PlaystyleWizardModal = ({ isOpen, onClose, onComplete, helperName = "The Oracle", helperPersonality = "Wise, Efficient, Slightly Mystical" }) => {
    const { userProfile } = useAuth();
    const [mode, setMode] = useState('advanced'); // DIRECT TO CHAT
    const [subStep, setSubStep] = useState('chat');

    // Quick Mode State
    const [quickQuestions, setQuickQuestions] = useState([]);
    const [quickAnswers, setQuickAnswers] = useState([]);
    const [currentQuestionData, setCurrentQuestionData] = useState(null);
    const [selectedChoice, setSelectedChoice] = useState(null);

    // Advanced Mode State
    const [chatHistory, setChatHistory] = useState([]); // { role: 'user' | 'model', content: string }
    const [liveProfile, setLiveProfile] = useState(null);
    const [chatInput, setChatInput] = useState("");
    const messagesEndRef = useRef(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // helperName prop is now source of truth

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            resetWizard();
        }
    }, [isOpen]);

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    const resetWizard = () => {
        setMode('advanced'); // Default to advanced
        setSubStep('chat');
        // Trigger start immediately
        setTimeout(() => startAdvancedMode(), 100);
        setQuickAnswers([]);
        setChatHistory([]);
        setLiveProfile(null);
        setError(null);
        setSelectedChoice(null);
        setChatInput("");
    };

    // --- QUICK MODE LOGIC ---

    const startQuickMode = () => {
        setMode('quick');
        setSubStep('loading');
        fetchNextQuickQuestion([]);
    };

    const fetchNextQuickQuestion = async (currentAnswers) => {
        setSubStep('loading');
        setIsLoading(true);
        setError(null);
        setSelectedChoice(null);
        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            // if (!apiKey) throw new Error("Gemini API Key is missing.");

            const qData = await GeminiService.generatePlaystyleQuestion(apiKey, currentAnswers, userProfile);
            setCurrentQuestionData(qData);
            setSubStep('question');
        } catch (err) {
            console.error("Quick Wizard Error:", err);
            setError(err.message || "Failed to summon the oracle.");
            setMode('error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAnswer = async (choice) => {
        setSelectedChoice(choice);
        await new Promise(resolve => setTimeout(resolve, 600));

        const newAnswer = {
            question: currentQuestionData.question,
            answer: choice
        };
        const updatedAnswers = [...quickAnswers, newAnswer];
        setQuickAnswers(updatedAnswers);

        if (updatedAnswers.length >= MAX_QUICK_QUESTIONS) {
            finishQuickWizard(updatedAnswers);
        } else {
            fetchNextQuickQuestion(updatedAnswers);
        }
    };

    const finishQuickWizard = async (finalAnswers) => {
        setMode('synthesis');
        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            const profile = await GeminiService.synthesizePlaystyle(apiKey, finalAnswers, userProfile);

            // Force refresh of user profile to pick up the new playstyle immediately
            if (onComplete) await onComplete(profile); // This usually updates the backend

            onClose();
        } catch (err) {
            setError("Failed to synthesize your profile.");
            setMode('error');
        }
    };

    // --- ADVANCED MODE LOGIC ---

    const startAdvancedMode = async () => {
        setMode('advanced');
        setSubStep('chat');
        setIsLoading(true);
        setLiveProfile({ summary: "Pending analysis...", tags: [], scores: {} });

        // Fetch initial greeting dynamically
        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            // if (!apiKey) throw new Error("API Key missing.");

            const result = await GeminiService.refinePlaystyleChat(
                apiKey,
                [],
                liveProfile,
                { name: helperName, personality: helperPersonality },
                userProfile
            );

            setChatHistory([{ role: 'model', content: result.aiResponse }]);
        } catch (err) {
            console.error("Intro Error:", err);
            setChatHistory([{ role: 'model', content: `Greetings. I am ${helperName}. Let us begin our analysis.` }]);
        } finally {
            setIsLoading(false);
        }
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
            // if (!apiKey) throw new Error("API Key missing.");

            const result = await GeminiService.refinePlaystyleChat(
                apiKey,
                newHistory,
                liveProfile,
                { name: helperName, personality: helperPersonality },
                userProfile
            );

            setLiveProfile(result.updatedProfile);
            setChatHistory(prev => [...prev, { role: 'model', content: result.aiResponse }]);

        } catch (err) {
            console.error("Chat Error:", err);
            // Add error message to chat without blocking flow
            setChatHistory(prev => [...prev, { role: 'model', content: "My connection to the leyline flickered. Please repeat that." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const finishAdvancedWizard = async () => {
        setMode('synthesis');
        // Live profile is already formatted correctly, just save it
        if (liveProfile && onComplete) {
            await onComplete(liveProfile);
        }
        onClose();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="relative w-full max-w-6xl h-[85vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white z-20 p-2 bg-black/20 rounded-full hover:bg-black/40 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                {/* --- SELECTION MODE --- */}
                {mode === 'selection' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-12 animate-fade-in">
                        <div className="text-center space-y-4">
                            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400">
                                Choose Your Path
                            </h2>
                            <p className="text-gray-400 text-lg max-w-2xl">
                                How shall we determine your magical signature?
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                            {/* Quick Setup Card */}
                            <button
                                onClick={startQuickMode}
                                className="group relative bg-gray-800/50 hover:bg-primary-900/20 border border-gray-700 hover:border-primary-500 rounded-2xl p-8 text-left transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/10"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <svg className="w-32 h-32 text-primary-500" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9v8l10-12h-9l9-8z" /></svg>
                                </div>
                                <div className="relative z-10 space-y-4">
                                    <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white group-hover:text-primary-300 transition-colors">Quick Setup</h3>
                                    <p className="text-gray-400 group-hover:text-gray-300">
                                        Answer {MAX_QUICK_QUESTIONS} rapid-fire questions to generate a baseline profile. Best for getting started quickly.
                                    </p>
                                    <div className="pt-4 flex items-center text-sm font-bold text-primary-400 uppercase tracking-wider">
                                        Start Assessment <span className="ml-2 group-hover:ml-3 transition-all">→</span>
                                    </div>
                                </div>
                            </button>

                            {/* Deep Dive Card */}
                            <button
                                onClick={startAdvancedMode}
                                className="group relative bg-gray-800/50 hover:bg-purple-900/20 border border-gray-700 hover:border-purple-500 rounded-2xl p-8 text-left transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/10"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <svg className="w-32 h-32 text-purple-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                </div>
                                <div className="relative z-10 space-y-4">
                                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white group-hover:text-purple-300 transition-colors">Deep Dive</h3>
                                    <p className="text-gray-400 group-hover:text-gray-300">
                                        Have a conversation with the Oracle. Iterate on your preferences in real-time for a highly tailored profile.
                                    </p>
                                    <div className="pt-4 flex items-center text-sm font-bold text-purple-400 uppercase tracking-wider">
                                        Enter The Sanctum <span className="ml-2 group-hover:ml-3 transition-all">→</span>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <div className="text-gray-500 text-sm">
                            You can always retake this assessment later from your profile settings.
                        </div>
                    </div>
                )}

                {/* --- QUICK MODE UI --- */}
                {mode === 'quick' && (
                    <div className="flex-1 flex flex-col h-full bg-gray-900">
                        {/* Header */}
                        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-gray-900/50">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                <span className="w-2 h-2 rounded-full bg-primary-500 mr-3"></span>
                                Quick Assessment
                            </h3>
                            <div className="text-sm font-mono text-primary-400">
                                Q{quickAnswers.length + 1} / {MAX_QUICK_QUESTIONS}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
                            {subStep === 'loading' ? (
                                <div className="flex flex-col items-center space-y-4 animate-pulse">
                                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-primary-300 font-medium">Consulting the archives...</p>
                                </div>
                            ) : (
                                currentQuestionData && (
                                    <div className="max-w-2xl w-full space-y-8 animate-fade-in-up">

                                        {/* Progress Bar */}
                                        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary-500 transition-all duration-500 ease-out"
                                                style={{ width: `${((quickAnswers.length) / MAX_QUICK_QUESTIONS) * 100}%` }}
                                            ></div>
                                        </div>

                                        <h2 className="text-2xl md:text-3xl font-bold text-white leading-relaxed text-center">
                                            {currentQuestionData.question}
                                        </h2>

                                        <div className="grid grid-cols-1 gap-3">
                                            {currentQuestionData.choices.map((choice, idx) => {
                                                const isSelected = selectedChoice === choice;
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleQuickAnswer(choice)}
                                                        disabled={selectedChoice !== null}
                                                        className={`
                                                            group flex items-center p-4 rounded-xl border transition-all duration-200 text-left
                                                            ${isSelected
                                                                ? 'bg-primary-600/20 border-primary-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                                                : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'
                                                            }
                                                            ${selectedChoice && !isSelected ? 'opacity-50' : ''}
                                                        `}
                                                    >
                                                        <span className={`
                                                            w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-4 transition-colors
                                                            ${isSelected ? 'bg-primary-500 text-white' : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600'}
                                                        `}>
                                                            {String.fromCharCode(65 + idx)}
                                                        </span>
                                                        <span
                                                            className={`text-lg transition-colors ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}
                                                            dangerouslySetInnerHTML={{ __html: choice }}
                                                        />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}


                {/* --- ADVANCED MODE UI --- */}
                {mode === 'advanced' && (
                    <div className="flex-1 flex h-full">
                        {/* Chat Panel (Left/Center) */}
                        <div className="flex-1 flex flex-col bg-gray-900 border-r border-gray-800 w-2/3">
                            {/* Chat Header */}
                            <div className="h-16 border-b border-gray-800 flex items-center px-6 bg-gray-900/80 backdrop-blur-sm z-10">
                                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mr-3">
                                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-white font-bold">{helperName}</h3>
                                    <p className="text-xs text-purple-400">Deep Dive Analysis</p>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {chatHistory.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`
                                            max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed
                                            ${msg.role === 'user'
                                                ? 'bg-purple-600 text-white rounded-br-none'
                                                : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none'
                                            }
                                        `}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 rounded-bl-none flex items-center gap-2">
                                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></span>
                                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-100"></span>
                                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-200"></span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-gray-800 bg-gray-900">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        placeholder="Describe your playstyle..."
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                        disabled={isLoading}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={isLoading || !chatInput.trim()}
                                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl font-bold transition-colors"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Live Profile Panel (Right) */}
                        <div className="w-1/3 bg-gray-950 p-6 overflow-y-auto border-l border-gray-800 hidden md:block">
                            <h3 className="text-white font-bold mb-6 flex items-center">
                                <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Live Profile Summary
                            </h3>

                            {liveProfile ? (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Analysis</h4>
                                        <div
                                            className="text-gray-300 text-sm leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: liveProfile.summary || "Gathering data..." }}
                                        />
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Dominant Traits</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {liveProfile.tags?.length > 0 ? (
                                                liveProfile.tags.map((tag, i) => (
                                                    <span key={i} className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-medium">
                                                        {tag}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-600 text-xs italic">Pending...</span>
                                            )}
                                        </div>
                                    </div>

                                    {liveProfile.scores && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Psychographics</h4>
                                            {Object.entries(liveProfile.scores).map(([key, val]) => (
                                                <div key={key}>
                                                    <div className="flex justify-between text-xs text-gray-400 mb-1 capitalize">
                                                        <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                        <span>{val}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-purple-600 to-primary-500"
                                                            style={{ width: `${val}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-6 border-t border-gray-800">
                                        <button
                                            onClick={finishAdvancedWizard}
                                            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg hover:shadow-green-500/20 transition-all"
                                        >
                                            Finalize Profile
                                        </button>
                                        <p className="text-center text-xs text-gray-500 mt-2">
                                            Click whenever you feel the profile is accurate.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-gray-600">
                                    <div className="animate-pulse mb-2 text-4xl">🔮</div>
                                    <p className="text-sm">The Oracle is listening...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {/* --- SYNTHESIS / FINAL LOADING --- */}
                {mode === 'synthesis' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 bg-gray-900 p-8">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-green-500"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-10 w-10 bg-green-500/20 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-white">Finalizing your Grimoire...</h3>
                        <p className="text-gray-400">Saving your magical identity to the archives.</p>
                    </div>
                )}

                {/* --- ERROR STATE --- */}
                {mode === 'error' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-gray-900 text-center p-8">
                        <div className="text-red-500 text-6xl mb-4">⚠️</div>
                        <h3 className="text-2xl font-bold text-white">Something went wrong</h3>
                        <p className="text-red-300 max-w-md mx-auto">{error}</p>
                        <button
                            onClick={resetWizard}
                            className="mt-6 bg-gray-800 hover:bg-gray-700 text-white py-3 px-8 rounded-lg transition-colors border border-gray-600"
                        >
                            Try Again
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default PlaystyleWizardModal;
