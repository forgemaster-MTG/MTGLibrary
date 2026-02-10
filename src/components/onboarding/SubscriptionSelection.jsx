import React from 'react';
import { TIERS, TIER_CONFIG } from '../../config/tiers';
import { getNewFeatures } from '../../data/pricing_data';
import { Check, X, ArrowRight } from 'lucide-react';
import TopUpCalculator from './TopUpCalculator';

const FeatureItem = ({ label, check, highlight, bold, tooltip }) => (
    <div className={`flex items-start text-sm ${check ? (highlight ? 'text-white font-medium' : 'text-gray-300') : 'text-gray-500'} ${bold ? 'font-bold' : ''}`} title={tooltip}>
        {check ? <Check className={`w-4 h-4 mr-2 mt-0.5 flex-shrink-0 ${highlight ? 'text-purple-400' : 'text-green-500'}`} />
            : <X className="w-4 h-4 mr-2 text-red-900/50 mt-0.5 flex-shrink-0" />}
        <span>{label}</span>
    </div>
);

const SubscriptionSelection = ({
    billingInterval,
    setBillingInterval,
    onSubscribe,
    isLoading,
    currentTier,
    showIntervalSelector = true,
    dynamicConfig,
    packs,
    onBuyPack,
    rate
}) => {
    const [buyingPackIndex, setBuyingPackIndex] = React.useState(null);
    const tiers = Object.values(TIERS);

    const displayPacks = React.useMemo(() => {
        if (packs && packs.length > 0) return packs;
        if (dynamicConfig?.packs && dynamicConfig.packs.length > 0) return dynamicConfig.packs;
        return [
            { name: "Limited Top-Up", price: 3.00, creditLimit: 8000000 },
            { name: "Standard Top-Up", price: 5.00, creditLimit: 15000000 },
            { name: "Mega Top-Up", price: 10.00, creditLimit: 31500000 }
        ];
    }, [packs, dynamicConfig]);

    const getPriceDisplay = (tier) => {
        if (dynamicConfig && dynamicConfig.tiers) {
            const mapTierIdToName = {
                [TIERS.FREE]: 'Trial',
                [TIERS.TIER_1]: 'Apprentice',
                [TIERS.TIER_2]: 'Magician',
                [TIERS.TIER_3]: 'Wizard',
                [TIERS.TIER_4]: 'Archmage',
                [TIERS.TIER_5]: 'Planeswalker',
            };
            const tierName = mapTierIdToName[tier];
            if (tierName === 'Trial') return 'Free';
            const dynamicTier = dynamicConfig.tiers.find(t => t.name === tierName);
            if (dynamicTier) {
                const price = dynamicTier.prices.find(p => p.interval === billingInterval);
                if (price) return `$${(price.amount / 100).toFixed(2)}`;
            }
        }
        const config = TIER_CONFIG[tier];
        if (!config.prices.monthly) return 'Free';
        const displayPrices = {
            [TIERS.TIER_1]: { monthly: '$2.99', quarterly: '$8.99', biannual: '$14.99', yearly: '$29.99' },
            [TIERS.TIER_2]: { monthly: '$4.99', quarterly: '$14.99', biannual: '$24.99', yearly: '$49.99' },
            [TIERS.TIER_3]: { monthly: '$9.99', quarterly: '$29.99', biannual: '$49.99', yearly: '$99.99' },
            [TIERS.TIER_4]: { monthly: '$14.99', quarterly: '$44.99', biannual: '$74.99', yearly: '$149.99' },
            [TIERS.TIER_5]: { monthly: '$19.99', quarterly: '$59.99', biannual: '$99.99', yearly: '$199.99' },
        };
        return displayPrices[tier]?.[billingInterval] || 'Free';
    };

    const getCreditLimit = (tierKey) => {
        if (!dynamicConfig) return TIER_CONFIG[tierKey].limits.aiCredits || (tierKey === TIERS.FREE ? 750000 : 0);

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

    const formatCredits = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
        return (num / 1000).toFixed(0) + "k";
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

    return (
        <div className="w-full">
            {showIntervalSelector && (
                <div className="flex justify-center mb-8">
                    <div className="flex bg-gray-800 p-1 rounded-xl">
                        {['monthly', 'quarterly', 'biannual', 'yearly'].map(interval => (
                            <button
                                key={interval}
                                onClick={() => setBillingInterval(interval)}
                                className={`px-4 py-2 rounded-lg transition-all capitalize ${billingInterval === interval ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                {interval === 'biannual' ? '6 Months' : interval}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {tiers.map((tierKey, index) => {
                    const config = TIER_CONFIG[tierKey];
                    const isCurrent = currentTier === tierKey;
                    const prevTier = index > 0 ? tiers[index - 1] : null;
                    const { limits, features } = getNewFeatures(tierKey, prevTier, dynamicConfig);

                    const creditLimit = getCreditLimit(tierKey);
                    const breakdown = getBreakdown(creditLimit);

                    return (
                        <div key={tierKey} className={`relative flex flex-col p-5 rounded-2xl border ${isCurrent ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'border-gray-700'} bg-gray-800/50 backdrop-blur-sm hover:border-purple-500/50 transition-all duration-300`}>
                            {isCurrent && (
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-lg z-10">
                                    Current
                                </div>
                            )}

                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-gray-100">{config.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-white">{getPriceDisplay(tierKey)}</span>
                                    <span className="text-sm text-gray-500">/{billingInterval === 'monthly' ? 'mo' : (billingInterval === 'quarterly' ? 'qtr' : (billingInterval === 'biannual' ? '6mo' : 'yr'))}</span>
                                </div>
                                <div className="mt-2 inline-flex items-center px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
                                    <Check className="w-3 h-3 text-green-400 mr-1.5" />
                                    <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Unlimited Storage</span>
                                </div>
                            </div>

                            <button
                                onClick={() => onSubscribe(tierKey)}
                                disabled={isLoading || isCurrent}
                                className={`w-full py-2 rounded-lg font-bold text-sm mb-6 transition-all ${isCurrent
                                    ? 'bg-gray-700 cursor-default text-gray-400'
                                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg'
                                    }`}
                            >
                                {isLoading ? '...' : (isCurrent ? 'Active' : (tierKey === TIERS.FREE ? 'Select' : 'Subscribe'))}
                            </button>

                            {/* Credit & Breakdown Section */}
                            <div className="bg-gray-900/50 rounded-xl p-3 mb-4 border border-gray-700/50">
                                <div className="text-xs text-gray-400 mb-1 font-medium">Monthly AI Credits</div>
                                <div className="text-xl font-bold text-indigo-400 mb-2">{formatCredits(creditLimit)}</div>

                                <div className="space-y-1.5 pt-2 border-t border-gray-700/50">
                                    <div className="flex items-center text-[10px] text-gray-300">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2"></div>
                                        <span>Build ~<strong className="text-white">{breakdown.decks}</strong> AI Decks</span>
                                    </div>
                                    <div className="flex items-center text-[10px] text-gray-300">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2"></div>
                                        <span>Or ~<strong className="text-white">{breakdown.chats.toLocaleString()}</strong> AI Chats</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 flex-grow">
                                {(limits.length > 0 || features.length > 0) && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-purple-400 font-bold mb-2 border-b border-purple-500/30 pb-1">
                                            {tierKey === TIERS.FREE ? 'Features:' : 'Adds:'}
                                        </p>

                                        {/* Filter out AI Credits from limits display as we show it above */}
                                        {limits.filter(l => !l.label.includes('AI Credits')).map((f, i) => (
                                            <FeatureItem key={`limit-${i}`} label={f.label} check={true} highlight={true} bold={f.bold} tooltip={f.tooltip} />
                                        ))}

                                        {features.map((f, i) => (
                                            <FeatureItem key={`feat-${i}`} label={f.label} check={true} highlight={true} bold={f.bold} tooltip={f.tooltip} />
                                        ))}
                                    </div>
                                )}
                                {limits.length === 0 && features.length === 0 && tierKey !== TIERS.FREE && (
                                    <p className="text-xs text-gray-500 italic">Includes all previous features</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Top Up Section */}
            <div className="mt-16 pt-8 border-t border-gray-800">
                <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-2">Need more power?</h3>
                    <p className="text-gray-400">
                        Top-up your AI credits anytime. One-time purchases that <span className="text-green-400 font-bold">never expire</span>.
                    </p>
                    {rate && (
                        <p className="text-sm text-gray-400 mt-2">
                            Average Value: <span className="text-indigo-400 font-mono">{(rate / 1000000).toFixed(2)}M Credits</span> / $1.00
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap justify-center gap-6">
                    {displayPacks.map((pack, i) => (
                        <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 w-full max-w-[280px] hover:border-indigo-500/50 transition-all group flex flex-col items-center text-center">
                            <div className="mb-4">
                                <h4 className="font-bold text-gray-200 text-lg mb-1">{pack.name}</h4>
                                <div className="text-2xl font-bold text-white">${typeof pack.price === 'number' ? pack.price.toFixed(2) : pack.price}</div>
                            </div>

                            <div className="bg-indigo-500/10 rounded-lg px-4 py-3 mb-6 border border-indigo-500/20 w-full">
                                <div className="text-xs text-indigo-300 uppercase tracking-wider font-bold mb-1">Includes</div>
                                <div className="text-xl font-mono font-bold text-white">{formatCredits(pack.creditLimit)}</div>
                                <div className="text-xs text-gray-400">AI Credits</div>
                            </div>

                            <button
                                onClick={async () => {
                                    if (onBuyPack) {
                                        setBuyingPackIndex(i);
                                        await onBuyPack(pack);
                                        setBuyingPackIndex(null);
                                    }
                                }}
                                disabled={buyingPackIndex !== null}
                                className={`w-full py-2.5 rounded-lg text-sm font-bold text-white transition-colors shadow-lg ${buyingPackIndex === i
                                    ? 'bg-gray-600 cursor-not-allowed'
                                    : 'bg-gray-700 hover:bg-indigo-500 group-hover:bg-indigo-600 group-hover:hover:bg-indigo-500 group-hover:text-white'
                                    }`}
                            >
                                {buyingPackIndex === i ? 'Processing...' : 'Purchase in App'}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mt-12">
                    <TopUpCalculator
                        dynamicConfig={dynamicConfig}
                        currentTier={currentTier}
                        billingInterval={billingInterval}
                        rate={rate}
                        onUpgrade={onSubscribe}
                    />
                </div>
            </div>
        </div>
    );
};

export default SubscriptionSelection;
