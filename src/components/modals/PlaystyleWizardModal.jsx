import React, { useState, useEffect } from 'react';
import { GeminiService } from '../../services/gemini';
import { useAuth } from '../../contexts/AuthContext';

const MAX_QUESTIONS = 7;

const PlaystyleWizardModal = ({ isOpen, onClose, onComplete }) => {
    const { userProfile } = useAuth();
    const [step, setStep] = useState('intro'); // intro, question, loading, synthesis, error
    const [questions, setQuestions] = useState([]); // Array of { question, choices }
    const [answers, setAnswers] = useState([]); // Array of { question, answer }
    const [currentQuestionData, setCurrentQuestionData] = useState(null); // { question, choices }
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const [selectedChoice, setSelectedChoice] = useState(null);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setStep('intro');
            setAnswers([]);
            setQuestions([]);
            setCurrentQuestionData(null);
            setError(null);
            setSelectedChoice(null);
        }
    }, [isOpen]);

    const handleStart = () => {
        setStep('loading');
        fetchNextQuestion([]);
    };

    const fetchNextQuestion = async (currentAnswers) => {
        setStep('loading'); // Ensure we show loading screen between questions
        setIsLoading(true);
        setError(null);
        setSelectedChoice(null); // Reset selection for next Q
        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            if (!apiKey) {
                throw new Error("Gemini API Key is missing. Please check your settings.");
            }

            const qData = await GeminiService.generatePlaystyleQuestion(apiKey, currentAnswers);
            setCurrentQuestionData(qData);
            setStep('question');
        } catch (err) {
            console.error("Wizard Error:", err);
            setError(err.message || "Failed to summon the oracle.");
            setStep('error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswer = async (choice) => {
        setSelectedChoice(choice);

        // Visual delay to show selection
        await new Promise(resolve => setTimeout(resolve, 600));

        const newAnswer = {
            question: currentQuestionData.question,
            answer: choice
        };
        const updatedAnswers = [...answers, newAnswer];
        setAnswers(updatedAnswers);

        if (updatedAnswers.length >= MAX_QUESTIONS) {
            finishWizard(updatedAnswers);
        } else {
            fetchNextQuestion(updatedAnswers);
        }
    };

    const finishWizard = async (finalAnswers) => {
        setStep('synthesis');
        try {
            const apiKey = userProfile?.settings?.geminiApiKey;
            const profile = await GeminiService.synthesizePlaystyle(apiKey, finalAnswers);

            if (onComplete) {
                await onComplete(profile);
            }
            onClose(); // Close this modal, ideally the parent will open the profile modal
        } catch (err) {
            setError("Failed to synthesize your profile. Please try again.");
            setStep('error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white z-10 p-2 bg-black/20 rounded-full hover:bg-black/40 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                {/* Content Area */}
                <div className="p-8 flex-1 flex flex-col overflow-y-auto">

                    {step === 'intro' && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-10">
                            <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center ring-1 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                                <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-3">Discover Your Playstyle</h2>
                                <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
                                    Answer {MAX_QUESTIONS} questions to let our AI analyze your magical identity.
                                    We'll uncover your preferred strategies, strengths, and ideal deck archetypes.
                                </p>
                            </div>
                            <button
                                onClick={handleStart}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5"
                            >
                                Begin Assessment
                            </button>
                        </div>
                    )}

                    {step === 'loading' && (
                        <div className="flex flex-col items-center justify-center h-full space-y-6">
                            <div className="relative">
                                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-8 w-8 bg-indigo-500/20 rounded-full animate-pulse"></div>
                                </div>
                            </div>
                            <p className="text-gray-300 font-medium animate-pulse">Consulting the archives...</p>
                        </div>
                    )}

                    {step === 'synthesis' && (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
                            <div className="relative">
                                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
                            </div>
                            <h3 className="text-xl font-bold text-white">Assessment Complete</h3>
                            <p className="text-gray-300 animate-pulse">Synthesizing your magical identity...</p>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                            <div className="text-red-500 text-5xl">⚠️</div>
                            <h3 className="text-xl font-bold text-white">Something went wrong</h3>
                            <p className="text-red-300 max-w-xs mx-auto">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-4 bg-gray-700 hover:bg-gray-600 text-white py-2 px-6 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {step === 'question' && currentQuestionData && (
                        <div className="space-y-8 animate-fade-in-up">
                            {/* Progress */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500">
                                    <span>Question {answers.length + 1} of {MAX_QUESTIONS}</span>
                                    <span>{Math.round((answers.length / MAX_QUESTIONS) * 100)}% Complete</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                                        style={{ width: `${((answers.length) / MAX_QUESTIONS) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Question Card */}
                            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 shadow-inner">
                                <h3 className="text-xl md:text-2xl font-bold text-white leading-relaxed">
                                    {currentQuestionData.question}
                                </h3>
                            </div>

                            {/* Choices */}
                            <div className="grid grid-cols-1 gap-3">
                                {currentQuestionData.choices.map((choice, idx) => {
                                    const isSelected = selectedChoice === choice;
                                    const isDisabled = selectedChoice !== null;

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleAnswer(choice)}
                                            disabled={isDisabled}
                                            className={`
                                                text-left w-full p-4 rounded-xl border transition-all duration-200 group flex items-center relative overflow-hidden
                                                ${isSelected
                                                    ? 'bg-indigo-600/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                                    : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-500'
                                                }
                                                ${isDisabled && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}
                                            `}
                                        >
                                            <span
                                                className={`
                                                    flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 text-sm transition-colors
                                                    ${isSelected
                                                        ? 'bg-indigo-500 text-white'
                                                        : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600 group-hover:text-gray-200'
                                                    }
                                                `}
                                            >
                                                {String.fromCharCode(65 + idx)}
                                            </span>
                                            <span
                                                className={`font-medium text-lg transition-colors ${isSelected ? 'text-white' : 'text-gray-200'}`}
                                            >
                                                {choice}
                                            </span>
                                            {isSelected && (
                                                <div className="absolute right-4 animate-scale-in">
                                                    <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlaystyleWizardModal;
