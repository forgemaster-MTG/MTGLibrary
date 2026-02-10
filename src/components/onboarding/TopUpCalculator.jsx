import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api';

const TopUpCalculator = ({ dynamicConfig, currentTier, billingInterval, rate, onUpgrade }) => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [desiredDecks, setDesiredDecks] = useState(10);
    const [customCredits, setCustomCredits] = useState(null); // If user types manual credits
    const [isPurchasing, setIsPurchasing] = useState(false);

    // Derived values
    const effectiveCredits = customCredits !== null ? customCredits : desiredDecks * 675000;

    // Cost Calculation: Credits / Rate
    // e.g. 7M credits / 2.3M rate = $3.04
    const rawCost = effectiveCredits / (rate || 2500000);
    const displayCost = Math.max(3.00, rawCost);

    const handleBuyTopUp = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        setIsPurchasing(true);
        try {
            const response = await api.post('/api/payments/create-topup-session', {
                credits: Math.floor(effectiveCredits),
                cost: displayCost // Optional: Backend might verify this
            });
            if (response.url) window.location.href = response.url;
        } catch (error) {
            console.error('Top-up error:', error);
            addToast('Failed to start top-up checkout. Please try again.', 'error');
            setIsPurchasing(false);
        }
    };

    // Upgrade Logic
    const getNextTierParams = () => {
        if (!dynamicConfig) return null;
        // Flatten check
        const tierList = dynamicConfig.tiers || [];
        const tierOrder = ['free', 'tier_1', 'tier_2', 'tier_3', 'tier_4', 'tier_5'];
        const currentIdx = tierOrder.indexOf(currentTier || 'free');

        if (currentIdx === -1 || currentIdx >= tierOrder.length - 1) return null;

        const map = {
            'free': 'Trial',
            'tier_1': 'Apprentice',
            'tier_2': 'Magician',
            'tier_3': 'Wizard',
            'tier_4': 'Archmage',
            'tier_5': 'Planeswalker'
        };
        const currentName = map[currentTier || 'free'];
        const nextTierKey = tierOrder[currentIdx + 1];
        const nextName = map[nextTierKey];

        const currentTierConfig = tierList.find(t => t.name === currentName);
        const nextTierConfig = tierList.find(t => t.name === nextName);

        if (!nextTierConfig) return null;

        // Get Prices
        const getPrice = (t) => {
            if (t.price !== undefined) return t.price; // Simple structure
            return (t.prices?.find(p => p.interval === billingInterval)?.amount / 100) || 0;
        };

        const currentPrice = currentTierConfig ? getPrice(currentTierConfig) : 0;
        const nextPrice = getPrice(nextTierConfig);

        const diff = nextPrice - currentPrice;

        const curLimit = currentTierConfig ? currentTierConfig.creditLimit : 750000;

        return {
            key: nextTierKey,
            name: nextTierConfig.name,
            diff: Math.max(0, diff),
            credits: nextTierConfig.creditLimit,
            extraCredits: nextTierConfig.creditLimit - curLimit
        };
    };

    const upgradeOption = getNextTierParams();
    const isUpgradeCheaper = upgradeOption && upgradeOption.diff < displayCost;

    const handleDeckChange = (e) => {
        setDesiredDecks(parseInt(e.target.value));
        setCustomCredits(null); // Reset custom
    };

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mt-8 max-w-4xl mx-auto shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-center bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
                ⚡ Custom Top-Up Amount
            </h2>
            <p className="text-center text-gray-400 mb-8">
                Average Value: <span className="text-indigo-300 font-mono font-bold">{(rate / 1000000).toFixed(2)}M Credits</span> per <span className="text-green-400 font-bold">$1.00</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                    <label className="block text-gray-400 mb-4 text-lg">
                        I want to build <span className="text-white font-bold text-2xl mx-2">{desiredDecks}</span> more decks
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="100"
                        value={desiredDecks}
                        onChange={handleDeckChange}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 mb-6"
                    />

                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-px bg-gray-700 flex-grow"></div>
                        <span className="text-gray-500 text-xs uppercase">OR ENTER CUSTOM CREDITS</span>
                        <div className="h-px bg-gray-700 flex-grow"></div>
                    </div>

                    <div className="relative">
                        <input
                            type="number"
                            step="100000"
                            placeholder="e.g. 5000000"
                            value={effectiveCredits}
                            onChange={(e) => {
                                setCustomCredits(parseInt(e.target.value) || 0);
                                setDesiredDecks(Math.floor((parseInt(e.target.value) || 0) / 675000));
                            }}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <span className="absolute right-4 top-3.5 text-gray-500 text-sm">Credits</span>
                    </div>

                    <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700 flex justify-between items-center">
                        <div className="text-gray-400 text-sm">Total Power</div>
                        <div className="text-2xl font-mono text-indigo-400 font-bold">
                            {(effectiveCredits / 1000000).toFixed(1)}M <span className="text-sm text-gray-500">Credits</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col justify-center space-y-4">
                    {/* Top Up Option */}
                    <div className={`p-4 rounded-xl border transition-all ${isUpgradeCheaper ? 'bg-gray-900 border-gray-700 opacity-60' : 'bg-gradient-to-br from-gray-900 to-gray-800 border-yellow-500/50 shadow-lg shadow-yellow-900/20'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg text-white">One-Time Payment</h3>
                            {rawCost < 3.00 && <span className="bg-red-900/30 text-red-400 text-xs px-2 py-1 rounded">Min $3.00</span>}
                        </div>
                        <div className="text-4xl font-bold text-green-400 mb-2">${displayCost.toFixed(2)}</div>
                        <p className="text-sm text-gray-400">
                            {rawCost < 3.00 ? `(Minimum payment applied)` : `Calculated based on average tier value.`}
                        </p>
                        <button
                            onClick={handleBuyTopUp}
                            disabled={isPurchasing}
                            className={`mt-4 w-full font-bold py-3 rounded-lg transition-all transform active:scale-95 ${isPurchasing ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white shadow-lg'}`}
                        >
                            {isPurchasing ? 'Processing...' : 'Buy Credits Now'}
                        </button>
                    </div>

                    {/* Upgrade Option Recommendation */}
                    {upgradeOption && (
                        <div className={`relative p-4 rounded-xl border transition-all ${isUpgradeCheaper ? 'bg-gradient-to-br from-indigo-900 to-purple-900 border-indigo-400 shadow-xl shadow-indigo-900/40 scale-105 z-10' : 'bg-gray-900 border-gray-700 opacity-75'}`}>
                            {isUpgradeCheaper && (
                                <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-bounce">
                                    SAVE MONEY
                                </div>
                            )}
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-lg text-white">Upgrade to {upgradeOption.name}</h3>
                            </div>
                            <div className="flex justify-between items-end mb-2">
                                <div className="text-2xl font-bold text-white">
                                    +${upgradeOption.diff.toFixed(2)}<span className="text-sm text-gray-400 font-normal">/mo</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-400">Gets you</div>
                                    <div className="font-bold text-indigo-300">{(upgradeOption.extraCredits / 1000000).toFixed(1)}M More</div>
                                </div>
                            </div>
                            <button
                                onClick={() => onUpgrade && onUpgrade(upgradeOption.key)}
                                className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded transition"
                            >
                                Upgrade Plan
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopUpCalculator;
