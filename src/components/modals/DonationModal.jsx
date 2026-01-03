import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import { api } from '../../services/api';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CheckoutForm = ({ amount, onCancel, onSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [ready, setReady] = useState(false);

    // Check for live keys on HTTP
    const isLiveOnHttp = import.meta.env.VITE_STRIPE_PUBLIC_KEY?.startsWith('pk_live') &&
        window.location.protocol === 'http:';

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!stripe || !elements) return;

        setProcessing(true);
        const { error: submitError } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.origin + '/dashboard?donation=success',
            },
            redirect: 'if_required'
        });

        if (submitError) {
            setError(submitError.message);
            setProcessing(false);
        } else {
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {isLiveOnHttp ? (
                <div className="bg-amber-900/30 border border-amber-500/50 p-6 rounded-xl text-center space-y-3">
                    <span className="text-3xl">🔒</span>
                    <h3 className="font-bold text-amber-200">HTTPS Required</h3>
                    <p className="text-sm text-gray-400">
                        Live Stripe payments require a secure (HTTPS) connection. Please use <strong>test keys</strong> for local development or deploy to a secure server.
                    </p>
                </div>
            ) : (
                <div className="relative min-h-[100px]">
                    {!ready && <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-xl border border-gray-700 animate-pulse text-gray-500 text-sm">Loading Secure Form...</div>}
                    <PaymentElement
                        onReady={() => setReady(true)}
                        onLoadError={(err) => setError(err.error?.message || "Failed to load payment form.")}
                        className="bg-gray-900 p-4 rounded-xl border border-gray-700"
                    />
                </div>
            )}
            {error && <div className="text-red-500 text-sm mt-2 p-3 bg-red-950/30 border border-red-500/30 rounded-lg">{error}</div>}
            <div className="flex gap-4 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl font-bold transition-all"
                >
                    Change Amount
                </button>
                <button
                    disabled={processing || !stripe}
                    className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50"
                >
                    {processing ? 'Processing...' : `Donate $${amount}`}
                </button>
            </div>
        </form>
    );
};

const DonationModal = ({ isOpen, onClose }) => {
    const [step, setStep] = useState('amount'); // amount, payment, success
    const [amount, setAmount] = useState(10);
    const [clientSecret, setClientSecret] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('stripe');

    useEffect(() => {
        if (!isOpen) {
            setStep('amount');
            setClientSecret('');
            setLoading(false);
        }
    }, [isOpen]);

    const handleAmountSelect = async (val) => {
        setAmount(val);
        setLoading(true);
        try {
            const res = await api.post('/payments/create-intent', { amount: val });
            setClientSecret(res.clientSecret);
            setStep('payment');
        } catch (err) {
            alert('Error creating payment: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-gray-900 border border-gray-700 w-full max-w-lg rounded-3xl flex flex-col max-h-[calc(100vh-4rem)] shadow-2xl animate-fade-in-up overflow-hidden">

                {/* Header - Fixed */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-pink-500 text-2xl">💖</span> Support MTG-Forge
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-grow">
                    {step === 'amount' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="text-center">
                                <p className="text-gray-400 mb-6">Your support helps us keep the servers running and the AI Architect dreaming of new decks.</p>
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    {[5, 10, 20].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setAmount(val)}
                                            className={`py-4 rounded-xl border font-bold transition-all ${amount === val
                                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 scale-105'
                                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                        >
                                            ${val}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(parseFloat(e.target.value) || '')}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-8 pr-4 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Other amount"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => handleAmountSelect(amount)}
                                disabled={loading || !amount || amount < 1}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-1 disabled:opacity-50"
                            >
                                {loading ? 'Loading...' : 'Continue to Payment'}
                            </button>
                        </div>
                    )}

                    {step === 'payment' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Tabs for Payment Methods */}
                            <div className="flex bg-gray-950 p-1 rounded-xl mb-4">
                                {['stripe', 'google', 'paypal'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === tab ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-400'}`}
                                    >
                                        {tab === 'stripe' ? 'Card' : tab === 'google' ? 'Google Pay' : 'PayPal'}
                                    </button>
                                ))}
                            </div>

                            {activeTab === 'stripe' && clientSecret && (
                                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                                    <CheckoutForm
                                        amount={amount}
                                        onCancel={() => setStep('amount')}
                                        onSuccess={() => setStep('success')}
                                    />
                                </Elements>
                            )}

                            {(activeTab === 'google' || activeTab === 'paypal') && (
                                <div className="text-center py-12 space-y-4 animate-pulse">
                                    <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center text-2xl">
                                        {activeTab === 'google' ? '📱' : '💳'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-300 capitalize">{activeTab} Pay Integration</h3>
                                        <p className="text-sm text-gray-500">Coming incredibly soon! Please use Card for now.</p>
                                    </div>
                                    <button
                                        onClick={() => setActiveTab('stripe')}
                                        className="text-indigo-400 text-sm hover:underline font-bold"
                                    >
                                        Back to Card Payment
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center space-y-8 animate-fade-in py-8">
                            <div className="w-24 h-24 mx-auto relative">
                                <div className="absolute inset-0 bg-pink-500 rounded-full animate-ping opacity-20"></div>
                                <div className="relative bg-gradient-to-br from-pink-500 to-rose-600 w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg ring-4 ring-pink-500/20">
                                    🌟
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-4xl font-black text-white tracking-tight">YOU ARE ABSOLUTELY INCREDIBLE!</h3>
                                <div className="space-y-2">
                                    <p className="text-gray-300 text-lg">
                                        From the bottom of our digital hearts, <span className="text-pink-400 font-bold">THANK YOU!</span>
                                    </p>
                                    <p className="text-gray-400 leading-relaxed max-w-xs mx-auto text-sm italic">
                                        "Your generosity fuels the spark of creativity. You're not just a donor; you're a patron of the Multiverse."
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <p className="text-[10px] text-gray-600 uppercase font-black tracking-[0.2em]">Honorary Title Acquired</p>
                                <div className="bg-indigo-500/10 border border-indigo-500/30 py-2 px-4 rounded-full inline-block mx-auto text-indigo-300 font-bold text-sm">
                                    Guardian of the Forge
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all border border-gray-700 mt-4"
                            >
                                Continue Forging
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Info - Fixed */}
                {step !== 'success' && (
                    <div className="bg-gray-950/80 p-4 border-t border-gray-800 text-center flex-shrink-0">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold flex items-center justify-center gap-2">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                            Secure Payments by Stripe
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DonationModal;
