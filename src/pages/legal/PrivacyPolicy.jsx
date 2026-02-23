import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-900 pb-24 text-gray-300">
            {/* Hero Section */}
            <div className="relative py-24 overflow-hidden">
                <div className="absolute inset-0 bg-primary-900/10"></div>
                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight uppercase italic">
                        Privacy <span className="text-primary-500">Policy</span>
                    </h1>
                    <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">Last Updated: February 23, 2026</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 space-y-12 leading-relaxed">
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic border-l-4 border-primary-500 pl-4">1. Data Collection</h2>
                    <p>
                        We collect minimal personal information necessary to provide our services:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-400">
                        <li><strong>Email Address:</strong> For authentication and account recovery via Firebase.</li>
                        <li><strong>Profile Data:</strong> Names and usernames provided during registration.</li>
                        <li><strong>Usage Data:</strong> Basic logs to help us debug and improve the application.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic border-l-4 border-primary-500 pl-4">2. Use of Data</h2>
                    <p>
                        Your data is used solely for:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-gray-400">
                        <li>Securing your account and access to your data.</li>
                        <li>Platform improvements based on usage patterns.</li>
                        <li>Occasional feedback requests (only if you have opted in).</li>
                    </ul>
                    <p className="italic text-primary-400">We do not sell your personal data to third parties. We do not send marketing or sales spam.</p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic border-l-4 border-primary-500 pl-4">3. Third-Party Services</h2>
                    <p>
                        We use Firebase (Google) for authentication and hosting. Their use of your data is governed by their respective privacy policies.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic border-l-4 border-primary-500 pl-4">4. Your Rights</h2>
                    <p>
                        You may request the deletion of your account and associated data at any time by contacting us via the Support page.
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

export default PrivacyPolicy;
