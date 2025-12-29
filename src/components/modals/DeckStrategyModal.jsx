import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GeminiService } from '../../services/gemini';
import { deckService } from '../../services/deckService';
import { useToast } from '../../contexts/ToastContext';

const DeckStrategyModal = ({ isOpen, onClose, deck, cards = [] }) => {
    const { userProfile, currentUser } = useAuth();
    const { addToast } = useToast();
    const [isRerunning, setIsRerunning] = React.useState(false);

    // Lock body scroll
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen || !deck) return null;

    const blueprint = deck.aiBlueprint || {};
    const strategyHtml = blueprint.strategy || '<p class="text-gray-400">No strategy generated for this deck yet.</p>';
    const theme = blueprint.theme || 'Custom Strategy';
    const commander = deck.commander;
    const targets = blueprint.suggestedCounts || {};

    const handleRerunning = async () => {
        if (!userProfile?.settings?.geminiApiKey) {
            addToast("Gemini API Key missing in settings.", "error");
            return;
        }

        setIsRerunning(true);
        try {
            const newStrategy = await GeminiService.getDeckStrategy(
                userProfile.settings.geminiApiKey,
                deck.commander?.name || 'Unknown Commander',
                userProfile.playstyle,
                cards
            );

            await deckService.updateDeck(currentUser.uid, deck.id, {
                aiBlueprint: {
                    ...blueprint,
                    theme: newStrategy.theme,
                    strategy: newStrategy.strategy,
                    suggestedCounts: newStrategy.layout
                }
            });

            addToast("Strategy updated based on your current build!", "success");
            window.location.reload();
        } catch (err) {
            console.error(err);
            addToast("Failed to rerun strategy analysis.", "error");
        } finally {
            setIsRerunning(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 animate-fade-in">
            <div className="bg-gray-900 w-full max-w-5xl max-h-[90vh] mx-auto rounded-3xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden relative">

                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h2
                                className="text-2xl font-bold text-white tracking-tight"
                                dangerouslySetInnerHTML={{ __html: theme }}
                            />
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{helperName} Strategic Blueprint</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRerunning}
                            disabled={isRerunning}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${isRerunning
                                ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-lg shadow-indigo-600/20'
                                }`}
                        >
                            {isRerunning ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            )}
                            {isRerunning ? 'Analyzing...' : 'Rerun Analysis'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all text-gray-400 hover:text-white border border-gray-700"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">

                    {/* Strategy Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-10 relative">
                        {/* Card Count Badge */}
                        <div className="absolute top-0 right-0 z-10 hidden sm:block">
                            <div className="bg-green-600/10 text-green-400 px-5 py-2.5 rounded-full border border-green-500/30 flex flex-col items-center justify-center min-w-[100px] backdrop-blur-sm">
                                <span className="text-lg font-black font-mono leading-none">
                                    {(cards || []).length}/100
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-1">
                                    Cards
                                </span>
                            </div>
                        </div>
                        {/* Commander Sidebar */}
                        <div className="space-y-6">
                            <div className="sticky top-0">
                                <img
                                    src={commander?.image_uris?.normal || commander?.image_uri || 'https://placehold.co/480x680?text=Commander'}
                                    className="w-full rounded-2xl shadow-xl border border-gray-800"
                                    alt={commander?.name}
                                />
                                <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Lead Commander</h4>
                                    <div className="text-white font-bold text-sm">{commander?.name}</div>
                                </div>
                            </div>
                        </div>

                        {/* Main Text */}
                        <div className="space-y-8">
                            <div
                                className="text-gray-300 leading-relaxed strategy-content-refined"
                                dangerouslySetInnerHTML={{ __html: strategyHtml }}
                            />

                            {/* Composition Breakdown */}
                            <div className="space-y-4 pt-8 border-t border-gray-800">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Target Deck Composition</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                    {Object.entries(targets).map(([type, count]) => (
                                        <div key={type} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 text-center group hover:bg-gray-800 transition-colors">
                                            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1 group-hover:text-indigo-400 transition-colors">{type}</div>
                                            <div className="text-2xl font-bold text-white font-mono">{count}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-gray-800 bg-gray-900/50 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-widest border border-gray-700"
                    >
                        Close Blueprint
                    </button>
                </div>

            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .strategy-content-refined h4 {
                    font-size: 1.1rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #fff;
                    margin-top: 2.5rem;
                    margin-bottom: 1rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 2px solid #374151;
                }
                .strategy-content-refined h4:first-child {
                    margin-top: 0;
                }
                .strategy-content-refined p:first-of-type {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #fff;
                    line-height: 1.6;
                    margin-bottom: 2rem;
                }
                .strategy-content-refined p {
                    font-size: 0.95rem;
                    margin-bottom: 1.25rem;
                    color: #9ca3af;
                }
                .strategy-content-refined ul {
                    margin-bottom: 1.5rem;
                    list-style-type: none;
                }
                .strategy-content-refined li {
                    margin-bottom: 0.75rem;
                    position: relative;
                    padding-left: 1.25rem;
                    color: #d1d5db;
                }
                .strategy-content-refined li::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0.6em;
                    width: 6px;
                    height: 6px;
                    background: #6366f1;
                    border-radius: 2px;
                }
                .strategy-content-refined strong {
                    color: #e5e7eb;
                    font-weight: 700;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #111827;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #374151;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #4b5563;
                }
            `}} />
        </div>
    );
};

export default DeckStrategyModal;
