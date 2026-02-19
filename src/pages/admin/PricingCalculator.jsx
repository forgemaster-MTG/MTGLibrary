import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { getTierConfig } from '../../config/tiers';


const PricingCalculator = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const [config, setConfig] = useState({
        assumptions: {
            marginPercent: 33,
            hostingCost: 0.25,
            avgUsagePercent: 80,
            proTokenCost: 2.50,
            exchangeRate: 15,
            topUpCreditRate: 6 // New field
        },
        tiers: [],
        packs: [],
        trial: { creditLimit: 750000 }
    });

    const [liability, setLiability] = useState({
        totalMonthly: 0,
        totalTopUp: 0,
        totalTokens: 0,
        estimatedCost: 0,
        totalStaleMonthlyLimit: 0,
        totalStaleTopUp: 0
    });

    // Helper functions for calculation (Ported from HTML/JS)
    const calculateStripe = (price) => (price * 0.029) + 0.30;
    const calculateRequiredProfit = (price) => price * (config.assumptions.marginPercent / 100);

    const handleTierMarginChange = (index, value) => {
        const newTiers = [...config.tiers];
        newTiers[index].marginPercent = parseFloat(value) || 0;
        setConfig(prev => ({ ...prev, tiers: newTiers }));
    };

    const avgCreditsPerDollar = useMemo(() => {
        if (!config.tiers.length) return 0;
        let total = 0;
        let count = 0;
        config.tiers.forEach(t => {
            if (t.price > 0 && t.creditLimit > 0) {
                total += (t.creditLimit / t.price);
                count++;
            }
        });
        return count > 0 ? total / count : 0;
    }, [config.tiers]);

    const calculateStats = (item, type = 'tier', customUsagePercent = null) => {
        const { assumptions } = config;
        const stripe = calculateStripe(item.price);

        // Use per-item margin if defined, otherwise global assumption
        // For packs, force global assumption as they don't have individual controls
        const margin = type === 'pack' ? assumptions.marginPercent : (item.marginPercent !== undefined ? item.marginPercent : assumptions.marginPercent);
        const profit = item.price * (margin / 100);

        const hosting = type === 'tier' ? assumptions.hostingCost : 0;

        const aiBudget = item.price - stripe - profit - hosting;
        const safeBudget = aiBudget > 0 ? aiBudget : 0;

        // Max Credits Calculation
        let maxCredits;
        if (type === 'pack' && assumptions.topUpCreditRate) {
            // New Logic: Budget * Rate (Millions)
            maxCredits = safeBudget * assumptions.topUpCreditRate * 1000000;
        } else {
            const proTokensPurchasable = (safeBudget / assumptions.proTokenCost) * 1000000;
            maxCredits = proTokensPurchasable * assumptions.exchangeRate;
        }

        // Proposed Limit (Round to nearest 500k)
        const proposedLimit = Math.floor(maxCredits / 500000) * 500000;

        // Est Decks
        const costPerDeckCredits = 45000 * assumptions.exchangeRate;
        const estDecks = Math.floor(proposedLimit / costPerDeckCredits);

        // Est Cost
        const usage = customUsagePercent !== null ? customUsagePercent : assumptions.avgUsagePercent;
        const estCost = (proposedLimit / assumptions.exchangeRate / 1000000) * assumptions.proTokenCost * (usage / 100);

        // Proj Profit
        const projProfit = item.price - stripe - hosting - estCost;

        return {
            stripe,
            profit,
            aiBudget,
            maxCredits,
            proposedLimit,
            estDecks,
            estCost,
            projProfit,
            marginUsed: margin
        };
    };

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await api.get('/api/admin/pricing');
                if (res.config) {
                    const loadedConfig = res.config;
                    // Ensure new fields exist if missing from DB
                    if (loadedConfig.assumptions && typeof loadedConfig.assumptions.topUpCreditRate === 'undefined') {
                        loadedConfig.assumptions.topUpCreditRate = 6;
                    }
                    setConfig(loadedConfig);
                }
            } catch (err) {
                console.error("Failed to fetch pricing config", err);
                setMessage({ type: 'error', text: "Failed to load configuration." });
            } finally {
                setLoading(false);
            }
        };

        const fetchLiability = async () => {
            try {
                const users = await api.getUsers(); // We need all users to sum up credits
                let totalMonthlyRemaining = 0;
                let totalMonthlyLimit = 0;
                let totalTopUpRemaining = 0;
                let totalStaleMonthlyLimit = 0;
                let totalStaleTopUp = 0;

                const STALE_THRESHOLD_DAYS = 30;
                const now = new Date();

                users.forEach(u => {
                    const isTrial = u.subscription_status === 'trial';
                    const tierConfig = getTierConfig(
                        u.override_tier || u.subscription_tier || 'free',
                        u.settings?.permissions,
                        { isTrial }
                    );

                    const monthlyLimit = (tierConfig?.limits?.aiCredits || 0);
                    const topUpBalance = Number(u.credits_topup || 0);

                    totalMonthlyLimit += monthlyLimit;
                    totalMonthlyRemaining += Number(u.credits_monthly || 0);
                    totalTopUpRemaining += topUpBalance;

                    // Calculate Stale Status
                    const lastActive = u.last_active_at ? new Date(u.last_active_at) : null;
                    const daysInactive = lastActive ? Math.floor((now - lastActive) / (1000 * 60 * 60 * 24)) : 999; // Treat null as very stale
                    const isStale = daysInactive >= STALE_THRESHOLD_DAYS;

                    if (isStale) {
                        totalStaleMonthlyLimit += monthlyLimit;
                        totalStaleTopUp += topUpBalance;
                    }
                });

                setLiability({
                    totalMonthly: totalMonthlyRemaining,
                    totalMonthlyLimit,
                    totalTopUp: totalTopUpRemaining,
                    totalTokens: totalMonthlyRemaining + totalTopUpRemaining,
                    totalTokensLimit: totalMonthlyLimit + totalTopUpRemaining,
                    totalStaleMonthlyLimit,
                    totalStaleTopUp
                });
            } catch (err) {
                console.error("Failed to fetch users for liability", err);
            }
        };

        fetchConfig();
        fetchLiability();
    }, []);

    const liabilityDetails = useMemo(() => {
        if (!config.assumptions.exchangeRate || !config.assumptions.proTokenCost) return null;

        const calculateCost = (credits) => {
            const numCredits = Number(credits) || 0;
            const rawTokens = (numCredits / config.assumptions.exchangeRate);
            return (rawTokens / 1000000) * config.assumptions.proTokenCost;
        };

        // Monthly Liability is calculated on the FULL limit (Worst case / Total Promise)
        const monthlyCost = calculateCost(liability.totalMonthlyLimit);
        const monthlyStaleCost = calculateCost(liability.totalStaleMonthlyLimit);

        // Top-Up Liability is calculated on CURRENT remaining balance
        const topUpCost = calculateCost(liability.totalTopUp);
        const topUpStaleCost = calculateCost(liability.totalStaleTopUp);

        const totalCost = monthlyCost + topUpCost;
        const totalStaleCost = monthlyStaleCost + topUpStaleCost;

        return {
            monthlyCost,
            monthlyStaleCost,
            topUpCost,
            topUpStaleCost,
            totalCost,
            totalStaleCost
        };
    }, [liability, config.assumptions.exchangeRate, config.assumptions.proTokenCost]);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await api.post('/api/admin/pricing', { config });
            setMessage({ type: 'success', text: "Configuration saved successfully!" });
        } catch (err) {
            console.error("Failed to save config", err);
            setMessage({ type: 'error', text: "Failed to save configuration." });
        } finally {
            setSaving(false);
        }
    };

    const handleAssumptionChange = (key, value) => {
        setConfig(prev => ({
            ...prev,
            assumptions: {
                ...prev.assumptions,
                [key]: parseFloat(value) || 0
            }
        }));
    };

    const applyProposedLimits = () => {
        // Updates the actual config.tiers with the calculated proposed limits
        const newTiers = config.tiers.map(t => ({
            ...t,
            creditLimit: calculateStats(t, 'tier').proposedLimit
        }));

        const newPacks = config.packs.map(p => ({
            ...p,
            creditLimit: calculateStats(p, 'pack', 100).proposedLimit
        }));

        setConfig(prev => ({ ...prev, tiers: newTiers, packs: newPacks }));
        setMessage({ type: 'info', text: "Proposed limits applied to configuration. Review and click Save." });
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;

    const formatMillions = (num) => {
        if (num < 0) return "0";
        if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
        return (num / 1000).toFixed(0) + "k";
    };

    return (
        <div className="bg-gray-900 text-gray-100 min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-primary-400">🧙‍♂️ Pricing Calculator & Config</h1>
                        {liability.totalTokensLimit > 0 && liabilityDetails && (
                            <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2">AI Liability Economics</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-gray-500 uppercase font-black">Monthly Subscription</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-mono text-primary-400" title="Total Potential Limit">
                                                {formatMillions(liability.totalMonthlyLimit)}
                                            </span>
                                            <span className="text-[10px] text-gray-500 lowercase font-normal ml-1">total potential</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-white">${liabilityDetails.monthlyCost.toFixed(2)} <span className="text-[10px] text-gray-500 font-normal">liability</span></p>
                                            {liabilityDetails.monthlyStaleCost > 0 && (
                                                <span className="text-[10px] text-gray-500 italic bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700" title={`Credits from users inactive > 30 days: ${formatMillions(liability.totalStaleMonthlyLimit)}`}>
                                                    ${liabilityDetails.monthlyStaleCost.toFixed(2)} stale
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-gray-500 uppercase font-black">Top-Up Credits</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-mono text-yellow-500" title="Remaining purchased credits">
                                                {formatMillions(liability.totalTopUp)}
                                            </span>
                                            <span className="text-[10px] text-gray-500 lowercase font-normal ml-1">avbl balance</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-white">${liabilityDetails.topUpCost.toFixed(2)} <span className="text-[10px] text-gray-500 font-normal">liability</span></p>
                                            {liabilityDetails.topUpStaleCost > 0 && (
                                                <span className="text-[10px] text-gray-500 italic bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700" title={`Credits from users inactive > 30 days: ${formatMillions(liability.totalStaleTopUp)}`}>
                                                    ${liabilityDetails.topUpStaleCost.toFixed(2)} stale
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1 border-l border-gray-700 pl-4">
                                        <p className="text-[10px] text-gray-500 uppercase font-black">Combined Total</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-mono text-white">
                                                {formatMillions(liability.totalMonthlyLimit + liability.totalTopUp)}
                                            </span>
                                            <span className="text-[10px] text-gray-500 lowercase font-normal ml-1">combined avbl</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-red-400">${liabilityDetails.totalCost.toFixed(2)} <span className="text-[10px] text-gray-500 font-normal">total risk</span></p>
                                            {liabilityDetails.totalStaleCost > 0 && (
                                                <span className="text-[11px] text-gray-400 font-medium bg-gray-900 px-2 py-0.5 rounded border border-gray-700 shadow-sm" title="Total credits from users inactive > 30 days">
                                                    ${liabilityDetails.totalStaleCost.toFixed(2)} inactive
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
                <div className="space-x-4">
                    <button
                        onClick={applyProposedLimits}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded transition"
                    >
                        Apply Proposed Limits
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-bold transition ${saving ? 'opacity-50' : ''}`}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded mb-6 ${message.type === 'error' ? 'bg-red-900/50 border-red-500' : 'bg-green-900/50 border-green-500'} border`}>
                    {message.text}
                </div>
            )}

            {/* Assumptions */}
            {/* Assumptions */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-700">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-semibold text-green-400">⚙️ Assumptions</h2>
                    <div className="text-right bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                        <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Average Value</div>
                        <div className="text-xl font-mono font-bold text-primary-400">
                            {(avgCreditsPerDollar / 1000000).toFixed(2)}M <span className="text-sm text-gray-500">Credits / $1</span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    {Object.entries(config.assumptions).map(([key, value]) => (
                        <div key={key}>
                            <label className="block text-sm text-gray-400 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                            <input
                                type="number"
                                value={value}
                                onChange={(e) => handleAssumptionChange(key, e.target.value)}
                                step="0.01"
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-primary-500 outline-none"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Tiers Table */}
            <h2 className="text-2xl font-bold mb-4">Subscription Tiers</h2>
            <div className="overflow-x-auto mb-12 bg-gray-800 rounded-xl border border-gray-700">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-900/50 text-gray-400 uppercase text-sm border-b border-gray-700">
                            <th className="p-4">Tier</th>
                            <th className="p-4">Price</th>
                            <th className="p-4">Margin %</th>
                            <th className="p-4">Req. Profit</th>
                            <th className="p-4 text-primary-400">Strict Max</th>
                            <th className="p-4 text-white">Current Limit</th>
                            <th className="p-4 text-green-400">Proposed</th>
                            <th className="p-4">Est. Decks</th>
                            <th className="p-4 text-emerald-300">Proj. Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {config.tiers.map((tier, index) => {
                            const stats = calculateStats(tier, 'tier');
                            const isDiscrepancy = tier.creditLimit !== stats.proposedLimit;

                            return (
                                <tr key={tier.name} className="border-b border-gray-700 hover:bg-gray-700/50 transition">
                                    <td className="p-4 font-bold">{tier.name}</td>
                                    <td className="p-4 text-green-400">${tier.price.toFixed(2)}</td>
                                    <td className="p-4">
                                        <input
                                            type="number"
                                            value={tier.marginPercent !== undefined ? tier.marginPercent : config.assumptions.marginPercent}
                                            onChange={(e) => handleTierMarginChange(index, e.target.value)}
                                            className="w-20 bg-gray-900 border border-gray-600 rounded p-1 text-white text-center"
                                        />
                                    </td>
                                    <td className="p-4 text-green-300 font-mono">${stats.profit.toFixed(2)}</td>
                                    <td className="p-4 font-bold text-lg text-primary-300">{formatMillions(stats.maxCredits)}</td>
                                    <td className={`p-4 font-bold text-xl ${isDiscrepancy ? 'text-yellow-500' : 'text-white'}`}>
                                        {formatMillions(tier.creditLimit)}
                                    </td>
                                    <td className="p-4 font-bold text-xl text-green-400">{formatMillions(stats.proposedLimit)}</td>
                                    <td className="p-4 font-bold text-yellow-300 text-lg">{stats.estDecks}</td>
                                    <td className="p-4 text-emerald-300 font-bold">${stats.projProfit.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Packs Table */}
            <h2 className="text-2xl font-bold mb-4">Top-Up Packs</h2>
            <div className="overflow-x-auto bg-gray-800 rounded-xl border border-gray-700">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-900/50 text-gray-400 uppercase text-sm border-b border-gray-700">
                            <th className="p-4">Pack</th>
                            <th className="p-4">Price</th>
                            <th className="p-4">Stripe</th>
                            <th className="p-4">Req. Profit</th>
                            <th className="p-4 text-primary-400">Strict Max</th>
                            <th className="p-4 text-white">Current Limit</th>
                            <th className="p-4 text-green-400">Proposed</th>
                            <th className="p-4">Est. Decks</th>
                            <th className="p-4 text-emerald-300">Proj. Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {config.packs.map(pack => {
                            const stats = calculateStats(pack, 'pack', 100);
                            const isDiscrepancy = pack.creditLimit !== stats.proposedLimit;
                            return (
                                <tr key={pack.name} className="border-b border-gray-700 hover:bg-gray-700/50 transition">
                                    <td className="p-4 font-bold">{pack.name}</td>
                                    <td className="p-4 text-green-400">${pack.price.toFixed(2)}</td>
                                    <td className="p-4 text-red-400 text-sm">-${stats.stripe.toFixed(2)}</td>
                                    <td className="p-4 text-green-300 font-mono">${stats.profit.toFixed(2)}</td>
                                    <td className="p-4 font-bold text-lg text-primary-300">{formatMillions(stats.maxCredits)}</td>
                                    <td className={`p-4 font-bold text-xl ${isDiscrepancy ? 'text-yellow-500' : 'text-white'}`}>
                                        {formatMillions(pack.creditLimit)}
                                    </td>
                                    <td className="p-4 font-bold text-xl text-green-400">{formatMillions(stats.proposedLimit)}</td>
                                    <td className="p-4 font-bold text-yellow-300 text-lg">{stats.estDecks}</td>
                                    <td className="p-4 text-emerald-300 font-bold">${stats.projProfit.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

        </div>
    );
};

export default PricingCalculator;
