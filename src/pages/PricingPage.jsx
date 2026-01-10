import React, { useState } from 'react';
import { TIERS, TIER_CONFIG } from '../config/tiers';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Check, X, HelpCircle, Info, Grid, List, ArrowRight } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import SubscriptionSelection from '../components/onboarding/SubscriptionSelection';
import { FEATURE_GROUPS } from '../data/pricing_data';

const PricingPage = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [billingInterval, setBillingInterval] = useState('monthly');
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

    // Table Highlight State
    const [hoveredRow, setHoveredRow] = useState(null);
    const [hoveredCol, setHoveredCol] = useState(null);

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

    const getPriceDisplay = (tier) => {
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
    };

    const getSavingsDisplay = () => {
        if (billingInterval === 'biannual') return <span className="text-green-400 text-xl font-bold ml-2">1 Month Free</span>;
        if (billingInterval === 'yearly') return <span className="text-green-400 text-xl font-bold ml-2">2 Months Free</span>;
        return null;
    };

    const renderCellContent = (item, tierKey) => {
        const config = TIER_CONFIG[tierKey];
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

            <div className="mt-8 text-center">
                <p className="text-gray-500 text-sm">* Prices and limits subject to change. VAT may apply.</p>
            </div>
        </div>
    );
};

const FeatureItem = ({ label, check, highlight }) => (
    <div className={`flex items-start text-sm ${check ? (highlight ? 'text-white font-medium' : 'text-gray-300') : 'text-gray-500'}`}>
        {check ? <Check className={`w-4 h-4 mr-2 mt-0.5 flex-shrink-0 ${highlight ? 'text-purple-400' : 'text-green-500'}`} />
            : <X className="w-4 h-4 mr-2 text-red-900/50 mt-0.5 flex-shrink-0" />}
        <span>{label}</span>
    </div>
);

export default PricingPage;
