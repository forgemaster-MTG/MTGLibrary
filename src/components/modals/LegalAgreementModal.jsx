import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LegalAgreementModal = ({ isOpen, onClose }) => {
    const { updateProfileFields } = useAuth();
    const [agreed, setAgreed] = useState(false);
    const [feedbackOptIn, setFeedbackOptIn] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleAccept = async () => {
        if (!agreed) return;
        setLoading(true);
        try {
            await updateProfileFields({
                agreed_to_terms_at: new Date().toISOString(),
                marketing_opt_in: feedbackOptIn
            });
            onClose();
        } catch (err) {
            console.error("Failed to save agreement", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={() => { }} className="relative z-[200]">
            <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-xl w-full bg-gray-900 border border-primary-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    {/* Background accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 blur-3xl rounded-full -mr-16 -mt-16" />

                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-primary-500/20 rounded-2xl text-primary-400">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            </div>
                            <Dialog.Title className="text-3xl font-black text-white uppercase italic tracking-tight">
                                Updated <span className="text-primary-500">Legal</span> Docs
                            </Dialog.Title>
                        </div>

                        <p className="text-gray-300 leading-relaxed">
                            Welcome back to The Forge! To continue using the platform and ensure we are compliant with privacy laws,
                            please review and agree to our updated terms.
                        </p>

                        <div className="space-y-4 pt-2">
                            {/* Required Terms Checkbox */}
                            <label className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                    className="mt-1 w-5 h-5 rounded border-gray-700 bg-gray-800 text-primary-600 focus:ring-primary-500 checked:bg-primary-600 transition-all"
                                />
                                <span className="text-sm text-gray-300 select-none">
                                    I agree to the <Link to="/terms" target="_blank" className="text-primary-400 hover:underline font-bold">Terms of Service</Link> and <Link to="/privacy" target="_blank" className="text-primary-400 hover:underline font-bold">Privacy Policy</Link>.
                                </span>
                            </label>

                            {/* Optional Plea Checkbox */}
                            <label className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={feedbackOptIn}
                                    onChange={(e) => setFeedbackOptIn(e.target.checked)}
                                    className="mt-1 w-5 h-5 rounded border-gray-700 bg-gray-800 text-primary-600 focus:ring-primary-500 checked:bg-primary-600 transition-all"
                                />
                                <div className="space-y-1">
                                    <span className="text-sm text-gray-300 select-none font-bold block">
                                        Help The Forge grow (Optional)
                                    </span>
                                    <span className="text-xs text-gray-500 select-none block leading-relaxed group-hover:text-gray-400 transition-colors">
                                        Your input as an alpha tester directly shapes the platform. We promise <strong>zero sales spam</strong>—only occasional feedback requests to improve your experience.
                                    </span>
                                </div>
                            </label>
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleAccept}
                                disabled={!agreed || loading}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl ${agreed && !loading
                                        ? 'bg-primary-600 text-white hover:bg-primary-500 transform hover:-translate-y-1'
                                        : 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50'
                                    }`}
                            >
                                {loading ? 'Saving...' : 'Accept and Continue'}
                            </button>
                        </div>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default LegalAgreementModal;
