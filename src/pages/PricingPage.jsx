import React, { useState, useEffect, useMemo } from 'react';
import { TIERS, TIER_CONFIG } from '../config/tiers';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Check, X, Grid, List } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import SubscriptionSelection from '../components/onboarding/SubscriptionSelection';
import TopUpCalculator from '../components/onboarding/TopUpCalculator';
import { FEATURE_GROUPS } from '../data/pricing_data';

const PricingPage = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [billingInterval, setBillingInterval] = useState('monthly');
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
    const [dynamicConfig, setDynamicConfig] = useState(null);

    // Table Highlight State
    const [hoveredRow, setHoveredRow] = useState(null);
    const [hoveredCol, setHoveredCol] = useState(null);

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const res = await api.get('/api/pricing');
                if (res.data && res.data.config) {
                    setDynamicConfig(res.data.config);
                }
            } catch (error) {
                console.warn("Using default pricing config", error);
            }
        };
        fetchPricing();
    }, []);

    const avgRate = useMemo(() => {
        // 1. Use explicit Top-Up Rate if configured
        if (dynamicConfig?.assumptions?.topUpCreditRate) {
            return dynamicConfig.assumptions.topUpCreditRate * 1000000;
        }
        // 2. Fallback
        if (!dynamicConfig?.tiers) return 2300000;

        let total = 0;
        let count = 0;
        dynamicConfig.tiers.forEach(t => {
            const price = t.price || (t.prices?.find(p => p.interval === 'monthly')?.amount / 100);
            if (price > 0 && t.creditLimit > 0) {
                total += (t.creditLimit / price);
                count++;
            }
        });
        return count > 0 ? Math.floor(total / count) : 2300000;
    }, [dynamicConfig]);

    const calculatedPacks = useMemo(() => [
        { name: "Limited Top-Up", price: 3.00, creditLimit: Math.floor(3 * avgRate), priceId: 'price_1SzqhHDBKqoK8H1R2hueH8bO' },
        { name: "Standard Top-Up", price: 5.00, creditLimit: Math.floor(5 * avgRate), priceId: 'price_1SzqhhDBKqoK8H1RhI24QhlN' },
        { name: "Mega Top-Up", price: 10.00, creditLimit: Math.floor(10 * avgRate), priceId: 'price_1SzqhsDBKqoK8H1RxtCngqnG' }
    ], [avgRate]);

    const getDynamicLimit = (tierKey) => {
        if (!dynamicConfig) return TIER_CONFIG[tierKey].limits.aiCredits || 0;

        // Map TIER_X to Name
        const map = {
            [TIERS.FREE]: 'Trial',
            [TIERS.TIER_1]: 'Apprentice',
            [TIERS.TIER_2]: 'Magician',
            [TIERS.TIER_3]: 'Wizard',
            [TIERS.TIER_4]: 'Archmage',
            [TIERS.TIER_5]: 'Planeswalker'
        };

        const name = map[tierKey];
        if (name === 'Trial') return dynamicConfig.trial.creditLimit;

        const tier = dynamicConfig.tiers.find(t => t.name === name);
        return tier ? tier.creditLimit : 0;
    };

    const handleSubscribe = async (tierId) => {
        if (!currentUser) {
            navigate('/login');
            return;
        }
        if (tierId === TIERS.FREE) {
            addToast('You are already on the free tier.', 'info');
            return;
        }
        setIsLoading(true);
        try {
            const response = await api.post('/api/payments/create-checkout-session', {
                tierId,
                interval: billingInterval
            });
            if (response.url) window.location.href = response.url;
        } catch (error) {
            console.error('Subscription error:', error);
            addToast('Failed to start checkout. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBuyPack = async (pack) => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        try {
            const response = await api.post('/api/payments/create-topup-session', {
                credits: pack.creditLimit,
                cost: pack.price,
                priceId: pack.priceId
            });
            if (response.url) window.location.href = response.url;
        } catch (error) {
            console.error('Top-up error:', error);
            addToast('Failed to start checkout. Please try again.', 'error');
        }
    };

    const getPriceDisplay = (tier) => {
        if (!dynamicConfig) {
            // Fallback to existing hardcoded logic if dynamicConfig is not loaded
            const config = TIER_CONFIG[tier];
            if (!config.prices.monthly && !config.prices.biannual && !config.prices.yearly) return 'Free';
            const displayPrices = {
                [TIERS.TIER_1]: { monthly: '$2.99', biannual: '$14.99', yearly: '$29.99' },
                [TIERS.TIER_2]: { monthly: '$4.99', biannual: '$24.99', yearly: '$49.99' },
                [TIERS.TIER_3]: { monthly: '$9.99', biannual: '$49.99', yearly: '$99.99' },
                [TIERS.TIER_4]: { monthly: '$14.99', biannual: '$74.99', yearly: '$149.99' },
                [TIERS.TIER_5]: { monthly: '$19.99', biannual: '$99.99', yearly: '$199.99' },
            };
            return displayPrices[tier]?.[billingInterval] || 'Free';
        }

        // Use dynamicConfig
        const mapTierIdToName = {
            [TIERS.FREE]: 'Trial',
            [TIERS.TIER_1]: 'Apprentice',
            [TIERS.TIER_2]: 'Magician',
            [TIERS.TIER_3]: 'Wizard',
            [TIERS.TIER_4]: 'Archmage',
            [TIERS.TIER_5]: 'Planeswalker',
        };
        const tierName = mapTierIdToName[tier];

        if (tierName === 'Trial') {
            return 'Free';
        }

        const dynamicTier = dynamicConfig.tiers.find(t => t.name === tierName);
        if (!dynamicTier) return 'N/A';

        const price = dynamicTier.prices.find(p => p.interval === billingInterval);
        if (price) {
            return `$${(price.amount / 100).toFixed(2)}`;
        }
        return 'N/A';
    };

    const getSavingsDisplay = () => {
        if (billingInterval === 'biannual') return <span className="text-green-400 text-xl font-bold ml-2">1 Month Free</span>;
        if (billingInterval === 'yearly') return <span className="text-green-400 text-xl font-bold ml-2">2 Months Free</span>;
        return null;
    };

    const formatCredits = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
        return (num / 1000).toFixed(0) + "k";
    };

    const renderCellContent = (item, tierKey) => {
        const config = TIER_CONFIG[tierKey];

        // Special case for AI Credits
        if (item.label === 'AI Credits / Mo' || item.key === 'aiCredits') {
            const limit = getDynamicLimit(tierKey);
            return <span className="text-indigo-400 font-bold">{formatCredits(limit)}</span>;
        }

        if (item.type === 'static') return <Check className="w-5 h-5 text-green-500 mx-auto" />;
        if (item.type === 'limit') {
            const val = config.limits[item.key];
            return val === Infinity ? 'Unlimited' : val;
        }
        if (item.type === 'limit_check') {
            const val = config.limits[item.key];
            return (val > 0 || val === Infinity) ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-gray-700 mx-auto opacity-30" />;
        }
        if (item.type === 'feature') {
            const hasFeature = config.features[item.key];
            return hasFeature ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-gray-700 mx-auto opacity-30" />;
        }
        return '-';
    };

    const getBreakdown = (creditLimit) => {
        const exchangeRate = dynamicConfig?.assumptions?.exchangeRate || 15;
        const deckCost = 45000 * exchangeRate;
        const chatCost = 100 * exchangeRate;
        return {
            decks: Math.floor(creditLimit / deckCost),
            chats: Math.floor(creditLimit / chatCost)
        };
    };

    const tiers = Object.values(TIERS);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-[1800px] mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                        Choose Your Path
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
                        Comparing plans to find the perfect fit for your magic journey.
                    </p>

                    {/* Controls */}
                    <div className="flex flex-col md:flex-row justify-center items-center gap-6">
                        {/* Billing Interval */}
                        <div className="flex bg-gray-800 p-1 rounded-xl">
                            {['monthly', 'biannual', 'yearly'].map(interval => (
                                <button
                                    key={interval}
                                    onClick={() => setBillingInterval(interval)}
                                    className={`px-4 py-2 rounded-lg transition-all capitalize ${billingInterval === interval ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {interval === 'biannual' ? '6 Months' : interval}
                                </button>
                            ))}
                        </div>
                        {/* View Toggle */}
                        <div className="flex bg-gray-800 p-1 rounded-xl">
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'cards' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Grid className="w-4 h-4" /> Cards
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <List className="w-4 h-4" /> Compare All
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 h-8">{getSavingsDisplay()}</div>
                </div>

                {viewMode === 'cards' ? (
                    <SubscriptionSelection
                        billingInterval={billingInterval}
                        setBillingInterval={setBillingInterval}
                        onSubscribe={handleSubscribe}
                        isLoading={isLoading}
                        currentTier={userProfile?.subscription_tier}
                        dynamicConfig={dynamicConfig}
                        rate={avgRate}
                        onBuyPack={handleBuyPack}
                    />
                ) : (
                    // Table View
                    <div className="overflow-x-auto pb-12 pt-12 animate-in fade-in duration-300">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr>
                                    <th className="p-4 w-[250px] sticky left-0 z-20 bg-gray-900 border-b border-gray-800 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
                                        <div className="text-xl font-bold text-gray-500">Features</div>
                                    </th>
                                    {tiers.map((tierKey, index) => {
                                        const config = TIER_CONFIG[tierKey];
                                        const isCurrent = userProfile?.subscription_tier === tierKey;
                                        const isHovered = hoveredCol === index;
                                        const limit = getDynamicLimit(tierKey);
                                        const breakdown = getBreakdown(limit);

                                        return (
                                            <th
                                                key={tierKey}
                                                className={`p-4 min-w-[180px] text-center relative transition-colors duration-300 border-b border-gray-800
                                                ${isHovered ? 'bg-gray-800/80' : 'bg-gray-900'}
                                                ${isCurrent ? 'ring-2 ring-purple-500 ring-inset bg-purple-900/10' : ''}
                                            `}
                                                onMouseEnter={() => setHoveredCol(index)}
                                                onMouseLeave={() => setHoveredCol(null)}
                                            >
                                                {isCurrent && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Current</div>}
                                                <h3 className={`text-xl font-bold mb-1 ${isCurrent ? 'text-purple-300' : 'text-gray-200'}`}>{config.name}</h3>
                                                <div className="text-2xl font-bold mb-2">
                                                    {getPriceDisplay(tierKey)}
                                                    <span className="text-xs text-gray-500 font-normal">/{billingInterval === 'monthly' ? 'mo' : (billingInterval === 'biannual' ? '6mo' : 'yr')}</span>
                                                </div>

                                                {/* Display AI Credit Limit in Header too */}
                                                <div className="text-sm text-indigo-400 font-mono font-bold">
                                                    {formatCredits(limit)} Credits/mo
                                                </div>
                                                <div className="text-[10px] text-gray-500 mb-2">
                                                    ~{breakdown.decks} Decks or ~{breakdown.chats.toLocaleString()} Chats
                                                </div>

                                                <button
                                                    onClick={() => handleSubscribe(tierKey)}
                                                    disabled={isLoading || isCurrent}
                                                    className={`w-full py-2 rounded text-sm font-bold transition-all ${isCurrent
                                                        ? 'bg-gray-800 text-gray-500 cursor-default'
                                                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'
                                                        }`}
                                                >
                                                    {isCurrent ? 'Active' : (tierKey === TIERS.FREE ? 'Default' : 'Subscribe')}
                                                </button>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {FEATURE_GROUPS.map((group, gIndex) => (
                                    <React.Fragment key={group.name}>
                                        {group.items.map((item, rIndex) => {
                                            const rowIndex = `${gIndex}-${rIndex}`;
                                            const isRowHovered = hoveredRow === rowIndex;

                                            return (
                                                <tr
                                                    key={item.label}
                                                    className={`transition-colors duration-200 border-b border-gray-800/50
                                                    ${isRowHovered ? 'bg-gray-800/60' : 'hover:bg-gray-800/30'}
                                                `}
                                                    onMouseEnter={() => setHoveredRow(rowIndex)}
                                                    onMouseLeave={() => setHoveredRow(null)}
                                                >
                                                    <td className={`p-3 pl-4 text-sm font-medium text-gray-300 sticky left-0 z-10
                                                    bg-gray-900 transition-colors duration-200 border-r border-gray-800 shadow-[4px_0_24px_rgba(0,0,0,0.4)]
                                                    ${isRowHovered ? 'text-white bg-gray-800' : ''}
                                                `}>
                                                        {group.name === "Limits" || group.name === "Settings" || group.name === "AI" ? item.label : `${group.name} - ${item.label}`}
                                                    </td>
                                                    {tiers.map((tierKey, cIndex) => {
                                                        const isColHovered = hoveredCol === cIndex;
                                                        const isCellHovered = isRowHovered && isColHovered; // Intersection

                                                        return (
                                                            <td
                                                                key={tierKey}
                                                                className={`p-3 text-center text-sm transition-colors duration-200
                                                                ${isColHovered ? 'bg-gray-800/40' : ''}
                                                                ${isCellHovered ? 'bg-purple-500/10' : ''}
                                                            `}
                                                                onMouseEnter={() => setHoveredCol(cIndex)}
                                                                onMouseLeave={() => setHoveredCol(null)}
                                                            >
                                                                {renderCellContent(item, tierKey)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>



            <div className="mt-16 text-center">
                <p className="text-gray-500 text-sm">* Prices and limits subject to change. VAT may apply.</p>
            </div>
        </div>
    );
};

;

export default PricingPage;
