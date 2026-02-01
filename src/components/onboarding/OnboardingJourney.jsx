import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import GeminiService from '../../services/gemini';
import { achievementService } from '../../services/AchievementService';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Flame, Droplets, Skull, TreeDeciduous, Sun, Hammer, BookOpen, Layers, Zap, Settings } from 'lucide-react';
import { AddFirstCardsStep } from './AddFirstCardsStep';
import { HelperForgeStep } from './HelperForgeStep';
import PlaystyleWizardModal from '../modals/PlaystyleWizardModal';

// Stages of the Journey
const STAGES = {
    FORGE: 'forge',               // Initial "Start the Forge"
    COLLECTION: 'collection',     // [MOVED UP] Add Cards first
    CHOICE: 'choice',             // Branching Path
    ALIGNMENT: 'alignment',       // Playstyle / Color Quiz
    ORGANIZATION: 'organization', // Archetype Selection
    COMPANION: 'companion',       // AI Setup (Helper Forge)
    ASCENSION: 'ascension'        // Trial Unlock & Finish
};

const ARCHETYPES = [
    {
        id: 'deckbuilder',
        name: "The Deckbuilder",
        description: "Optimized for brewing. Find mechanics and colors instantly.",
        icon: Hammer,
        sort: ['color_identity', 'type', 'cmc', 'name'],
        grouping: 'color'
    },
    {
        id: 'collector',
        name: "The Collector",
        description: "Traditional binder organization. Track sets and variants.",
        icon: BookOpen,
        sort: ['set', 'collector_number', 'name'],
        grouping: 'set'
    },
    {
        id: 'hybrid',
        name: "The Hybrid",
        description: "Bulk in boxes, staples in binders. Best of both worlds.",
        icon: Layers,
        sort: ['set', 'collector_number'],
        grouping: 'set'
    },
    {
        id: 'advanced',
        name: "The Artificer",
        description: "Full manual control over sorting hierarchies.",
        icon: Settings,
        sort: [],
        grouping: 'custom'
    }
];

const OnboardingJourney = () => {
    const { userProfile, updateSettings, refreshUserProfile } = useAuth();
    const navigate = useNavigate();
    const [stage, setStage] = useState(STAGES.FORGE);
    const [loading, setLoading] = useState(false);
    const [showPlaystyleModal, setShowPlaystyleModal] = useState(false);

    // Interactive Background State
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({
                x: (e.clientX / window.innerWidth) * 100,
                y: (e.clientY / window.innerHeight) * 100
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // --- Data State ---
    const [messages, setMessages] = useState([]);
    const [preloadedGreeting, setPreloadedGreeting] = useState(null);
    const [familiarName, setFamiliarName] = useState("Oracle");
    const [apiKey, setApiKey] = useState("");

    // --- Pre-load Greeting ---
    // --- Pre-load Greeting ---
    // --- Pre-load Greeting ---
    // (Disabled to save API usage)
    // useEffect(() => { ... }, []);

    // --- Sync Stage with User Profile --- 
    useEffect(() => {
        if (!userProfile?.settings) return;

        const step = userProfile.settings.onboarding_step || 0;
        const complete = userProfile.settings.onboarding_complete;

        if (complete) {
            navigate('/dashboard');
            return;
        }

        // Logic to restore state
        switch (step) {
            case 0: setStage(STAGES.FORGE); break;
            case 1: setStage(STAGES.CHOICE); break;
            case 2: setStage(STAGES.COMPANION); break;
            case 3: setStage(STAGES.ALIGNMENT); break;
            case 4: setStage(STAGES.ORGANIZATION); break;
            case 5: setStage(STAGES.ASCENSION); break;
            case 6: setStage(STAGES.COLLECTION); break;
            default: setStage(STAGES.FORGE); break;
        }
    }, [userProfile?.settings?.onboarding_step, userProfile?.settings?.onboarding_complete]);

    // --- Auto-Open Playstyle Modal ---
    useEffect(() => {
        if (stage === STAGES.ALIGNMENT) {
            setShowPlaystyleModal(true);
        }
    }, [stage]);

    // --- Transitions ---
    const handleForgeStart = async () => {
        // Use preloaded message if available, else standard fallback
        if (preloadedGreeting) {
            setMessages([{ role: 'model', content: preloadedGreeting }]);
        }
        await updateSettings({ onboarding_step: 1 });
        setStage(STAGES.CHOICE);
    };

    const handleJumpIn = async () => {
        await updateSettings({ onboarding_step: 4 });
        setStage(STAGES.ORGANIZATION); // Skip AI
    };

    const handleMaximize = async () => {
        await updateSettings({ onboarding_step: 2 });
        setStage(STAGES.COMPANION); // Do AI Forge First
    };

    const handlePlaystyleRefusal = async () => {
        await updateSettings({ onboarding_step: 4 });
        setStage(STAGES.ORGANIZATION);
    };

    const handlePlaystyleComplete = async (profile) => {
        try {
            await updateSettings({
                playstyle: profile,
                onboarding_step: 4
            });
            await refreshUserProfile(); // Ensure global context has the new playstyle
            setShowPlaystyleModal(false);
            setStage(STAGES.ORGANIZATION);
        } catch (e) {
            console.error(e);
            setStage(STAGES.ORGANIZATION);
        }
    };

    const handleArchetypeSelect = async (arch) => {
        setLoading(true);
        try {
            await updateSettings({
                organization: {
                    mode: arch.id,
                    sortHierarchy: arch.sort,
                    groupingPreference: arch.grouping
                },
                onboarding_step: 5
            });
            setStage(STAGES.ASCENSION);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleHelperForgeComplete = async (helperData) => {
        setLoading(true);
        try {
            await updateSettings({
                ai_enabled: true,
                helper: {
                    name: helperData.name || "Oracle",
                    type: helperData.type || "Mystic Construct",
                    personality: helperData.personality || "Wise, Efficient, Slightly Mystical"
                },
                onboarding_step: 3
            });


            // Unlock AI Achievement
            achievementService.check({ ai_setup_complete: 1 });

            // Go to Alignment (Playstyle) after AI
            setStage(STAGES.ALIGNMENT);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const activateTrial = async () => {
        try {
            await updateSettings({
                subscription_status: 'trial',
                subscription_tier: 'tier_3', // Wizard
                trial_start_date: new Date().toISOString(),
                trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                // Do NOT mark complete yet - collection is next
                onboarding_complete: false,
                onboarding_step: 6
            });
            await refreshUserProfile();

            // Unlock Onboarding Achievement
            achievementService.check({ onboarding_finished: 1 });

            setStage(STAGES.COLLECTION);
        } catch (e) {
            console.error("Trial activation failed", e);
            setStage(STAGES.COLLECTION);
        }
    };

    // --- Renderers ---

    // --- Visual Components ---

    const SparkParticles = () => (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-orange-500/60 rounded-full blur-[1px]"
                    initial={{
                        x: Math.random() * 100 + "%",
                        y: "110%",
                        opacity: 0,
                        scale: 0.5
                    }}
                    animate={{
                        y: "-10%",
                        opacity: [0, 1, 0],
                        scale: [0.5, 1.5, 0.5],
                        x: `calc(${Math.random() * 100}% + ${(Math.random() - 0.5) * 50}px)`
                    }}
                    transition={{
                        duration: 3 + Math.random() * 4,
                        repeat: Infinity,
                        delay: Math.random() * 5,
                        ease: "easeOut"
                    }}
                />
            ))}
        </div>
    );

    const renderForge = () => (
        <div className="flex flex-col items-center justify-center h-screen bg-black relative overflow-hidden">
            {/* Dynamic Background Glow */}
            <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_var(--x)_var(--y),_rgba(234,88,12,0.15)_0%,_transparent_50%)] transition-opacity duration-500"
                style={{ '--x': `${mousePosition.x}%`, '--y': `${mousePosition.y}%` }}
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-900/40 via-black to-black opacity-60"></div>

            <SparkParticles />

            <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 80px rgba(249, 115, 22, 0.6)" }}
                whileTap={{ scale: 0.95 }}
                onClick={handleForgeStart}
                animate={{
                    boxShadow: ["0 0 20px rgba(249, 115, 22, 0.1)", "0 0 40px rgba(249, 115, 22, 0.3)", "0 0 20px rgba(249, 115, 22, 0.1)"]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="relative z-10 w-48 h-48 rounded-full bg-gradient-to-br from-orange-500 to-red-700 flex items-center justify-center group"
            >
                <div className="absolute inset-1 rounded-full bg-black flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-orange-500/10 to-transparent flex items-center justify-center group-hover:from-orange-500/20 transition-all">
                        <Flame className="w-16 h-16 text-orange-500 group-hover:text-orange-400 transition-colors" />
                    </div>
                </div>

                {/* Internal Glow Pulse */}
                <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl group-hover:bg-orange-500/30 transition-all"
                />
            </motion.button>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="absolute top-20 text-orange-500/50 text-xs tracking-[0.5em] uppercase font-bold z-10"
            >
                Welcome to MTG Forge
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-12 text-3xl font-serif text-orange-500 tracking-[0.2em] uppercase z-10 font-bold drop-shadow-[0_2px_10px_rgba(249,115,22,0.3)]"
            >
                Start the Forge
            </motion.h1>
            <p className="text-gray-400 mt-4 text-sm z-10 relative max-w-md text-center leading-relaxed">
                Begin the calibration sequence to unlock your vault.<br />
                <span className="text-gray-600 text-xs mt-2 block">AI Assistance • Organization • Collection Import</span>
            </p>
        </div>
    );

    const renderChoice = () => (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6 relative">
            <div className="absolute inset-0">
                <img src="/MTG-Forge_Logo_Background_80.png" alt="" className="w-full h-full object-cover opacity-10" />
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/95 to-black"></div>
            </div>

            <div className="z-10 max-w-4xl w-full text-center space-y-12">
                <div>
                    <h2 className="text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 mb-4 font-bold">
                        Choose Your Path
                    </h2>
                    <p className="text-gray-400 text-lg">How would you like to enter the Forge?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Fast Track */}
                    <button
                        onClick={handleJumpIn}
                        className="group relative bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700 hover:border-gray-500 rounded-2xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-xl"
                    >
                        <div className="absolute top-4 right-4 text-gray-600 group-hover:text-gray-400">
                            <Zap className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">Jump Right In</h3>
                        <p className="text-gray-400 leading-relaxed mb-6">
                            Skip the arcane rituals. I just want to organize my collection and build decks manually.
                        </p>
                        <div className="text-sm font-bold text-gray-500 group-hover:text-white uppercase tracking-wider flex items-center">
                            Enter Forge <span className="ml-2">→</span>
                        </div>
                    </button>

                    {/* Full Experience */}
                    <button
                        onClick={handleMaximize}
                        className="group relative bg-gradient-to-br from-indigo-900/20 to-purple-900/20 hover:from-indigo-900/40 hover:to-purple-900/40 border border-indigo-500/30 hover:border-indigo-400 rounded-2xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10"
                    >
                        <div className="absolute top-4 right-4 text-indigo-500/50 group-hover:text-indigo-400">
                            <Sparkles className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">Maximize Experience</h3>
                        <p className="text-indigo-200/70 leading-relaxed mb-6">
                            Configure your Personal AI Companion and analyze your playstyle for tailored suggestions.
                        </p>
                        <div className="text-sm font-bold text-indigo-400 group-hover:text-indigo-300 uppercase tracking-wider flex items-center">
                            For the Wizard <span className="ml-2">→</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderAlignment = () => {
        const helperName = userProfile?.settings?.helper?.name || "Oracle";
        const helperPersona = userProfile?.settings?.helper?.personality || "Wise, Efficient";

        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8 pt-24 relative">
                <div className="absolute inset-0">
                    <img src="/MTG-Forge_Logo_Background_80.png" alt="" className="w-full h-full object-cover opacity-10" />
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 via-gray-900/80 to-black"></div>
                </div>

                {/* Oracle Dialogue */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl w-full bg-black/60 backdrop-blur-md border border-orange-500/20 p-6 rounded-2xl mb-8 relative z-10"
                >
                    <div className="flex items-start gap-5">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500/20 to-purple-500/20 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/10">
                            <Sparkles className="w-7 h-7 text-orange-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-orange-400 mb-2 uppercase tracking-wide">{helperName}</h3>
                            <div className="text-lg font-serif leading-relaxed text-gray-200" dangerouslySetInnerHTML={{ __html: messages[0]?.content || preloadedGreeting || "The Forge is lit, Planeswalker. What colors fuel your spark?" }} />
                        </div>
                    </div>
                </motion.div>

                <div className="z-10 text-center max-w-xl">
                    <h2 className="text-3xl font-serif text-white mb-4">Attune Your Playstyle</h2>
                    <p className="text-gray-300 mb-6 leading-relaxed">
                        To forge the perfect experience, we must understand the mana that flows through you.
                        <br />Take the assessment to analyze your magical signature.
                    </p>

                    {/* Auto-open handles this, but keep as fallback */}
                    <div className="flex gap-4 justify-center">
                        <button onClick={() => setShowPlaystyleModal(true)} className="px-8 py-3 bg-indigo-600 rounded-xl font-bold">Re-open Assessment</button>
                    </div>
                </div>

                <PlaystyleWizardModal
                    isOpen={showPlaystyleModal}
                    onClose={() => setShowPlaystyleModal(false)}
                    onComplete={handlePlaystyleComplete}
                    helperName={helperName}
                    helperPersonality={helperPersona}
                />
            </div>
        );
    };

    const renderOrganization = () => (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-8 relative">
            <div className="absolute inset-0">
                <img src="/MTG-Forge_Logo_Background_80.png" alt="" className="w-full h-full object-cover opacity-10" />
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900/95 to-black"></div>
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="z-10 text-center mb-10">
                <h2 className="text-3xl font-serif text-white mb-2">Forge Your Registry</h2>
                <p className="text-gray-400">How should the Oracle organize your collection?</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full z-10">
                {ARCHETYPES.map((arch) => (
                    <motion.button
                        key={arch.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleArchetypeSelect(arch)}
                        disabled={loading}
                        className="bg-gray-800/60 backdrop-blur border border-gray-700 hover:border-indigo-500 rounded-2xl p-6 text-left hover:shadow-2xl hover:shadow-indigo-500/20 transition-all flex flex-col h-full group"
                    >
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-500/30 transition-colors">
                            <arch.icon className="w-6 h-6 text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{arch.name}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">{arch.description}</p>
                    </motion.button>
                ))}
            </div>
        </div>
    );

    const renderCompanion = () => (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-8 relative">
            <div className="absolute inset-0">
                <img src="/MTG-Forge_Logo_Background_80.png" alt="" className="w-full h-full object-cover opacity-10" />
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 via-gray-900/80 to-black"></div>
            </div>

            <div className="w-full max-w-5xl z-10">
                <HelperForgeStep onNext={handleHelperForgeComplete} onBack={() => setStage(STAGES.FORGE)} />
            </div>
        </div>
    );

    const renderAscension = () => (
        <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-8 relative overflow-hidden">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="text-center z-10"
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-64 h-64 mx-auto mb-8 relative"
                >
                    <div className="absolute inset-0 border-4 border-dashed border-amber-500/30 rounded-full" />
                    <div className="absolute inset-4 border-2 border-amber-500/50 rounded-full" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Sun className="w-32 h-32 text-amber-500 animate-pulse" />
                    </div>
                </motion.div>

                <h1 className="text-5xl font-serif text-amber-500 mb-4 tracking-tight">Ascension Complete</h1>
                <p className="text-xl text-gray-400 max-w-lg mx-auto mb-6">
                    Your spark burns bright, Planeswalker.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 max-w-md mx-auto mb-10 text-sm text-amber-200/80">
                    <p className="font-bold text-amber-400 mb-1">14-Day Free Trial Unlocked</p>
                    <p>You will have full access to all Wizard-tier features. No credit card required. Your trial begins immediately upon entry.</p>
                </div>

                <button
                    onClick={activateTrial}
                    className="px-12 py-4 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xl rounded-full shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:shadow-[0_0_50px_rgba(245,158,11,0.6)] transition-all transform hover:scale-105"
                >
                    Enter the Multiverse
                </button>
            </motion.div>
        </div>
    );

    const renderCollection = () => (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
            <div className="absolute inset-0">
                <img src="/MTG-Forge_Logo_Background_80.png" alt="" className="w-full h-full object-cover opacity-10" />
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900/90 to-black"></div>
            </div>
            <div className="z-10 w-full">
                <AddFirstCardsStep
                    onNext={async () => {
                        // THIS IS THE END
                        await updateSettings({
                            onboarding_complete: true,
                            onboarding_step: 7
                        });
                        await refreshUserProfile();
                        navigate('/dashboard');
                    }}
                    onManualEntry={() => navigate('/collection?openAdd=true')}
                />
            </div>
        </div>
    );

    return (
        <div className="font-sans antialiased text-white">
            <AnimatePresence mode="wait">
                {stage === STAGES.FORGE && (
                    <motion.div key="forge" exit={{ opacity: 0 }} className="absolute inset-0">
                        {renderForge()}
                    </motion.div>
                )}
                {stage === STAGES.CHOICE && (
                    <motion.div key="choice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                        {renderChoice()}
                    </motion.div>
                )}
                {stage === STAGES.ALIGNMENT && (
                    <motion.div key="alignment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                        {renderAlignment()}
                    </motion.div>
                )}
                {stage === STAGES.ORGANIZATION && (
                    <motion.div key="org" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                        {renderOrganization()}
                    </motion.div>
                )}
                {stage === STAGES.COMPANION && (
                    <motion.div key="companion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                        {renderCompanion()}
                    </motion.div>
                )}
                {stage === STAGES.ASCENSION && (
                    <motion.div key="ascension" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                        {renderAscension()}
                    </motion.div>
                )}
                {stage === STAGES.COLLECTION && (
                    <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                        {renderCollection()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default OnboardingJourney;

