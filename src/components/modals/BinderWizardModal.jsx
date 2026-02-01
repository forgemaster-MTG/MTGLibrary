import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useCollection } from '../../hooks/useCollection';
import { api } from '../../services/api';
import { parseSmartPrompt } from '../../services/smartPromptService';
import RuleBuilder from '../SmartBinder/RuleBuilder';

const STEPS = {
    METHOD: 1,
    CONFIG: 2,
    REVIEW: 3 // Consolidated CARDS into REVIEW/Preview
};

const EMOJIS = [...new Set([
    // Objects & Symbols
    '📁', '📂', '💾', '📦', '🏷️', '💎', '💍', '🏆', '🥇', '🎨', '🔮', '📜', '⚔️', '🛡️', '🔥', '💧', '💀', '🌲', '☀️', '🤝',
    '🃏', '🎲', '🧩', '🧿', '✨', '🌟', '🌈', '🌑', '🌕', '🪐', '☄️', '🧨', '🧧', '🎁', '🎈', '🎏', '🏮', '🎐', '🧸', '🪄',
    '🧪', '🧬', '🔭', '🩺', '🧱', '⛓️', '🪚', '🪓', '⛏️', '⚒️', '🛠️', '⚙️', '⚖️', '🗝️', '🔐', '🔒', '🔓', '🔏', '✒️', '📝',
    '👑', '🎩', '🎒', '👓', '🕶️', '🥽', '💰', '💴', '💵', '💶', '💷', '🪙', '💳', '🧾', '🕯️', '💡', '🔦', '🏮', '📔', '📕',
    // Nature & Elements
    '🌵', '🌴', '🌲', '🌳', '🌱', '🌿', '☘️', '🍀', '🍃', '🍂', '🍁', '🍄', '🐚', '🪨', '🪵', '🔥', '💧', '🌊', '🌪️', '❄️',
    '🌩️', '⚡', '🌋', '🗻', '🏜️', '🏝️', '🌅', '🌄', '🌠', '🌌', '🌍', '🌝', '🌚', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗',
    // Creatures (Basic)
    '🦅', '🦆', '🦢', '🦉', '🦩', '🦚', '🦜', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🐟',
    '🐠', '🐡', '🦈', '🐙', '🐚', '🐌', '🦋', '🐛', '🐜', '🐝', '🪲', '🐞', '🦗', '🕷️', '🕸️', '🦂', '🦟', '🪰', '🪱', '🦠',
    // Creatures (Mammals/Myth)
    '🐺', '🦊', '🦝', '🐱', '🦁', '🐯', '🐆', '🐴', '🦄', '🦓', '🦌', '🦬', '🐮', '🐂', '🐃', '🐄', '🐷', '🐏', '🐑', '🐐',
    '🐪', '🐫', '🦙', '🦒', '🐘', '🦣', '🦏', '🦛', '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🐿️', '🦫', '🦔', '🦇', '🐻', '🐨',
    '🐼', '🦥', '🦦', '🦨', '🦘', '🦡', '👹', '👺', '👻', '👽', '👾', '🤖', '💩',
    // Expressions/People
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
    '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
    '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '🦾', '🦿', '👣',
    // UI/Abstract
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑',
    '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴',
    '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯',
    '🚳', '🚱', '🔞', '📵', '🚭', '❗️', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️',
    '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃',
    '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕',
    '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️',
    '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️',
    '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱'
])];

const BinderWizardModal = ({ isOpen, onClose, selectedCards = [], editingBinder = null }) => {
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
    const [rules, setRules] = useState([]);
    const [isSmartBinder, setIsSmartBinder] = useState(false);

    // New Flags
    const [isPublic, setIsPublic] = useState(false);
    const [isTrade, setIsTrade] = useState(false);


    // Initial Setup
    useEffect(() => {
        if (isOpen) {
            if (editingBinder) {
                setStep(STEPS.CONFIG);
                setName(editingBinder.name || '');
                setType(editingBinder.type || 'collection');
                setIconType(editingBinder.icon_type || 'emoji');
                setIconValue(editingBinder.icon_value || '📁');
                setColor(editingBinder.color_preference || 'blue');
                let initialRules = [];
                try {
                    const parsed = editingBinder.rules ? (typeof editingBinder.rules === 'string' ? JSON.parse(editingBinder.rules) : editingBinder.rules) : [];
                    initialRules = Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    console.error("Failed to parse binder rules", e);
                }
                setRules(initialRules);
                setIsSmartBinder(!!editingBinder.rules);
                setIsPublic(!!editingBinder.is_public);
                setIsTrade(!!editingBinder.is_trade);
                setCardsToAdd([]);
            } else {
                setStep(STEPS.METHOD);
                setName('');
                setType('collection');
                setIconType('emoji');
                setIconValue('📁');
                setColor('blue');
                setCardsToAdd(selectedCards || []);
                setRules([]);
                setIsSmartBinder(false);
                setIsPublic(false);
                setIsTrade(false);
            }
            setSmartSuggestions([]);
        }
    }, [isOpen, editingBinder]);

    // --- LOGIC: Smart Scan (Suggestions as Rules) ---
    const [smartSuggestions, setSmartSuggestions] = useState([]);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // --- LOGIC: AI Prompt Generator ---
    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        setSmartSuggestions([]); // Clear previous suggestions

        // Simulation of AI processing (using advanced local parser)
        setTimeout(() => {
            const suggestion = parseSmartPrompt(aiPrompt);
            setSmartSuggestions([suggestion]);
            setIsGenerating(false);
        }, 800);
    };

    const handleSuggestionSelect = (suggestion) => {
        setName(suggestion.name);
        setIconValue(suggestion.icon);
        setColor(suggestion.color);
        setRules(suggestion.rules);
        setIsSmartBinder(true);
        setStep(STEPS.CONFIG);
    };

    // --- ACTION: Create ---
    const handleCreate = async () => {
        setLoading(true);
        try {
            const binderPayload = {
                name,
                type,
                icon_type: iconType,
                icon_value: iconValue,
                color_preference: color,
                rules: isSmartBinder ? rules : null,
                is_public: isPublic,
                is_trade: isTrade
            };

            let binderId;
            if (editingBinder) {
                await api.updateBinder(editingBinder.id, binderPayload);
                binderId = editingBinder.id;
            } else {
                const binderRes = await api.post('/api/binders', binderPayload);
                binderId = binderRes.id;
            }

            // Add manual cards if any
            if (cardsToAdd.length > 0) {
                const cardIds = cardsToAdd.map(c => c.firestoreId || c.id);
                await api.put('/api/collection/batch-update', {
                    cardIds,
                    binderId: binderId
                });
            }

            addToast(editingBinder ? 'Binder updated!' : 'Binder created successfully!', 'success');
            onClose();
        } catch (err) {
            console.error('[BinderWizard] Submit error:', err);
            addToast('Failed to save binder', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editingBinder) return;
        if (!window.confirm(`Are you sure you want to delete "${editingBinder.name}"? This will NOT delete the cards inside.`)) return;

        setLoading(true);
        try {
            await api.deleteBinder(editingBinder.id);
            addToast('Binder deleted', 'success');
            onClose();
        } catch (err) {
            console.error('[BinderWizard] Delete error:', err);
            addToast('Failed to delete binder', 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- RENDERERS ---

    const renderMethodStep = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={() => { setIsSmartBinder(false); setStep(STEPS.CONFIG); }}
                    className="p-6 bg-gray-950/40 hover:bg-indigo-900/10 border border-white/5 hover:border-indigo-500/50 rounded-3xl text-left transition-all group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-xl">📁</div>
                    <h3 className="text-xl font-black text-white mb-2">Manual Binder</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">Classic storage. Move cards in and out exactly how you want.</p>
                </button>

                <div className="p-6 bg-indigo-950/20 border border-indigo-500/20 rounded-3xl relative overflow-hidden flex flex-col h-full">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" /></svg>
                    </div>

                    <div className="relative z-10 flex flex-col h-full">
                        <div className="w-14 h-14 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-xl shadow-indigo-900/20">✨</div>
                        <h3 className="text-xl font-black text-white mb-2">Smart Creator</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">Describe what you want, and AI will build the rules for you. <button onClick={() => window.open('https://github.com/TristinParker/MTGLibrary/blob/main/docs/SMART_BINDERS.md', '_blank')} className="text-indigo-400 hover:text-indigo-300 underline md:hidden">What is this?</button></p>

                        <div className="mt-auto">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder='e.g., "Red Goblins over $5"'
                                    className="w-full bg-black/40 border border-indigo-500/30 rounded-xl pl-4 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                                />
                                <button
                                    onClick={handleAiGenerate}
                                    disabled={!aiPrompt.trim() || isGenerating}
                                    className="absolute right-1 top-1 bottom-1 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center justify-center"
                                >
                                    {isGenerating ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart Suggestions Expansion */}
            {(isGenerating || smartSuggestions.length > 0) && (
                <div className="mt-8 space-y-4 animate-fade-in-up">
                    <div className="flex items-center gap-4">
                        <div className="h-px bg-white/10 flex-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Suggested Blueprints</span>
                        <div className="h-px bg-white/10 flex-1" />
                    </div>

                    {isGenerating ? (
                        <div className="py-8 flex flex-col items-center">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                            <p className="mt-4 text-indigo-400 font-mono text-xs animate-pulse">Generating rules...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {smartSuggestions.map(suggest => (
                                <button
                                    key={suggest.id}
                                    onClick={() => handleSuggestionSelect(suggest)}
                                    className="p-4 bg-gray-900/60 hover:bg-gray-800 border border-white/5 hover:border-indigo-500/30 rounded-2xl flex items-center gap-4 transition-all text-left group shadow-lg"
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110`} style={{ backgroundColor: `rgba(${suggest.color === 'purple' ? '139, 92, 246' : suggest.color === 'green' ? '16, 185, 129' : suggest.color === 'orange' ? '249, 115, 22' : '239, 68, 68'}, 0.1)` }}>
                                        {suggest.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-white text-sm">{suggest.name}</div>
                                        <div className="text-[10px] text-gray-500 leading-tight">{suggest.description}</div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderConfigStep = () => (
        <div className="space-y-8 max-w-xl mx-auto">
            {/* Basic Info */}
            <div className="space-y-4">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Binder Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., The Vault"
                        autoFocus
                        className="w-full bg-gray-950 border-2 border-white/5 focus:border-indigo-500/50 text-white px-5 py-4 rounded-2xl focus:outline-none font-black text-xl transition-all shadow-inner shadow-black/40 placeholder:text-gray-800"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Icon Type</label>
                        <div className="flex bg-gray-950 p-1 rounded-xl border border-white/5">
                            <button onClick={() => setIconType('emoji')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${iconType === 'emoji' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Emoji</button>
                            <button onClick={() => setIconType('mtg')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${iconType === 'mtg' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Symbols</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Theme Color</label>
                        <div className="flex gap-2 bg-gray-950 p-2 rounded-xl border border-white/5 overflow-x-auto custom-scrollbar no-scrollbar items-center">
                            {['blue', 'red', 'green', 'purple', 'orange', 'gray'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className={`w-6 h-6 shrink-0 rounded-full transition-all ${color === c ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-40 hover:opacity-100'}`}
                                    style={{ backgroundColor: c === 'blue' ? '#3B82F6' : c === 'red' ? '#EF4444' : c === 'green' ? '#10B981' : c === 'purple' ? '#8B5CF6' : c === 'orange' ? '#F59E0B' : '#6B7280' }}
                                />
                            ))}
                            <div className="w-px h-6 bg-white/10 mx-1" />
                            <div className="relative group">
                                <div className={`w-6 h-6 rounded-full border border-white/20 flex items-center justify-center overflow-hidden ${!['blue', 'red', 'green', 'purple', 'orange', 'gray'].includes(color) ? 'ring-2 ring-white' : ''}`}>
                                    <input
                                        type="color"
                                        value={['blue', 'red', 'green', 'purple', 'orange', 'gray'].includes(color) ? '#ffffff' : color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="w-8 h-8 -m-1 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Icon Picker Expanded */}
            <div className="bg-gray-950 rounded-3xl p-5 border border-white/5 shadow-inner shadow-black/40">
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-3 h-40 overflow-y-auto custom-scrollbar pr-2">
                    {iconType === 'emoji' ? (
                        EMOJIS.map(icon => (
                            <button
                                key={icon}
                                onClick={() => setIconValue(icon)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${iconValue === icon ? 'bg-indigo-600 shadow-lg shadow-indigo-900/40' : 'bg-gray-900 border border-white/5 text-gray-500 hover:bg-gray-800 hover:text-white'}`}
                            >
                                {icon}
                            </button>
                        ))
                    ) : (
                        [
                            // Colors
                            'ms-w', 'ms-u', 'ms-b', 'ms-r', 'ms-g', 'ms-c', // Basic
                            'ms-wp', 'ms-up', 'ms-bp', 'ms-rp', 'ms-gp', // Phyrexian
                            'ms-s', 'ms-x', 'ms-e', // Snow, X, Energy
                            // Card Types
                            'ms-planeswalker', 'ms-land', 'ms-artifact', 'ms-enchantment', 'ms-creature', 'ms-instant', 'ms-sorcery', 'ms-multiple',
                            // Guilds
                            'ms-guild-azorius', 'ms-guild-selesnya', 'ms-guild-boros', 'ms-guild-dimir', 'ms-guild-simic', 'ms-guild-gruul', 'ms-guild-rakdos', 'ms-guild-orzhov', 'ms-guild-izzet', 'ms-guild-golgari',
                            // Wedges/Shards
                            'ms-clan-abzan', 'ms-clan-jeskai', 'ms-clan-sultai', 'ms-clan-mardu', 'ms-clan-temur',
                            'ms-shard-bant', 'ms-shard-esper', 'ms-shard-grixis', 'ms-shard-jund', 'ms-shard-naya',
                            // Sets/Symbols
                            'ms-p', 'ms-chaos', 'ms-loyalty-up', 'ms-loyalty-down', 'ms-loyalty-zero',
                            'ms-tap', 'ms-untap', 'ms-flashback', 'ms-dfc-day', 'ms-dfc-night'
                        ].map(icon => (
                            <button
                                key={icon}
                                onClick={() => setIconValue(icon)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${iconValue === icon ? 'bg-indigo-600 shadow-lg shadow-indigo-900/40 text-white' : 'bg-gray-900 border border-white/5 text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                            >
                                <i className={`ms ${icon} ms-cost`}></i>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Smart Rules Toggle */}
            <div className="bg-gray-950 rounded-3xl p-6 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-colors ${isSmartBinder ? 'bg-indigo-600/20 text-indigo-400' : 'bg-gray-800 text-gray-500'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm">Automated Smart Rules</h3>
                            <p className="text-[10px] text-gray-500">Auto-organize collection based on conditions.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSmartBinder(!isSmartBinder)}
                        className={`w-12 h-6 rounded-full transition-all relative ${isSmartBinder ? 'bg-indigo-600' : 'bg-gray-800'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${isSmartBinder ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                {isSmartBinder && (
                    <div className="pt-4 border-t border-white/5 animate-fade-in">
                        <RuleBuilder rules={rules} onChange={setRules} />
                    </div>
                )}
            </div>

            {/* Visibility Settings */}
            <div className="grid grid-cols-2 gap-4">
                {/* Public Toggle */}
                <div
                    onClick={() => setIsPublic(!isPublic)}
                    className={`p-4 rounded-3xl border border-white/5 cursor-pointer transition-all ${isPublic ? 'bg-green-900/20 border-green-500/30' : 'bg-gray-950/40 hover:bg-gray-900'}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPublic ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </div>
                        <span className={`text-sm font-bold ${isPublic ? 'text-green-400' : 'text-gray-400'}`}>Public</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">Visible to anyone viewing your profile.</p>
                </div>

                {/* Trade Toggle */}
                <div
                    onClick={() => setIsTrade(!isTrade)}
                    className={`p-4 rounded-3xl border border-white/5 cursor-pointer transition-all ${isTrade ? 'bg-amber-900/20 border-amber-500/30' : 'bg-gray-950/40 hover:bg-gray-900'}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isTrade ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-600'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </div>
                        <span className={`text-sm font-bold ${isTrade ? 'text-amber-400' : 'text-gray-400'}`}>Trade Binder</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">Marked for trading in your Pod.</p>
                </div>
            </div>
        </div>
    );

    const renderReviewStep = () => (
        <div className="text-center py-10 space-y-8 animate-fade-in">
            <div className="relative inline-block">
                <div className={`absolute inset-0 bg-${color}-500/20 blur-3xl rounded-full scale-150 animate-pulse`} />
                <div className={`relative w-32 h-32 bg-gray-900 border-4 border-white/10 rounded-[2.5rem] flex items-center justify-center text-6xl shadow-2xl z-10 overflow-hidden`}>
                    {/* Gloss effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                    {iconValue.startsWith('ms') ? <i className={`ms ${iconValue} ms-2x`}></i> : iconValue}
                </div>
                <div className={`absolute -bottom-2 -right-2 px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full shadow-lg border border-white/20 z-20`}>
                    {isSmartBinder ? 'Smart' : 'Manual'}
                </div>
            </div>

            <div>
                <h2 className="text-4xl font-black text-white mb-2 leading-tight">{name || 'Unnamed Binder'}</h2>
                <p className="text-gray-500 text-sm">{isSmartBinder ? `Smart Binder with ${rules.length} rule(s)` : 'Curated collection binder'}</p>
            </div>

            {/* Preview Section */}
            <div className="bg-gray-950/40 rounded-3xl p-6 border border-white/5 max-w-sm mx-auto shadow-inner shadow-black/60">
                {isSmartBinder ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-indigo-400">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Recipe Preview</span>
                        </div>
                        <div className="space-y-2">
                            {rules.map((r, i) => (
                                <div key={i} className="text-xs text-gray-400 bg-black/40 p-2 rounded-xl border border-white/5 flex gap-2">
                                    <span className="font-bold text-gray-500 uppercase">{i === 0 ? 'IF' : 'AND'}</span>
                                    <span>{r.field} <span className="text-indigo-400">{r.operator}</span> '{Array.isArray(r.value) ? r.value.join(', ') : r.value}'</span>
                                </div>
                            ))}
                            {rules.length === 0 && <p className="text-xs text-red-400 italic">Warning: No rules defined! This binder will be empty.</p>}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <span>Selected Cards</span>
                            <span>{cardsToAdd.length}</span>
                        </div>
                        {cardsToAdd.length > 0 ? (
                            <div className="flex -space-x-3 overflow-hidden py-2 justify-center">
                                {cardsToAdd.slice(0, 5).map(c => (
                                    <img key={c.id} src={c.image_uris?.small} alt="" className="w-12 h-16 rounded-lg border-2 border-gray-900 object-cover shadow-lg" />
                                ))}
                                {cardsToAdd.length > 5 && (
                                    <div className="w-12 h-16 rounded-lg border-2 border-gray-900 bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500">
                                        +{cardsToAdd.length - 5}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-xs text-gray-500 italic border border-dashed border-gray-800 rounded-xl">
                                Empty Binder
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Visibility Settings Verification */}
            <div className="flex justify-center gap-4">
                {isPublic && (
                    <span className="text-[10px] bg-green-900/30 text-green-400 px-3 py-1 rounded-full border border-green-900/50 flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Public Visible
                    </span>
                )}
                {isTrade && (
                    <span className="text-[10px] bg-amber-900/30 text-amber-400 px-3 py-1 rounded-full border border-amber-900/50 flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        Trade Binder
                    </span>
                )}
            </div>
        </div>
    );


    // --- MAIN RENDER ---
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-fade-in">
            <div className="bg-gray-950 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden relative">

                {/* Visual Accent */}
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-${color}-500 blur-md opacity-30`} />

                {/* Header Section */}
                <div className="p-8 pb-4 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Step 0{step}</span>
                            <div className="h-px w-8 bg-indigo-500/30" />
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tight">
                            {step === STEPS.METHOD ? 'Initialize Binder' : step === STEPS.CONFIG ? 'Configure Profile' : 'Final Review'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content Section */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-4 no-scrollbar">
                    {step === STEPS.METHOD && renderMethodStep()}
                    {step === STEPS.CONFIG && renderConfigStep()}
                    {step === STEPS.REVIEW && renderReviewStep()}
                </div>

                {/* Footer Section */}
                <div className="p-8 pt-4 flex items-center justify-between">
                    <div className="flex gap-4">
                        <button
                            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                            className="px-6 py-3 font-black text-gray-500 hover:text-white transition-colors text-xs uppercase tracking-widest active:scale-95"
                        >
                            {step === 1 ? 'Cancel' : 'Back'}
                        </button>

                        {editingBinder && step === STEPS.CONFIG && (
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="px-4 py-3 text-[10px] font-black text-red-500/60 hover:text-red-500 transition-colors uppercase tracking-[0.2em] flex items-center gap-2 bg-red-500/5 rounded-xl border border-red-500/10 hover:border-red-500/30"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Delete
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            if (step === STEPS.REVIEW) handleCreate();
                            else setStep(step + 1);
                        }}
                        disabled={loading || (step === STEPS.CONFIG && !name)}
                        className={`group px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${loading
                            ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            : `bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl shadow-indigo-900/40 active:scale-95 flex items-center gap-3`
                            }`}
                    >
                        {loading ? (
                            <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                            <>
                                {step === STEPS.REVIEW ? (editingBinder ? 'Push Changes' : 'Initialize') : 'Proceed'}
                                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" /></svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BinderWizardModal;
