import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { WelcomeStep, PaymentStep, AISetupStep, WalkthroughStep } from '../components/onboarding/OnboardingSteps';
import { HelperForgeStep } from '../components/onboarding/HelperForgeStep';
import PlaystyleWizardModal from '../components/modals/PlaystyleWizardModal';

const OnboardingPage = () => {
    const navigate = useNavigate();
    const { userProfile, updateSettings, refreshUserProfile } = useAuth();
    // Initialize step from saved settings or default to 0
    const [step, setStep] = useState(userProfile?.settings?.onboarding_step || 0);
    const [isPlaystyleConfiguring, setIsPlaystyleConfiguring] = useState(false);

    // Step Order:
    // 0: Welcome
    // 1: Payment Selection (New)
    // 2: AI Setup (Info/Enable)
    // 3: Forge Helper (Persona)
    // 4: Playstyle (Modal flow)
    // 5: Walkthrough (Carousel)

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

    const handlePaymentComplete = async (planId) => {
        await updateSettings({ subscription_tier: 'alpha_tester' }); // Force alpha for now regardless of selection validation
        handleNext();
    };

    const handleAISetupComplete = async (apiKey) => {
        // Enable AI in settings if key provided
        const updates = {
            ai_enabled: !!apiKey
        };
        if (apiKey) {
            updates.geminiApiKey = apiKey;
        }
        await updateSettings(updates);
        handleNext();
    };

    const handleHelperForgeComplete = async (helperProfile) => {
        await updateSettings({ helper: helperProfile });
        handleNext();
    };

    const handlePlaystyleStart = () => {
        setIsPlaystyleConfiguring(true);
    };

    const handlePlaystyleComplete = async (profile) => {
        await updateSettings({ playstyle: profile });
        await refreshUserProfile();
        setIsPlaystyleConfiguring(false);
        handleNext();
    };

    const handlePlaystyleSkip = () => {
        handleNext();
    };

    const handleFinish = async () => {
        await updateSettings({ onboarding_complete: true, onboarding_step: 6 }); // Mark complete
        navigate('/dashboard');
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

                {step === 1 && <PaymentStep onNext={handlePaymentComplete} onBack={handleBack} />}

                {step === 2 && <AISetupStep onNext={handleAISetupComplete} onBack={handleBack} />}

                {step === 3 && <HelperForgeStep onNext={handleHelperForgeComplete} onBack={handleBack} />}

                {step === 4 && (
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

                {step === 5 && <WalkthroughStep onNext={handleFinish} onBack={handleBack} />}

            </div>

            {/* Progress Dots */}
            <div className="relative z-10 py-8 flex justify-center gap-3">
                {[0, 1, 2, 3, 4, 5].map(i => (
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
