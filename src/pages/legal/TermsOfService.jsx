import React from 'react';
import { useNavigate } from 'react-router-dom';

const TermsOfService = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-900 pb-24 text-gray-300">
            {/* Hero Section */}
            <div className="relative py-24 overflow-hidden">
                <div className="absolute inset-0 bg-primary-900/10"></div>
                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight uppercase italic">
                        Terms of <span className="text-primary-500">Service</span>
                    </h1>
                    <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">Last Updated: February 23, 2026</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 space-y-12 leading-relaxed">
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic border-l-4 border-primary-500 pl-4">1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using The Forge ("MTG-Forge"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic border-l-4 border-primary-500 pl-4">2. Alpha Testing Phase</h2>
                    <p className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-2xl text-orange-200">
                        <strong>Important:</strong> The Forge is currently in an Alpha testing phase. The service is provided "as is" and "as available." Features may be unstable, data may be reset, and service may be interrupted without notice. We provide no warranties regarding the reliability or accuracy of the application during this phase.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic border-l-4 border-primary-500 pl-4">3. User Accounts</h2>
                    <p>
                        You are responsible for maintaining the confidentiality of your account and password. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to terminate accounts at our discretion.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic border-l-4 border-primary-500 pl-4">4. Intellectual Property</h2>
                    <p>
                        The Forge and its original content are the sole property of its creators. Magic: The Gathering and related assets are the property of Wizards of the Coast. We are not affiliated with, endorsed, or sponsored by Wizards of the Coast.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic border-l-4 border-primary-500 pl-4">5. User Conduct</h2>
                    <p>
                        You agree not to use the service for any unlawful purposes or to conduct any activity that would damage, disable, or overburden the service.
                    </p>
                </section>

                <div className="flex justify-center pt-12">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-gray-500 hover:text-white transition-colors text-sm font-bold flex items-center gap-2 group"
                    >
                        <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Go Back
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
