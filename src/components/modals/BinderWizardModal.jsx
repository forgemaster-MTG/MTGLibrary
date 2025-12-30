import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useCollection } from '../../hooks/useCollection';
import { api } from '../../services/api';

const STEPS = {
    METHOD: 1,
    CONFIG: 2,
    CARDS: 3,
    REVIEW: 4
};

const BinderWizardModal = ({ isOpen, onClose, selectedCards = [] }) => {
    const { addToast } = useToast();
    const { cards: allCards } = useCollection();

    // Wizard State
    const [step, setStep] = useState(STEPS.METHOD);
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [type, setType] = useState('collection');
    const [iconType, setIconType] = useState('emoji'); // 'emoji' | 'mtg'
    const [iconValue, setIconValue] = useState('📁');
    const [color, setColor] = useState('blue');
    const [cardsToAdd, setCardsToAdd] = useState([]);

    // Logic State
    const [smartGroups, setSmartGroups] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    // Initial Setup
    useEffect(() => {
        if (isOpen) {
            setStep(STEPS.METHOD);
            setName('');
            setType('collection');
            setIconType('emoji');
            setIconValue('📁');
            setColor('blue');
            setCardsToAdd(selectedCards || []); // Pre-populate if triggered with selection
            setSmartGroups([]);
        }
    }, [isOpen]);

    // --- LOGIC: Smart Scan ---
    const runSmartScan = () => {
        setIsScanning(true);
        // Simulate "Processing" time for UX
        setTimeout(() => {
            const groups = [];

            // 1. Value Heuristic: "High Value" (Cards > $5)
            const expensiveCards = allCards.filter(c => parseFloat(c.prices?.usd || 0) > 5);
            if (expensiveCards.length > 0) {
                groups.push({
                    id: 'high-value',
                    name: 'High Value Vault',
                    description: `${expensiveCards.length} cards worth > $5`,
                    icon: '💎',
                    color: 'purple',
                    cards: expensiveCards
                });
            }

            // 2. Rarity Heuristic: "Rare Trade Binder"
            const rares = allCards.filter(c => c.rarity === 'rare' || c.rarity === 'mythic');
            if (rares.length > 10) {
                groups.push({
                    id: 'rares',
                    name: 'Trade Binder',
                    description: `Collection of ${rares.length} Rares & Mythics`,
                    icon: '🤝',
                    color: 'green',
                    cards: rares
                });
            }

            // 3. Set Heuristics: Find largest sets
            const setCounts = {};
            allCards.forEach(c => {
                if (c.set_name) {
                    if (!setCounts[c.set_name]) setCounts[c.set_name] = [];
                    setCounts[c.set_name].push(c);
                }
            });

            Object.entries(setCounts).forEach(([setName, setCards]) => {
                if (setCards.length > 15) {
                    groups.push({
                        id: `set-${setName}`,
                        name: `${setName} Set`,
                        description: `Complete set progress (${setCards.length} cards)`,
                        icon: '📚',
                        color: 'blue',
                        cards: setCards
                    });
                }
            });

            // 4. Commander Candidates (Legendary Creatures)
            const commanders = allCards.filter(c => c.type_line && c.type_line.includes('Legendary Creature'));
            if (commanders.length > 5) {
                groups.push({
                    id: 'commanders',
                    name: 'Potential Commanders',
                    description: `${commanders.length} Legendary Creatures`,
                    icon: '🛡️',
                    color: 'red',
                    cards: commanders
                });
            }

            setSmartGroups(groups);
            setIsScanning(false);
        }, 800);
    };

    const handleSmartGroupSelect = (group) => {
        setName(group.name);
        setIconValue(group.icon);
        setColor(group.color);
        setCardsToAdd(group.cards);
        setStep(STEPS.CONFIG); // Skip to Config to confirm details
    };


    // --- ACTION: Create ---
    const handleCreate = async () => {
        setLoading(true);
        try {
            // 1. Create Binder
            const binderPayload = { name, type, icon_type: iconType, icon_value: iconValue, color_preference: color };
            const binderRes = await api.post('/api/binders', binderPayload);
            const binderId = binderRes.id;

            // 2. Add Cards
            if (cardsToAdd.length > 0) {
                const cardIds = cardsToAdd.map(c => c.firestoreId || c.id);
                await api.put('/api/collection/batch-update', {
                    cardIds,
                    binderId: binderId
                });
            }

            addToast('Binder created successfully!', 'success');
            onClose();
            window.location.reload(); // Refresh to show new binder (Ideally should use context update)
        } catch (err) {
            console.error(err);
            addToast('Failed to create binder', 'error');
        } finally {
            setLoading(false);
        }
    };


    // --- RENDERERS ---

    const renderMethodStep = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
                onClick={() => setStep(STEPS.CONFIG)}
                className="p-6 bg-gray-800 hover:bg-indigo-900/20 border border-gray-700 hover:border-indigo-500 rounded-2xl text-left transition-all group"
            >
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">✨</div>
                <h3 className="text-lg font-bold text-white mb-2">Start Fresh</h3>
                <p className="text-gray-400 text-sm">Create an empty binder and customize it exactly how you want.</p>
            </button>

            <button
                onClick={() => { setStep(STEPS.METHOD); runSmartScan(); }} // Stay on method but expand scan
                className="p-6 bg-gray-800 hover:bg-indigo-900/20 border border-gray-700 hover:border-indigo-500 rounded-2xl text-left transition-all group relative overflow-hidden"
            >
                <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">🧠</div>
                <h3 className="text-lg font-bold text-white mb-2">Smart Organize</h3>
                <p className="text-gray-400 text-sm">Let AI scan your collection and suggest logical binders.</p>
            </button>

            {/* Smart Scan Results (Inline Expansion) */}
            {(isScanning || smartGroups.length > 0) && (
                <div className="col-span-1 md:col-span-2 mt-4 space-y-4 animate-fade-in-down">
                    <div className="h-px bg-gray-800 w-full" />
                    {isScanning ? (
                        <div className="flex flex-col items-center py-8">
                            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
                            <p className="text-indigo-400 font-mono text-sm">Analyzing {allCards.length} cards...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {smartGroups.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => handleSmartGroupSelect(group)}
                                    className="p-4 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 hover:border-white/20 rounded-xl flex items-center gap-4 transition-all text-left"
                                >
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl bg-${group.color}-900/20`}>
                                        {group.icon}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{group.name}</div>
                                        <div className="text-xs text-gray-400">{group.description}</div>
                                    </div>
                                </button>
                            ))}
                            {smartGroups.length === 0 && (
                                <div className="col-span-full text-center text-gray-500 italic py-4">
                                    No obvious groups found. Try creating a custom binder!
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderConfigStep = () => (
        <div className="space-y-6">
            {/* Name Input */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Binder Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Rare Trade Binder"
                    autoFocus
                    className="w-full bg-gray-800 border-2 border-gray-700 focus:border-indigo-500 text-white px-4 py-3 rounded-xl focus:outline-none font-bold text-lg transition-all"
                />
            </div>

            {/* Icon Picker */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Icon</label>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2">
                        <button onClick={() => setIconType('emoji')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${iconType === 'emoji' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Emojis</button>
                        <button onClick={() => setIconType('mtg')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${iconType === 'mtg' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>MTG Symbols</button>
                    </div>

                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 h-32 overflow-y-auto custom-scrollbar p-1">
                        {iconType === 'emoji' ? (
                            ['📁', '📂', '💾', '📦', '🏷️', '💎', '💍', '🏆', '🥇', '🎨', '🔮', '📜', '⚔️', '🛡️', '🔥', '💧', '💀', '🌲', '☀️', '🤝'].map(icon => (
                                <button
                                    key={icon}
                                    onClick={() => setIconValue(icon)}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${iconValue === icon ? 'bg-indigo-600 text-white scale-110 shadow-lg' : 'hover:bg-gray-700 text-gray-300'}`}
                                >
                                    {icon}
                                </button>
                            ))
                        ) : (
                            ['ms-w', 'ms-u', 'ms-b', 'ms-r', 'ms-g', 'ms-c', 'ms-planeswalker', 'ms-land', 'ms-artifact', 'ms-enchantment'].map(icon => (
                                <button
                                    key={icon}
                                    onClick={() => setIconValue(icon)}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${iconValue === icon ? 'bg-indigo-600 text-white scale-110 shadow-lg' : 'hover:bg-gray-700 text-gray-300'}`}
                                >
                                    <i className={`ms ${icon} ms-cost`}></i>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Color Theme */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Color Theme</label>
                <div className="flex gap-4">
                    {['blue', 'red', 'green', 'purple', 'orange', 'gray'].map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white scale-110' : 'opacity-50 hover:opacity-100'}`}
                            style={{ backgroundColor: c === 'blue' ? '#3B82F6' : c === 'red' ? '#EF4444' : c === 'green' ? '#10B981' : c === 'purple' ? '#8B5CF6' : c === 'orange' ? '#F59E0B' : '#6B7280' }}
                        >
                            {color === c && <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderReviewStep = () => (
        <div className="text-center py-6">
            <div className={`w-24 h-24 mx-auto bg-${color}-500/20 rounded-3xl flex items-center justify-center text-5xl mb-6 border-2 border-${color}-500 shadow-[0_0_30px_rgba(0,0,0,0.3)]`}>
                {iconValue.startsWith('ms') ? <i className={`ms ${iconValue} ms-2x`}></i> : iconValue}
            </div>

            <h2 className="text-3xl font-black text-white mb-2">{name}</h2>
            <p className="text-gray-400 mb-8">Ready to create your new binder!</p>

            {cardsToAdd.length > 0 && (
                <div className="bg-gray-800/50 rounded-xl p-4 max-w-sm mx-auto border border-gray-700">
                    <div className="font-bold text-white mb-1">{cardsToAdd.length} Cards Selected</div>
                    <div className="text-xs text-gray-500">These cards will be automatically moved to this binder.</div>

                    {/* Tiny preview pile */}
                    <div className="flex justify-center -space-x-2 mt-4">
                        {cardsToAdd.slice(0, 5).map((c, i) => (
                            <div key={i} className="w-8 h-10 bg-gray-700 rounded border border-gray-600 relative" style={{ transform: `rotate(${(i - 2) * 5}deg)` }}>
                                {c.image_uris?.small ? <img src={c.image_uris.small} className="w-full h-full object-cover rounded" alt="" /> : null}
                            </div>
                        ))}
                        {cardsToAdd.length > 5 && <div className="w-8 h-10 bg-gray-800 rounded border border-gray-600 flex items-center justify-center text-[8px] text-gray-400 z-10">+{cardsToAdd.length - 5}</div>}
                    </div>
                </div>
            )}
        </div>
    );

    // --- MAIN RENDER ---
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col border border-gray-700/50 max-h-[90vh]">

                {/* Header with Progress */}
                <div className="p-6 border-b border-gray-800">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black text-white">
                            {step === STEPS.METHOD && 'Create New Binder'}
                            {step === STEPS.CONFIG && 'Customize Binder'}
                            {step === STEPS.CARDS && 'Select Cards'}
                            {step === STEPS.REVIEW && 'Confirm Creation'}
                        </h2>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${s <= step ? 'bg-indigo-500' : 'bg-gray-800'}`} />
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {step === STEPS.METHOD && renderMethodStep()}
                    {step === STEPS.CONFIG && renderConfigStep()}
                    {step === STEPS.CARDS && (
                        <div className="text-center py-10 text-gray-500">
                            Currently, card selection is handled via Smart Organize or Bulk Select on the table.<br />
                            <button onClick={() => setStep(STEPS.REVIEW)} className="text-indigo-400 underline mt-2">Skip to Confirmation</button>
                        </div>
                    )}
                    {step === STEPS.REVIEW && renderReviewStep()}
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-gray-800 flex justify-between bg-gray-950/30 rounded-b-3xl">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="px-6 py-2.5 font-bold text-gray-400 hover:text-white transition-colors"
                    >
                        {step === 1 ? 'Cancel' : 'Back'}
                    </button>

                    <button
                        onClick={() => {
                            if (step === STEPS.REVIEW) handleCreate();
                            else if (step === STEPS.CONFIG) setStep(STEPS.REVIEW); // Skipping CARDS step manually for now as requested by user logic
                            else setStep(step + 1);
                        }}
                        disabled={loading || (step === STEPS.CONFIG && !name)}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
                    >
                        {loading ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : (
                            step === STEPS.REVIEW ? 'Create Binder' : 'Continue'
                        )}
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
};

export default BinderWizardModal;
