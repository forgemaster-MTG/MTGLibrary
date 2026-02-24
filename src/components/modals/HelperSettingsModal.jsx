import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GeminiService } from '../../services/gemini';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

const HelperSettingsModal = ({ isOpen, onClose }) => {
    const { userProfile, refreshUserProfile } = useAuth();

    const [view, setView] = useState('grid'); // 'grid', 'details', 'custom'
    const [personas, setPersonas] = useState([]);
    const [loadingPersonas, setLoadingPersonas] = useState(true);
    const [selectedPersona, setSelectedPersona] = useState(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

    // Existing Custom Forge State
    const [isForging, setIsForging] = useState(false);
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [personality, setPersonality] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [editingCustomId, setEditingCustomId] = useState(null);
    const [saving, setSaving] = useState(false);

    // Chat Forge State
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [draftHelper, setDraftHelper] = useState({});

    // Image Generation State
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [showImageConfirm, setShowImageConfirm] = useState(false);
    const [pricingConfig, setPricingConfig] = useState(null);

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const data = await api.get('/api/admin/pricing');
                if (data.config) setPricingConfig(data.config);
            } catch (err) { console.error("Failed to load pricing for estimation"); }
        };
        fetchPricing();
    }, []);

    // Persona Checks
    const hasBypassFeatures = userProfile?.settings?.permissions?.includes('bypass_tier_limits') || false;
    const isSubscriber = hasBypassFeatures || ['tier_2', 'tier_3', 'tier_4', 'tier_5'].includes(userProfile?.subscription_tier) || userProfile?.override_tier;
    const isCustomForgeAllowed = hasBypassFeatures || ['tier_3', 'tier_4', 'tier_5'].includes(userProfile?.subscription_tier) || userProfile?.override_tier;

    useEffect(() => {
        if (isOpen) {
            setView('grid');
            fetchPersonas();
            const h = userProfile?.settings?.helper || {};
            setName('');
            setType('');
            setPersonality('');
            setAvatarUrl('');
            setEditingCustomId(null);
            setIsForging(false);
            setChatHistory([]);
            setDraftHelper({});
        }
    }, [isOpen, userProfile]);

    const customPersonas = Array.isArray(userProfile?.settings?.customHelpers) ? userProfile.settings.customHelpers : [];

    const fetchPersonas = async () => {
        setLoadingPersonas(true);
        try {
            const data = await api.getPersonas();
            setPersonas(data || []);
        } catch (err) { console.error(err); } finally { setLoadingPersonas(false); }
    };

    const handleEquipPreset = async (persona) => {
        setSaving(true);
        try {
            const newSettings = {
                ...userProfile.settings,
                helper: {
                    name: persona.name,
                    type: persona.type,
                    personality: persona.personality,
                    avatar_url: persona.avatar_url,
                    is_preset: true,
                    preset_id: persona.id
                }
            };
            await api.updateUser(userProfile.id, { settings: newSettings });
            await refreshUserProfile();
            onClose();
        } catch (err) { alert("Failed to equip persona."); } finally { setSaving(false); }
    };

    const handleSaveCustom = async () => {
        setSaving(true);
        try {
            const currentCustoms = [...customPersonas];
            const helperData = { name, type, personality, avatar_url: avatarUrl, is_preset: false, id: editingCustomId || Date.now().toString() };

            if (editingCustomId) {
                const idx = currentCustoms.findIndex(h => h.id === editingCustomId);
                if (idx >= 0) currentCustoms[idx] = helperData;
                else currentCustoms.push(helperData);
            } else {
                currentCustoms.push(helperData);
            }

            const newSettings = {
                ...userProfile.settings,
                customHelpers: currentCustoms,
                helper: helperData // auto-equip
            };
            await api.updateUser(userProfile.id, { settings: newSettings });
            await refreshUserProfile();
            onClose();
        } catch (err) { alert("Failed to save custom helper."); } finally { setSaving(false); }
    };

    const handleEquipCustom = async (customHelper) => {
        setSaving(true);
        try {
            const newSettings = {
                ...userProfile.settings,
                helper: { ...customHelper }
            };
            await api.updateUser(userProfile.id, { settings: newSettings });
            await refreshUserProfile();
            onClose();
        } catch (err) { alert("Failed to equip custom helper."); } finally { setSaving(false); }
    };

    const handleDeleteCustom = async (customId) => {
        if (!window.confirm("Are you sure you want to delete this custom persona?")) return;
        try {
            const currentCustoms = customPersonas.filter(h => h.id !== customId);
            const newSettings = { ...userProfile.settings, customHelpers: currentCustoms };
            // If they are deleting the currently equipped helper, unequip it
            if (userProfile.settings.helper?.id === customId && !userProfile.settings.helper?.is_preset) {
                newSettings.helper = {}; // clear helper
            }
            await api.updateUser(userProfile.id, { settings: newSettings });
            await refreshUserProfile();
        } catch (err) { alert("Failed to delete custom helper."); }
    };

    const handlePurchase = async () => {
        setIsCheckoutLoading(true);
        try {
            const response = await api.post('/api/payments/create-checkout-session', {
                tierId: 'tier_2', // MAGICIAN tier
                interval: 'monthly'
            });
            if (response.url) {
                window.location.href = response.url;
            } else {
                alert("Failed to initiate checkout. Please visit settings instead.");
                window.location.href = '/settings';
            }
        } catch (err) {
            console.error('Checkout error:', err);
            alert("Error connecting to payment provider.");
        } finally {
            setIsCheckoutLoading(false);
        }
    };

    const handleGenerateAvatar = async (quality = "quality") => {
        if (!name) {
            alert("Please give your persona a Designation (Name) first.");
            return;
        }

        const cost = GeminiService.getImagenCost(quality, pricingConfig?.assumptions || {});
        if (!window.confirm(`Generate an AI Avatar for ${cost.toLocaleString()} credits? This will use the ${quality === 'quality' ? 'Nano Banana Pro' : 'Nano Banana'} model.`)) {
            return;
        }

        setIsGeneratingImage(true);
        try {
            const image = await GeminiService.generateImagen(
                name,
                "AI Helper Persona",
                type,
                null,
                userProfile,
                personality,
                quality
            );
            if (image) setAvatarUrl(image);
        } catch (err) {
            alert("Image generation failed: " + err.message);
        } finally {
            setIsGeneratingImage(false);
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
            history.push({ role: 'user', content: userMsg });

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

    const currentHelperName = userProfile?.settings?.helper?.name || 'Unknown';

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <style>
                {`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: rgba(31, 41, 55, 0.5);
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(16, 185, 129, 0.3);
                        border-radius: 10px;
                        border: 1px solid rgba(16, 185, 129, 0.1);
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(16, 185, 129, 0.5);
                    }
                `}
            </style>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950 shrink-0">
                    <div className="flex items-center gap-4">
                        {view !== 'grid' && (
                            <button onClick={() => setView('grid')} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </button>
                        )}
                        <h2 className="text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-cyan-500 uppercase">
                            {view === 'grid' ? 'Select AI Persona' : view === 'details' ? 'Persona Details' : 'The Custom Forge'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar">
                    {/* VIEW: GRID */}
                    {view === 'grid' && (
                        <div>
                            {!isSubscriber && (
                                <div className="flex flex-col items-center justify-center gap-2 mb-6 text-center">
                                    <p className="text-gray-400 text-sm md:text-base">
                                        Choose your strategic companion. Upgrade to the
                                        <button
                                            onClick={handlePurchase}
                                            disabled={isCheckoutLoading}
                                            className="inline-flex items-center font-black text-amber-500 hover:text-amber-400 transition-colors bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shadow-sm mx-1 hover:shadow-amber-500/20 hover:-translate-y-0.5 hover:scale-105 active:scale-95 group disabled:opacity-50"
                                        >
                                            <span className="mr-1 group-hover:animate-pulse">✨</span>
                                            {isCheckoutLoading ? 'LOADING...' : 'MAGICIAN'}
                                            <span className="ml-1 group-hover:animate-pulse">✨</span>
                                        </button>
                                        tier to unlock the curated roster.
                                    </p>
                                </div>
                            )}
                            {loadingPersonas ? (
                                <div className="flex justify-center items-center py-20 text-primary-500 animate-pulse">Loading roster...</div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

                                    {/* Presets */}
                                    {personas.map(persona => {
                                        const isFree = parseFloat(persona.price_usd) === 0;
                                        const isUnlocked = isFree || isSubscriber;
                                        const isEquipped = currentHelperName === persona.name;

                                        return (
                                            <div
                                                key={persona.id}
                                                onClick={() => { setSelectedPersona(persona); setView('details'); }}
                                                className={`group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/20 aspect-[3/4] flex flex-col ${isEquipped ? 'border-primary-500' : 'border-gray-800 hover:border-primary-500/50'}`}
                                            >
                                                {/* BG / Image */}
                                                <div className="absolute inset-0 bg-gray-900 z-0">
                                                    {persona.avatar_url ? (
                                                        <img src={persona.avatar_url} alt={persona.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-b from-gray-800 to-gray-900">🤖</div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                                                </div>

                                                {/* Labels */}
                                                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 items-end">
                                                    {isEquipped && <span className="text-[10px] bg-primary-500 text-white font-bold uppercase px-2 py-0.5 rounded shadow-lg">Equipped</span>}
                                                    {!isUnlocked && <span className="text-[10px] bg-gray-800 border border-gray-600 text-gray-300 font-bold px-2 py-0.5 rounded flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> Locked</span>}
                                                </div>

                                                {/* Text Info */}
                                                <div className="mt-auto p-4 z-10 relative">
                                                    <h3 className="text-lg font-black text-white leading-tight uppercase tracking-wider">{persona.name}</h3>
                                                    <p className="text-primary-400 text-xs font-bold uppercase opacity-80 mt-1">{persona.type}</p>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* User Custom Personas */}
                                    {customPersonas.map(persona => {
                                        const isEquipped = currentHelperName === persona.name && !userProfile?.settings?.helper?.is_preset;

                                        return (
                                            <div
                                                key={persona.id}
                                                onClick={() => { setSelectedPersona(persona); setView('details'); }}
                                                className={`group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/20 aspect-[3/4] flex flex-col ${isEquipped ? 'border-primary-500' : 'border-gray-800 hover:border-primary-500/50'}`}
                                            >
                                                {/* BG / Image */}
                                                <div className="absolute inset-0 bg-gray-900 z-0 border-primary-900 shadow-inner">
                                                    {persona.avatar_url ? (
                                                        <img src={persona.avatar_url} alt={persona.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-b from-gray-800 to-gray-900">🧬</div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                                                </div>

                                                {/* Labels */}
                                                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 items-end">
                                                    {isEquipped && <span className="text-[10px] bg-primary-500 text-white font-bold uppercase px-2 py-0.5 rounded shadow-lg">Equipped</span>}
                                                    <span className="text-[10px] bg-purple-600/50 text-white font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1 border border-purple-500">Custom</span>
                                                </div>

                                                {/* Text Info */}
                                                <div className="mt-auto p-4 z-10 relative">
                                                    <h3 className="text-lg font-black text-white leading-tight uppercase tracking-wider">{persona.name}</h3>
                                                    <p className="text-primary-400 text-xs font-bold uppercase opacity-80 mt-1">{persona.type}</p>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Custom Forge Card */}
                                    <div
                                        onClick={() => {
                                            if (!isCustomForgeAllowed) return;
                                            setName('');
                                            setType('');
                                            setPersonality('');
                                            setAvatarUrl('');
                                            setEditingCustomId(null);
                                            setView('custom');
                                        }}
                                        className={`group relative ${isCustomForgeAllowed ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'} rounded-xl overflow-hidden border-2 border-primary-600 border-dashed transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/20 aspect-[3/4] flex flex-col bg-gray-950`}
                                    >
                                        <div className="absolute inset-0 flex items-center justify-center z-0 opacity-20 group-hover:opacity-40 transition-opacity">
                                            <svg className="w-24 h-24 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                        </div>
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 items-end">
                                            {!isCustomForgeAllowed && <span className="text-[10px] bg-gray-800 border border-gray-600 text-gray-300 font-bold px-2 py-0.5 rounded flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> Pro ($10+)</span>}
                                        </div>
                                        <div className="mt-auto p-4 z-10 relative bg-gradient-to-t from-gray-950 to-transparent">
                                            <h3 className="text-lg font-black text-white leading-tight uppercase tracking-wider">The Custom Forge</h3>
                                            <p className="text-primary-400 text-xs font-bold uppercase opacity-80 mt-1">Design Your Own</p>
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: DETAILS (Preset & Custom) */}
                    {view === 'details' && selectedPersona && (() => {
                        const isCustom = selectedPersona.is_preset === false;
                        const isFree = isCustom ? true : parseFloat(selectedPersona.price_usd) === 0;
                        const isUnlocked = isCustom ? isCustomForgeAllowed : (isFree || isSubscriber);
                        const isEquipped = currentHelperName === selectedPersona.name && (isCustom ? userProfile?.settings?.helper?.is_preset === false : userProfile?.settings?.helper?.is_preset === true);

                        return (
                            <div className="flex flex-col gap-6 animate-slide-up">
                                {/* Banner Header */}
                                <div className="relative w-full aspect-[21/9] md:aspect-[21/7] rounded-2xl overflow-hidden border border-gray-700 shadow-2xl group shrink-0">
                                    {selectedPersona.avatar_url ? (
                                        <img src={selectedPersona.avatar_url} alt={selectedPersona.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-7xl">🤖</div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent"></div>
                                    <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-between items-end">
                                        <div>
                                            <h3 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] leading-none">{selectedPersona.name}</h3>
                                            <p className="text-primary-400 font-black uppercase mt-2 tracking-widest text-sm md:text-base drop-shadow-md">{selectedPersona.type}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {isUnlocked ? (
                                                <span className="bg-primary-500/20 text-primary-400 border border-primary-500/50 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest backdrop-blur-md">Unlocked</span>
                                            ) : (
                                                <span className="bg-amber-500/20 text-amber-500 border border-amber-500/50 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest backdrop-blur-md">Locked</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Content Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Profile & Description */}
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="bg-gray-800/40 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                                            <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Persona Profile</h4>
                                            <p className="text-white text-xl md:text-2xl font-medium leading-relaxed italic text-gray-100">
                                                "{selectedPersona.personality}"
                                            </p>
                                        </div>

                                        {/* Example Interactions */}
                                        {Array.isArray(selectedPersona.sample_responses) && selectedPersona.sample_responses.length > 0 && (
                                            <div className="space-y-4">
                                                <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] px-2">Example Interactions</h4>
                                                <div className="grid grid-cols-1 gap-4">
                                                    {selectedPersona.sample_responses.map((sample, sIdx) => (
                                                        <div key={sIdx} className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 hover:border-gray-700 transition-all hover:bg-gray-900/80 group">
                                                            <div className="flex gap-4 mb-3">
                                                                <span className="text-gray-500 font-black text-xs uppercase shrink-0 mt-1 tracking-widest">Q</span>
                                                                <p className="text-gray-300 font-medium leading-relaxed">{sample.question || sample.userContent}</p>
                                                            </div>
                                                            <div className="flex gap-4">
                                                                <span className="text-amber-500 font-black text-xs uppercase shrink-0 mt-1 tracking-widest">A</span>
                                                                <p className="text-primary-100 italic leading-relaxed bg-primary-500/5 p-3 rounded-lg border-l-2 border-primary-500/30">"{sample.response || sample.aiContent}"</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Sidebar Actions / Stats */}
                                    <div className="space-y-6">
                                        <div className="bg-gray-800/60 rounded-2xl p-6 border border-gray-700 shadow-xl sticky top-0">
                                            <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Status & Action</h4>

                                            <div className="space-y-4">
                                                <div className="p-4 bg-gray-950 rounded-xl border border-gray-800 flex justify-between items-center group">
                                                    <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Status</span>
                                                    {isUnlocked ? (
                                                        <span className="text-primary-400 font-black text-sm flex items-center gap-2">ACTIVE</span>
                                                    ) : (
                                                        <span className="text-amber-500 font-black text-sm flex items-center gap-2">LOCKED</span>
                                                    )}
                                                </div>

                                                {!isFree && (
                                                    <div className="p-4 bg-gray-950 rounded-xl border border-gray-800 flex justify-between items-center">
                                                        <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">A La Carte</span>
                                                        <span className="text-2xl font-black text-white">${selectedPersona.price_usd}</span>
                                                    </div>
                                                )}

                                                <div className="pt-4">
                                                    {!isUnlocked ? (
                                                        <button
                                                            onClick={handlePurchase}
                                                            disabled={isCheckoutLoading}
                                                            className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black py-4 rounded-xl transition-all shadow-lg uppercase tracking-widest text-xs disabled:opacity-50 active:scale-95"
                                                        >
                                                            {isCheckoutLoading ? 'Processing...' : 'Unlock Now'}
                                                        </button>
                                                    ) : isEquipped ? (
                                                        <button disabled className="w-full bg-primary-600/10 text-primary-500/60 border border-primary-500/20 font-black py-4 rounded-xl uppercase tracking-widest text-xs cursor-default">
                                                            Currently Equipped
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => isCustom ? handleEquipCustom(selectedPersona) : handleEquipPreset(selectedPersona)}
                                                            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-black py-4 rounded-xl transition-all shadow-lg hover:shadow-primary-500/20 uppercase tracking-widest text-xs active:scale-95"
                                                        >
                                                            Equip Persona
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {isCustom && (
                                            <div className="flex flex-col gap-3">
                                                <button
                                                    onClick={() => {
                                                        setName(selectedPersona.name);
                                                        setType(selectedPersona.type);
                                                        setPersonality(selectedPersona.personality);
                                                        setAvatarUrl(selectedPersona.avatar_url);
                                                        setEditingCustomId(selectedPersona.id);
                                                        setView('custom');
                                                    }}
                                                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 border border-gray-700"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    Re-Forge (Edit)
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCustom(selectedPersona.id)}
                                                    className="w-full text-red-500/40 hover:text-red-500 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 py-3 hover:bg-red-500/5 rounded-xl border border-transparent hover:border-red-500/20"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    De-Construct
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* VIEW: CUSTOM FORGE */}
                    {view === 'custom' && (
                        <div className="h-full flex flex-col">
                            {!isCustomForgeAllowed ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-800/50 rounded-xl border border-gray-700">
                                    <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center border border-primary-500/30 text-primary-400 mb-6 drop-shadow-2xl shadow-primary-500/20">
                                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-2 uppercase">Custom Forge Locked</h3>
                                    <p className="text-gray-400 max-w-md mx-auto mb-8">
                                        The raw power of the Custom Forge is reserved for Wizard ($10+) tier subscribers. Upgrade your account to custom-build your own AI companion.
                                    </p>
                                    <button onClick={() => { onClose(); window.location.href = '/pricing'; }} className="bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">
                                        View Subscription Plans
                                    </button>
                                </div>
                            ) : !isForging ? (
                                <div className="space-y-6 flex-1 flex flex-col">
                                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 flex gap-6 items-start">
                                        <div className="w-24 h-24 bg-gray-900 border border-gray-700 rounded-xl flex items-center justify-center text-3xl shadow-lg overflow-hidden shrink-0">
                                            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : '🤖'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-2xl font-bold text-white">{name || 'Unnamed Construct'}</h3>
                                            <p className="text-primary-400 text-sm font-bold uppercase tracking-widest">{type || 'Generic Form'}</p>
                                            <p className="text-gray-400 text-sm italic mt-2 p-3 bg-gray-900/50 rounded-lg border-l-2 border-primary-500 line-clamp-2">"{personality || 'Awaiting instructions.'}"</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                                        <div className="space-y-5">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Designation</label>
                                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none" placeholder="e.g. Dack Fayden" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Class / Form</label>
                                                <input type="text" value={type} onChange={e => setType(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none" placeholder="e.g. Master Thief" />
                                            </div>
                                        </div>
                                        <div className="space-y-5 flex flex-col">
                                            <div className="flex-1 flex flex-col">
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Core Directives (Personality)</label>
                                                <textarea rows="4" value={personality} onChange={e => setPersonality(e.target.value)} className="w-full flex-1 min-h-[100px] bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none resize-none" placeholder="You are sarcastic and snarky..." />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-3">
                                        <div className="flex justify-between items-end">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Avatar URL (Optional)</label>
                                            <div className="flex gap-2 mb-2">
                                                <button
                                                    onClick={() => handleGenerateAvatar('fast')}
                                                    disabled={isGeneratingImage || !name}
                                                    className="text-[10px] bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/50 px-2 py-1 rounded transition-all disabled:opacity-50"
                                                    title={`~${GeminiService.getImagenCost('fast', pricingConfig?.assumptions || {}).toLocaleString()} credits`}
                                                >
                                                    {isGeneratingImage ? '...' : '✨ Fast AI'}
                                                </button>
                                                <button
                                                    onClick={() => handleGenerateAvatar('quality')}
                                                    disabled={isGeneratingImage || !name}
                                                    className="text-[10px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/50 px-2 py-1 rounded transition-all disabled:opacity-50"
                                                    title={`~${GeminiService.getImagenCost('quality', pricingConfig?.assumptions || {}).toLocaleString()} credits`}
                                                >
                                                    {isGeneratingImage ? '...' : '🏆 Pro AI'}
                                                </button>
                                            </div>
                                        </div>
                                        <input type="text" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none text-xs font-mono" placeholder="Image URL..." />
                                    </div>

                                    <div className="flex justify-between pt-6 border-t border-gray-800 shrink-0 mt-auto">
                                        <button onClick={startForge} className="text-primary-400 hover:text-primary-300 font-bold flex items-center gap-2 px-6 py-3 hover:bg-primary-900/20 border border-transparent hover:border-primary-500/30 rounded-xl transition-all uppercase tracking-widest text-sm">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                            AI Guided Forge
                                        </button>
                                        <button onClick={handleSaveCustom} disabled={saving} className="bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 uppercase tracking-widest text-sm flex items-center gap-2">
                                            {saving ? 'Forging...' : 'Equip Custom Build'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full bg-gray-900 shadow-inner rounded-xl overflow-hidden border border-gray-800">
                                    <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 border-b border-gray-800 text-sm flex justify-between items-center text-primary-400 font-bold uppercase tracking-widest">
                                        <span className="flex items-center gap-3"><svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg> The Forge is Active</span>
                                        <button onClick={() => setIsForging(false)} className="text-gray-400 hover:text-white px-3 py-1 rounded bg-gray-800 border border-gray-700 hover:border-gray-500">Abort</button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-6 p-6">
                                        {chatHistory.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm shadow-md' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-sm shadow-md leading-relaxed prose prose-invert prose-sm'}`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                        {chatLoading && (
                                            <div className="flex justify-start"><span className="p-4 bg-gray-800 rounded-2xl rounded-bl-sm border border-gray-700 text-primary-500 font-black tracking-widest animate-pulse">. . .</span></div>
                                        )}
                                    </div>

                                    {(draftHelper.name || draftHelper.type) && (
                                        <div className="bg-gray-950 p-4 border-t border-b border-primary-500/30 flex items-center justify-between gap-6 shrink-0 shadow-[0_-10px_30px_-15px_rgba(16,185,129,0.3)]">
                                            <div className="flex gap-6 divide-x divide-gray-800 overflow-x-auto text-sm">
                                                <div className="px-2"><span className="text-gray-500 block text-[10px] uppercase font-bold tracking-widest">Designation</span> <span className="text-white font-bold">{draftHelper.name || '-'}</span></div>
                                                <div className="px-6"><span className="text-gray-500 block text-[10px] uppercase font-bold tracking-widest">Form</span> <span className="text-primary-400 font-bold">{draftHelper.type || '-'}</span></div>
                                                <div className="px-6 min-w-[200px]"><span className="text-gray-500 block text-[10px] uppercase font-bold tracking-widest">Directives</span> <span className="text-gray-300 italic line-clamp-1">{draftHelper.personality || '-'}</span></div>
                                            </div>
                                            <button onClick={applyForge} className="bg-primary-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-primary-500 shadow-lg shrink-0 uppercase tracking-widest text-xs">Compile & Stop</button>
                                        </div>
                                    )}

                                    <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0">
                                        <div className="flex gap-3 bg-gray-950 p-2 rounded-xl border border-gray-700 shadow-inner">
                                            <input
                                                type="text"
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleForgeSend()}
                                                placeholder="Inject instructions into the forge..."
                                                className="flex-1 bg-transparent px-4 py-2 text-white focus:outline-none placeholder-gray-600 text-sm"
                                            />
                                            <button onClick={handleForgeSend} disabled={chatLoading} className="bg-primary-600 hover:bg-primary-500 p-3 rounded-lg text-white font-bold transition-all disabled:opacity-50">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default HelperSettingsModal;
