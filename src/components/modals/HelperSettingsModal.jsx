import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GeminiService } from '../../services/gemini';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

// --- Caching Logic ---
const PERSONA_CACHE_KEY = 'mtg_forge_persona_roster';
const PERSONA_FINGERPRINT_KEY = 'mtg_forge_persona_fingerprint';

const PersonaCacheService = {
    get: () => {
        try {
            const cached = localStorage.getItem(PERSONA_CACHE_KEY);
            return cached ? JSON.parse(cached) : null;
        } catch (e) { return null; }
    },
    set: (roster) => {
        try {
            localStorage.setItem(PERSONA_CACHE_KEY, JSON.stringify(roster));
        } catch (e) { console.warn("Cache write failed"); }
    },
    getFingerprint: () => localStorage.getItem(PERSONA_FINGERPRINT_KEY),
    setFingerprint: (fp) => localStorage.setItem(PERSONA_FINGERPRINT_KEY, fp)
};

// --- Child Component: PersonaCard ---
const PersonaCard = ({ persona, isEquipped, isSubscriber, onClick }) => {
    const [fullData, setFullData] = useState(null);
    const [loading, setLoading] = useState(false);
    const isFree = parseFloat(persona.price_usd) === 0;
    const isUnlocked = isFree || isSubscriber;

    useEffect(() => {
        // Optimization: If we already have the personality/avatar OR it's not a preset, don't fetch
        if (!persona.id || persona.is_preset === false || (persona.personality && persona.avatar_url)) {
            setFullData(persona);
            return;
        }

        const loadDetails = async () => {
            setLoading(true);
            try {
                const data = await api.get(`/api/personas/${persona.id}`);
                setFullData(data);
            } catch (err) { console.error("Failed to lazy-load persona", err); }
            finally { setLoading(false); }
        };
        loadDetails();
    }, [persona.id, persona.is_preset]);

    const displayAvatar = fullData?.avatar_url || null;

    return (
        <div
            onClick={() => onClick(fullData || persona)}
            className={`group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/20 aspect-[3/4] flex flex-col ${isEquipped ? 'border-primary-500' : 'border-gray-800 hover:border-primary-500/50'}`}
        >
            {/* BG / Image */}
            <div className="absolute inset-0 bg-gray-900 z-0">
                {displayAvatar ? (
                    <img src={displayAvatar} alt={persona.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                ) : loading ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800 animate-pulse text-primary-500">
                        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-b from-gray-800 to-gray-900 text-gray-700">🤖</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
            </div>

            {/* Labels */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 items-end">
                {isEquipped && <span className="text-[10px] bg-primary-500 text-white font-bold uppercase px-2 py-0.5 rounded shadow-lg">Equipped</span>}
                {!isUnlocked && <span className="text-[10px] bg-gray-800 border border-gray-600 text-gray-300 font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-md"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> Locked</span>}
            </div>

            {/* Text Info */}
            <div className="mt-auto p-4 z-10 relative">
                <h3 className="text-lg font-black text-white leading-tight uppercase tracking-wider translate-z-10">{persona.name}</h3>
                <p className="text-primary-400 text-xs font-bold uppercase opacity-80 mt-1 tracking-widest">{persona.type}</p>
            </div>
        </div>
    );
};

const HelperSettingsModal = ({ isOpen, onClose }) => {
    const { userProfile, refreshUserProfile } = useAuth();

    const [view, setView] = useState('grid'); // 'grid', 'details', 'custom'
    const [personas, setPersonas] = useState(PersonaCacheService.get() || []);
    const [loadingPersonas, setLoadingPersonas] = useState(false);
    const [selectedPersona, setSelectedPersona] = useState(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);

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
            if (personas.length === 0) {
                fetchPersonas();
            } else {
                validateCache();
            }
            setName('');
            setType('');
            setPersonality('');
            setAvatarUrl('');
            setEditingCustomId(null);
            setIsForging(false);
            setChatHistory([]);
            setDraftHelper({});
        }
    }, [isOpen]);

    const customPersonas = Array.isArray(userProfile?.settings?.customHelpers) ? userProfile.settings.customHelpers : [];

    const fetchPersonas = async () => {
        if (personas.length === 0) setLoadingPersonas(true);
        try {
            const data = await api.get('/api/personas'); // Use full path for clarity
            setPersonas(data || []);
            PersonaCacheService.set(data || []);

            // Also update fingerprint
            const fpData = await api.get('/api/personas/fingerprint');
            if (fpData?.fingerprint) PersonaCacheService.setFingerprint(fpData.fingerprint);

        } catch (err) { console.error(err); } finally { setLoadingPersonas(false); }
    };

    const validateCache = async () => {
        try {
            const fpData = await api.get('/api/personas/fingerprint');
            if (fpData?.fingerprint !== PersonaCacheService.getFingerprint()) {
                console.log("[Cache] Update detected, refreshing...");
                fetchPersonas();
            }
        } catch (e) { /* silent fail */ }
    };

    const loadSinglePersonaFull = async (persona) => {
        if (persona.personality && persona.avatar_url) {
            setSelectedPersona(persona);
            setView('details');
            return;
        }

        setLoadingDetails(true);
        setSelectedPersona(persona); // show partial info immediately
        setView('details');
        try {
            const full = await api.get(`/api/personas/${persona.id}`);
            setSelectedPersona(full);
        } catch (e) {
            console.error("[Details Load Error]", e);
        } finally {
            setLoadingDetails(false);
        }
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
                <div className="flex-1 overflow-hidden relative">
                    {/* VIEW: GRID */}
                    {view === 'grid' && (
                        <div className="h-full overflow-y-auto p-6 custom-scrollbar">
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
                                    {personas.map(persona => (
                                        <PersonaCard
                                            key={persona.id}
                                            persona={{ ...persona, is_preset: true }}
                                            isEquipped={currentHelperName === persona.name && userProfile?.settings?.helper?.is_preset}
                                            isSubscriber={isSubscriber}
                                            onClick={loadSinglePersonaFull}
                                        />
                                    ))}

                                    {/* User Custom Personas */}
                                    {customPersonas.map(persona => (
                                        <PersonaCard
                                            key={persona.id}
                                            persona={{ ...persona, is_preset: false }}
                                            isEquipped={currentHelperName === persona.name && !userProfile?.settings?.helper?.is_preset}
                                            isSubscriber={true} // custom are always unlocked if they exist
                                            onClick={(p) => { setSelectedPersona(p); setView('details'); }}
                                        />
                                    ))}

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
                                        className={`group relative rounded-xl overflow-hidden border-2 border-dashed transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl aspect-[3/4] flex flex-col items-center justify-center text-center p-6 ${isCustomForgeAllowed ? 'cursor-pointer border-primary-500/50 hover:border-primary-500 hover:bg-primary-500/5' : 'cursor-not-allowed border-gray-800 opacity-50'}`}
                                    >
                                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-3xl mb-4 border border-gray-700 group-hover:border-primary-500/50 group-hover:scale-110 transition-all shadow-inner">
                                            {isCustomForgeAllowed ? 'Forge' : '🔒'}
                                        </div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-wider">Custom Construct</h3>
                                        <p className="text-gray-500 text-[10px] font-bold uppercase mt-2 max-w-[150px]">Forge your own unique AI helper</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: DETAILS */}
                    {(() => {
                        if (view !== 'details' || !selectedPersona) return null;
                        const isPreset = !!selectedPersona.price_usd || personas.some(p => p.id === selectedPersona.id);
                        const isFree = isPreset && parseFloat(selectedPersona.price_usd) === 0;
                        const isUnlocked = isFree || isSubscriber || customPersonas.some(cp => cp.id === selectedPersona.id);
                        const isEquipped = isPreset
                            ? (userProfile?.settings?.helper?.name === selectedPersona.name && userProfile?.settings?.helper?.is_preset)
                            : (userProfile?.settings?.helper?.name === selectedPersona.name && !userProfile?.settings?.helper?.is_preset);

                        return (
                            <div className="flex-1 w-full relative overflow-hidden flex flex-col">
                                {/* Full Screen Background Image */}
                                <div className="absolute inset-0 z-0">
                                    {selectedPersona.avatar_url ? (
                                        <img src={selectedPersona.avatar_url} alt={selectedPersona.name} className="w-full h-full object-cover scale-105 blur-[2px] opacity-40" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black"></div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-b from-gray-950/20 via-gray-950/80 to-gray-950"></div>
                                </div>

                                {/* Content Container */}
                                <div className="relative z-10 flex-1 flex flex-col overflow-y-auto custom-scrollbar p-8 lg:p-12">

                                    {/* Header Overlay */}
                                    <div className="mb-12">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-lg ${isUnlocked ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                                                {isUnlocked ? 'Unlocked Construct' : 'Locked Prototype'}
                                            </span>
                                            {isEquipped && <span className="bg-primary-500/20 text-primary-400 border border-primary-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Active</span>}
                                        </div>
                                        <h3 className="text-6xl lg:text-8xl font-black text-white uppercase tracking-tighter leading-none mb-2 drop-shadow-2xl">
                                            {selectedPersona.name}
                                        </h3>
                                        <p className="text-primary-400 text-xl lg:text-2xl font-black uppercase tracking-[0.3em] opacity-80 pl-2">
                                            {selectedPersona.type}
                                        </p>
                                    </div>

                                    {/* Main Grid Layout */}
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                                        {/* Left Side: Status & Actions + Bio */}
                                        <div className="lg:col-span-5 space-y-8">

                                            {/* Status & Action Card */}
                                            <div className="bg-gray-900/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl overflow-hidden group">
                                                <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                                    Status & Deployment
                                                </h4>

                                                <div className="space-y-6">
                                                    <div className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                                                        <span className="text-gray-500 font-bold uppercase tracking-wider text-xs">Access</span>
                                                        <span className={`font-black uppercase tracking-widest text-xs ${isUnlocked ? 'text-green-400' : 'text-amber-500'}`}>
                                                            {isUnlocked ? 'AUTHORIZED' : 'RESTRICTED'}
                                                        </span>
                                                    </div>

                                                    {!isUnlocked && isPreset && (
                                                        <div className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                                                            <span className="text-gray-500 font-bold uppercase tracking-wider text-xs">Cost</span>
                                                            <span className="text-amber-400 font-black text-lg font-mono">
                                                                ${selectedPersona.price_usd}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {isEquipped ? (
                                                        <div className="w-full bg-primary-500/20 text-primary-400 border border-primary-500/50 font-black px-6 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl uppercase tracking-widest text-sm text-center">
                                                            <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                            Construct Active
                                                        </div>
                                                    ) : isUnlocked ? (
                                                        <button
                                                            onClick={() => isPreset ? handleEquipPreset(selectedPersona) : handleEquipCustom(selectedPersona)}
                                                            disabled={saving}
                                                            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-black px-8 py-5 rounded-2xl shadow-2xl shadow-primary-500/30 transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-widest text-sm"
                                                        >
                                                            {saving ? 'Synchronizing...' : 'Deploy Construct'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={handlePurchase}
                                                            disabled={isCheckoutLoading}
                                                            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black px-8 py-5 rounded-2xl shadow-2xl shadow-amber-500/30 transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-3"
                                                        >
                                                            <Sparkles className="w-5 h-5" />
                                                            {isCheckoutLoading ? 'WAITING...' : `Unlock Persona`}
                                                        </button>
                                                    )}

                                                    {!isPreset && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setName(selectedPersona.name);
                                                                    setType(selectedPersona.type);
                                                                    setPersonality(selectedPersona.personality);
                                                                    setAvatarUrl(selectedPersona.avatar_url);
                                                                    setEditingCustomId(selectedPersona.id);
                                                                    setView('custom');
                                                                }}
                                                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white py-3 rounded-xl border border-gray-700 text-[10px] font-black uppercase tracking-widest transition-all"
                                                            >
                                                                Re-Forge
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteCustom(selectedPersona.id)}
                                                                className="bg-red-950/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-3 rounded-xl border border-red-900/30 transition-all"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bio Section */}
                                            <div className="bg-black/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 space-y-4 shadow-xl">
                                                <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                                    <div className="w-6 h-px bg-primary-500/50"></div> Persona Profile
                                                </h4>
                                                <p className="text-gray-200 text-lg leading-relaxed italic font-medium">
                                                    "{selectedPersona.personality}"
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Side: Example Interactions */}
                                        <div className="lg:col-span-7 space-y-6">
                                            <h4 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 ml-2">
                                                <div className="w-6 h-px bg-primary-500/50"></div> Example Interactions
                                            </h4>

                                            {loadingDetails ? (
                                                <div className="flex flex-col items-center justify-center p-20 space-y-4">
                                                    <div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"></div>
                                                    <p className="text-gray-500 font-black uppercase tracking-widest text-xs animate-pulse">Decrypting Blueprint...</p>
                                                </div>
                                            ) : selectedPersona.sample_responses && selectedPersona.sample_responses.length > 0 ? (
                                                <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
                                                    {selectedPersona.sample_responses.map((res, i) => {
                                                        const isObj = typeof res === 'object' && res !== null;
                                                        const userText = isObj ? res.userContent : 'I have a question about my strategy...';
                                                        const aiText = isObj ? res.aiContent : res;
                                                        return (
                                                            <div key={i} className="bg-gray-900/40 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-primary-500/30 transition-all group shadow-xl">
                                                                <div className="flex gap-4">
                                                                    <div className="shrink-0 w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-[10px] font-black text-gray-500 group-hover:text-primary-400 transition-colors uppercase">Q</div>
                                                                    <p className="text-gray-400 text-sm font-medium leading-relaxed">{userText}</p>
                                                                </div>
                                                                <div className="mt-4 pl-12 border-l-2 border-primary-500/20">
                                                                    <div className="flex gap-3 mb-2">
                                                                        <div className="text-[10px] font-black uppercase text-primary-500 tracking-widest">Construct Response</div>
                                                                    </div>
                                                                    <p className="text-gray-300 text-sm italic py-1 leading-relaxed border-t border-white/5 pt-3">
                                                                        "{aiText}"
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="bg-black/20 p-20 rounded-3xl border border-white/5 flex flex-col items-center text-center">
                                                    <div className="text-4xl opacity-20 mb-4">🧩</div>
                                                    <p className="text-gray-500 text-sm font-medium italic">No simulation data available for this model.</p>
                                                </div>
                                            )}
                                        </div>

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
