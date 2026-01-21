import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { WelcomeStep, SubscriptionStep, AISetupStep, WalkthroughStep } from '../components/onboarding/OnboardingSteps';
import { HelperForgeStep } from '../components/onboarding/HelperForgeStep';
import { HelpSystemStep } from '../components/onboarding/HelpSystemStep';
import { AddFirstCardsStep } from '../components/onboarding/AddFirstCardsStep';
import PlaystyleWizardModal from '../components/modals/PlaystyleWizardModal';
import { api } from '../services/api';
import { TIERS } from '../config/tiers';

const OnboardingPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { userProfile, updateSettings, refreshUserProfile } = useAuth();
    // Initialize step from saved settings or default to 0
    const [step, setStep] = useState(userProfile?.settings?.onboarding_step || 0);
    const [isPlaystyleConfiguring, setIsPlaystyleConfiguring] = useState(false);

    // Organization State
    const [selectedArchetype, setSelectedArchetype] = useState(null);
    const [customSort, setCustomSort] = useState([null, null, null, null]);
    const [orgSubStep, setOrgSubStep] = useState(1);
    const [savingOrg, setSavingOrg] = useState(false);

    // Check for Stripe return
    useEffect(() => {
        const success = searchParams.get('success');
        if (success === 'true' && step <= 1) {
            // User returned from Stripe successfully
            const advanceStep = async () => {
                try {
                    // Force sync with Stripe to get new Tier
                    await api.post('/api/payments/sync-subscription');
                    await refreshUserProfile(); // Update local context
                } catch (e) {
                    console.error("Sync failed", e);
                }

                await updateSettings({
                    subscription_status: 'active',
                    onboarding_step: 2
                });
                setStep(2);
                setSearchParams({}); // Clear query params
            };
            advanceStep();
        }
    }, [searchParams, step, updateSettings, setSearchParams]);

    const ARCHETYPES = [
        {
            id: 'deckbuilder',
            name: "The Deckbuilder",
            description: "Optimized for brewing and gameplay. Find specific effects and colors instantly.",
            features: [
                "Sort by Color Identity & Type",
                "Group by Card Color",
                "Best for: Commander players",
                "Fastest to find game pieces"
            ],
            icon: "🛠️",
            sort: ['color_identity', 'type', 'cmc', 'name'],
            grouping: 'color'
        },
        {
            id: 'collector',
            name: "The Collector",
            description: "Traditional binder organization. Perfect for tracking set completion and variants.",
            features: [
                "Sort by Set & Collector Number",
                "Group by Expansion Set",
                "Best for: Set completists",
                "Matches physical binder layouts"
            ],
            icon: "📚",
            sort: ['set', 'collector_number', 'name'],
            grouping: 'set'
        },
        {
            id: 'hybrid',
            name: "The Hybrid",
            description: "The best of both. Keep your bulk in boxes and your staples in binders.",
            features: [
                "Bulk sorted by Set (Boxes)",
                "Smart Binders for Rares/Foils",
                "Best for: Large collections",
                "Separates value from bulk"
            ],
            icon: "⚡",
            sort: ['set', 'collector_number'], // Bulk default
            grouping: 'set',
            hasSmartBinders: true
        },
        {
            id: 'advanced',
            name: "Advanced",
            description: "Complete control. Define your own sorting and priority hierarchy.",
            features: [
                "Custom Sort Logic (Max 4 layers)",
                "User-defined Grouping",
                "Best for: Specific needs",
                "Full granularity control"
            ],
            icon: "⚙️",
            sort: [], // Custom
            grouping: 'custom'
        }
    ];

    // Step Order:
    // 0: Welcome
    // 1: Subscription (Was Support)
    // 2: AI Setup (Info/Enable)
    // 3: Organization (Was 3)
    // 4: Forge Helper (Persona)
    // 5: Playstyle (Modal flow)
    // 6: Walkthrough (Carousel)

    const handleNext = async () => {
        const nextStep = step + 1;
        setStep(nextStep);
        await updateSettings({ onboarding_step: nextStep });
    };

    const handleBack = async () => {
        const prevStep = Math.max(0, step - 1);
        setStep(prevStep);
        await updateSettings({ onboarding_step: prevStep });
    };

    const handleHelperForgeComplete = async (helperProfile) => {
        const nextStep = step + 1;
        setStep(nextStep);
        await updateSettings({
            helper: helperProfile,
            onboarding_step: nextStep
        });
    };

    const handleSubscriptionComplete = async (tierId, interval) => {
        if (tierId === TIERS.FREE || tierId === 'free') {
            const nextStep = step + 1;
            setStep(nextStep);
            await updateSettings({
                subscription_tier: 'free',
                onboarding_step: nextStep
            });
            return;
        }

        // Paid Tier
        try {
            const response = await api.post('/api/payments/create-checkout-session', {
                tierId,
                interval,
                successUrl: `${window.location.origin}/onboarding?success=true`,
                cancelUrl: `${window.location.origin}/onboarding?canceled=true`
            });
            if (response.url) window.location.href = response.url;
        } catch (error) {
            console.error('Subscription error:', error);
            alert('Failed to start checkout. Please try again.');
        }
    };

    const handleAISetupComplete = async (apiKey) => {
        const nextStep = step + 1;
        setStep(nextStep);
        await updateSettings({
            ai_enabled: !!apiKey,
            geminiApiKey: apiKey || undefined,
            onboarding_step: nextStep
        });
    };

    // Organization Handlers
    const saveOrgSettings = async (arch, sort, group) => {
        setSavingOrg(true);
        try {
            const settings = {
                organization: {
                    mode: arch.id,
                    sortHierarchy: sort.filter(Boolean),
                    groupingPreference: group
                }
            };

            await updateSettings(settings);

            // Move to next step (Helper Forge)
            const nextStep = step + 1;
            setStep(nextStep);
            await updateSettings({ onboarding_step: nextStep });
        } catch (e) {
            console.error(e);
        } finally {
            setSavingOrg(false);
        }
    };

    const handleOrgFinish = () => {
        if (!selectedArchetype) return;

        let sort = selectedArchetype.sort;
        let group = selectedArchetype.grouping;

        if (selectedArchetype.id === 'advanced') {
            sort = customSort;
            if (sort.filter(Boolean).length > 0) {
                const p = sort.filter(Boolean)[0];
                if (['color', 'color_identity'].includes(p)) group = 'color';
                else if (['set', 'release'].includes(p)) group = 'set';
                else if (['type'].includes(p)) group = 'type';
                else if (['rarity'].includes(p)) group = 'rarity';
            }
        }
        saveOrgSettings(selectedArchetype, sort, group);
    };

    const handlePlaystyleStart = () => {
        setIsPlaystyleConfiguring(true);
    };

    const handlePlaystyleComplete = async (profile) => {
        const nextStep = step + 1;
        setStep(nextStep);
        await updateSettings({
            playstyle: profile,
            onboarding_step: nextStep
        });
        await refreshUserProfile();
        setIsPlaystyleConfiguring(false);
    };

    const handlePlaystyleSkip = async () => {
        const nextStep = step + 1;
        setStep(nextStep);
        await updateSettings({ onboarding_step: nextStep });
    };

    const handleFinish = async () => {
        await updateSettings({
            onboarding_complete: true,
            onboarding_step: 8
        }); // Mark complete
        navigate('/dashboard');
    };

    const handleManualEntry = async () => {
        await updateSettings({
            onboarding_complete: true,
            onboarding_step: 8
        });
        navigate('/collection?onboarding=true&openAdd=true');
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <img src="/MTG-Forge_Logo_Background_80.png" alt="Background" className="w-full h-full object-cover opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900/90 to-black/80"></div>
            </div>

            {/* Content Container */}
            <div className="relative z-10 flex-grow flex items-center justify-center p-4">

                {step === 0 && <WelcomeStep onNext={handleNext} />}

                {step === 1 && <SubscriptionStep onNext={handleSubscriptionComplete} onBack={handleBack} currentTier={userProfile?.subscription_tier} />}

                {step === 2 && <AISetupStep onNext={handleAISetupComplete} onBack={handleBack} />}

                {/* STEP 3: Organization */}
                {step === 3 && (
                    <div className="text-center max-w-6xl animate-fade-in-up w-full">
                        {orgSubStep === 1 && (
                            <>
                                <h2 className="text-3xl font-bold text-white mb-2">Organize Your Collection</h2>
                                <p className="text-gray-400 mb-8">How do you want to sort and view your cards?</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto items-stretch">
                                    {ARCHETYPES.map(arch => (
                                        <button
                                            key={arch.id}
                                            onClick={() => {
                                                setSelectedArchetype(arch);
                                                if (arch.id === 'advanced') setOrgSubStep(1.5);
                                                else if (arch.id === 'hybrid') setOrgSubStep(2);
                                                else saveOrgSettings(arch, arch.sort, arch.grouping);
                                            }}
                                            disabled={savingOrg}
                                            className="group relative bg-gray-800/50 hover:bg-gray-800 border-2 border-transparent hover:border-indigo-500 rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl disabled:opacity-50 flex flex-col h-full"
                                        >
                                            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{arch.icon}</div>
                                            <h3 className="text-lg font-bold text-white mb-1">{arch.name}</h3>
                                            <p className="text-xs text-gray-300 mb-3 h-8">{arch.description}</p>

                                            <ul className="text-[10px] text-gray-400 space-y-1.5 mt-auto pt-4 border-t border-gray-700/50">
                                                {arch.features.map((feature, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <span className="text-indigo-500">•</span>
                                                        {feature}
                                                    </li>
                                                ))}
                                            </ul>
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-8">
                                    <button onClick={handleBack} className="text-gray-500 hover:text-white">Back</button>
                                </div>
                            </>
                        )}

                        {orgSubStep === 1.5 && (
                            <div className="max-w-md mx-auto space-y-6">
                                <h3 className="text-xl font-bold text-white">Custom Hierarchy</h3>
                                <div className="space-y-3">
                                    {[0, 1, 2, 3].map(i => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-500 border border-gray-700">{i + 1}</div>
                                            <select
                                                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                value={customSort[i] || ''}
                                                onChange={(e) => {
                                                    const n = [...customSort];
                                                    n[i] = e.target.value;
                                                    setCustomSort(n);
                                                }}
                                            >
                                                <option value="">(None)</option>
                                                <option value="color">Color</option>
                                                <option value="type">Type</option>
                                                <option value="cmc">Mana Value</option>
                                                <option value="set">Set</option>
                                                <option value="rarity">Rarity</option>
                                                <option value="name">Name</option>
                                                <option value="price">Price</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between pt-4">
                                    <button onClick={() => setOrgSubStep(1)} className="text-gray-400 hover:text-white">Back</button>
                                    <button onClick={handleOrgFinish} disabled={savingOrg} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold">
                                        {savingOrg ? 'Saving...' : 'Save Hierarchy'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {orgSubStep === 2 && (
                            <div className="max-w-md mx-auto space-y-6">
                                <h3 className="text-xl font-bold text-white">Hybrid Organization</h3>
                                <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl">
                                    <p className="text-sm text-indigo-300">
                                        Your collection will be grouped by <strong>Set</strong>.
                                    </p>
                                </div>
                                <div className="flex justify-between pt-4">
                                    <button onClick={() => setOrgSubStep(1)} className="text-gray-400 hover:text-white">Back</button>
                                    <button onClick={handleOrgFinish} disabled={savingOrg} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold">
                                        {savingOrg ? 'Saving...' : 'Finish Setup'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === 4 && <HelperForgeStep onNext={handleHelperForgeComplete} onBack={handleBack} />}

                {step === 5 && (
                    <div className="text-center max-w-2xl animate-fade-in-up space-y-8">
                        <div className="w-24 h-24 mx-auto bg-green-500/20 rounded-full flex items-center justify-center ring-1 ring-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                            <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-4">Define Your Playstyle</h2>
                            <p className="text-gray-300">
                                Let us get to know what kind of mage you are.
                                <br />We'll tailor card suggestions and deck strategies to your personal taste.
                            </p>
                        </div>
                        <div className="flex gap-4 justify-center">
                            <button onClick={handleBack} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl font-medium transition-colors border border-gray-700">
                                Back
                            </button>
                            <button onClick={handlePlaystyleStart} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/25">
                                Start Quiz
                            </button>
                            <button onClick={handlePlaystyleSkip} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl font-medium transition-colors border border-gray-700">
                                Skip for Now
                            </button>
                        </div>
                    </div>
                )}

                {step === 6 && <HelpSystemStep onNext={handleNext} onBack={handleBack} />}

                {step === 7 && <AddFirstCardsStep onNext={handleFinish} onManualEntry={handleManualEntry} />}

            </div>

            {/* Progress Dots */}
            <div className="relative z-10 py-8 flex justify-center gap-3">
                {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-indigo-500' : 'w-2 bg-gray-700'}`} />
                ))}
            </div>

            {/* Playstyle Logic - Using the Modal Component but forcing it open effectively */}
            <PlaystyleWizardModal
                isOpen={isPlaystyleConfiguring}
                onClose={() => setIsPlaystyleConfiguring(false)}
                onComplete={handlePlaystyleComplete}
            />

        </div>
    );
};

export default OnboardingPage;
