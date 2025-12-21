import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { GeminiService } from '../services/gemini';
import CardGridItem from '../components/common/CardGridItem';

const STEPS = {
    BASICS: 1,
    COMMANDER: 2,
    AI_STRATEGY: 3,
    REVIEW: 4
};

const CreateDeckPage = () => {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { addToast } = useToast();

    // Wizard State
    const [step, setStep] = useState(STEPS.BASICS);
    const [loading, setLoading] = useState(false);

    // Data State
    const [name, setName] = useState('');
    const [format, setFormat] = useState('Commander'); // Default
    const [availableCommanders, setAvailableCommanders] = useState([]);
    const [selectedCommander, setSelectedCommander] = useState(null);
    const [commanderSearch, setCommanderSearch] = useState('');
    const [commanderGroup, setCommanderGroup] = useState('name'); // 'name' | 'set'

    // AI State
    const [strategyData, setStrategyData] = useState(null); // { theme, strategy, layout: {} }

    // --- Step 1: Basics ---
    const handleBasicsSubmit = (e) => {
        e.preventDefault();
        if (format === 'Commander') {
            fetchCommanders();
        } else {
            // Skip to finish for non-commander
            createDeck();
        }
    };

    const getCardImage = (card) => {
        if (!card) return null;

        // Handle database row format: card.data contains the Scryfall object
        const cardData = card.data || card;

        // Check for double-faced card images
        if (cardData.card_faces && cardData.card_faces.length > 0 && cardData.card_faces[0].image_uris) {
            return cardData.card_faces[0].image_uris.normal;
        }
        // Fallback to top-level image_uris or image_uri
        return (cardData.image_uris && cardData.image_uris.normal) || cardData.image_uri || card.image_uri;
    };

    // --- Step 2: Commander ---
    const fetchCommanders = async () => {
        setLoading(true);
        try {
            // Fetch unused legendary creatures using params object for safer encoding
            const cards = await api.get('/collection', {
                type_line: 'legendary creature',
                unused: true
            });
            setAvailableCommanders(cards);
            setStep(STEPS.COMMANDER);
        } catch (err) {
            console.error(err);
            addToast('Failed to load commanders', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCommanderSelect = (card) => {
        setSelectedCommander(card);
        // Auto-advance
        setStep(STEPS.AI_STRATEGY);
    };

    // --- Step 3: AI Strategy ---
    const generateStrategy = async () => {
        const apiKey = userProfile?.settings?.geminiApiKey;

        console.log("Checking AI Key:", { hasProfile: !!userProfile, hasSettings: !!userProfile?.settings, hasKey: !!apiKey });

        if (!apiKey) {
            addToast('AI Key missing in settings. Skipping AI step.', 'warning');
            setStep(STEPS.REVIEW);
            return;
        }

        setLoading(true);
        try {
            const data = await GeminiService.getDeckStrategy(apiKey, selectedCommander.name);
            setStrategyData(data);

            // Auto-fill name if blank
            if (!name.trim() && data.suggestedName) {
                setName(data.suggestedName);
            }

            setStep(STEPS.REVIEW);
        } catch (err) {
            console.error(err);
            addToast('AI Generation Failed. You can set strategy manually.', 'error');
            // Fallback empty structure
            setStrategyData({
                theme: '',
                strategy: '',
                layout: { Lands: 36, Creatures: 30, Instants: 10, Sorceries: 10, Artifacts: 10, Enchantments: 4 }
            });
            setStep(STEPS.REVIEW);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (step === STEPS.AI_STRATEGY && selectedCommander && !strategyData) {
            generateStrategy();
        }
    }, [step]); // Run when entering step 3

    // --- Step 4/5: Create ---
    const createDeck = async () => {
        setLoading(true);
        try {
            const payload = {
                name: name || selectedCommander?.name || 'New Commander Deck', // Fallback name
                format,
                commander: selectedCommander?.data || selectedCommander || null
            };

            const newDeck = await api.post('/decks', payload);
            addToast('Deck created successfully!', 'success');
            navigate(`/decks/${newDeck.id}`);

        } catch (err) {
            console.error(err);
            addToast('Failed to create deck', 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- Renders ---

    const renderBasics = () => (
        <form onSubmit={handleBasicsSubmit} className="space-y-6 animate-fade-in">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Deck Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Leave blank for AI suggestion..."
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Format</label>
                <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="Commander">Commander (EDH)</option>
                    <option value="Standard">Standard</option>
                    <option value="Modern">Modern</option>
                    <option value="Legacy">Legacy</option>
                    <option value="Kitchen Table">Kitchen Table</option>
                </select>
            </div>
            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20">
                Next: Select Commander
            </button>
        </form>
    );

    const renderCommander = () => {
        // Filter commands locally
        const filtered = availableCommanders.filter(c =>
            c.name.toLowerCase().includes(commanderSearch.toLowerCase()) ||
            (c.data?.type_line || c.type_line || '').toLowerCase().includes(commanderSearch.toLowerCase())
        );

        // Sort/Group
        const displayedCommanders = [...filtered].sort((a, b) => {
            if (commanderGroup === 'set') {
                return (a.set_code || '').localeCompare(b.set_code || '');
            }
            return a.name.localeCompare(b.name);
        });

        return (
            <div className="space-y-6 animate-fade-in h-[600px] flex flex-col">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-xl font-bold text-indigo-300">Choose a Commander</h2>
                        <p className="text-sm text-gray-400">Showing {filtered.length} unused Legendary Creatures.</p>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Search name or type..."
                            value={commanderSearch}
                            onChange={(e) => setCommanderSearch(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <select
                            value={commanderGroup}
                            onChange={(e) => setCommanderGroup(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                            <option value="name">Sort by Name</option>
                            <option value="set">Sort by Set</option>
                        </select>
                    </div>
                </div>

                {displayedCommanders.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-xl">
                        <p>No matches found.</p>
                        <button onClick={() => { setSelectedCommander(null); createDeck(); }} className="mt-4 text-indigo-400 hover:underline">
                            Skip / Create Empty Deck
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {displayedCommanders.map(c => (
                            <div key={c.id} onClick={() => handleCommanderSelect(c)} className="cursor-pointer hover:ring-2 ring-indigo-500 rounded-lg transition-all relative group">
                                <CardGridItem card={c} showQuantity={false} />
                                <div className="absolute bottom-2 right-2 bg-black/80 text-xs px-2 py-0.5 rounded text-gray-300 pointer-events-none">
                                    {c.set_code?.toUpperCase()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderAIStrategy = () => (
        <div className="flex flex-col items-center justify-center h-64 animate-fade-in text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500 mb-6"></div>
            <h3 className="text-xl font-bold text-white mb-2">Analyzing {selectedCommander?.name}...</h3>
            <p className="text-gray-400">Consulting the Oracle for optimal strategies...</p>
        </div>
    );

    const renderReview = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <div className="w-24 flex-shrink-0">
                    <img src={getCardImage(selectedCommander)} className="rounded shadow-md w-full" alt={selectedCommander?.name} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">{strategyData?.theme || 'Custom Strategy'}</h3>
                    <p className="text-sm text-gray-300 mt-1">{strategyData?.strategy}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(strategyData?.layout || {}).map(([type, count]) => (
                    <div key={type} className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <label className="text-xs text-gray-400 uppercase font-bold">{type}</label>
                        <input
                            type="number"
                            className="w-full bg-transparent text-xl font-mono text-white outline-none border-b border-gray-600 focus:border-indigo-500"
                            value={count}
                            onChange={(e) => setStrategyData({
                                ...strategyData,
                                layout: { ...strategyData.layout, [type]: parseInt(e.target.value) || 0 }
                            })}
                        />
                    </div>
                ))}
            </div>

            <div className="flex gap-4 pt-4">
                <button
                    onClick={() => setStep(STEPS.COMMANDER)}
                    className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium"
                >
                    Back
                </button>
                <button
                    onClick={createDeck}
                    className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20"
                >
                    Create Deck
                </button>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto mt-10 px-4">
            {/* Progress Bar */}
            <div className="flex justify-between items-center mb-8 relative">
                <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-800 -z-10 rounded"></div>
                {Object.keys(STEPS).map((key, idx) => {
                    const stepNum = STEPS[key];
                    const isActive = step === stepNum;
                    const isCompleted = step > stepNum;
                    return (
                        <div key={key} className={`flex flex-col items-center gap-2 transition-all ${isActive ? 'scale-110' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/30' :
                                isCompleted ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-500'
                                }`}>
                                {isCompleted ? '✓' : stepNum}
                            </div>
                            <span className={`text-xs font-bold uppercase ${isActive ? 'text-indigo-400' : 'text-gray-600'}`}>
                                {key.replace('_', ' ')}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl p-6 md:p-8 min-h-[400px]">
                {step === STEPS.BASICS && renderBasics()}
                {step === STEPS.COMMANDER && renderCommander()}
                {step === STEPS.AI_STRATEGY && renderAIStrategy()}
                {step === STEPS.REVIEW && renderReview()}
            </div>
        </div>
    );
};

export default CreateDeckPage;
