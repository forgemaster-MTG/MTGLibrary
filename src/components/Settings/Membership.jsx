import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { TIERS, TIER_CONFIG, getTierConfig } from '../../config/tiers';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { CreditCard, Star, Shield, Zap, Crown, X } from 'lucide-react';
import { useCollection } from '../../hooks/useCollection';
import { useDecks } from '../../hooks/useDecks';
import SubscriptionSelection from '../onboarding/SubscriptionSelection';

const Membership = () => {
    const { userProfile, currentUser, refreshUserProfile } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [billingInterval, setBillingInterval] = useState('monthly');
    const [dynamicConfig, setDynamicConfig] = useState(null);

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
        // 1. Use explicit Top-Up Rate if configured (Millions -> Raw)
        if (dynamicConfig?.assumptions?.topUpCreditRate) {
            return dynamicConfig.assumptions.topUpCreditRate * 1000000;
        }

        // 2. Fallback to average of tiers
        if (!dynamicConfig?.tiers) return 2300000;

        let total = 0;
        let count = 0;
        dynamicConfig.tiers.forEach(t => {
            // Support both simple 'price' and 'prices' array
            const price = t.price || (t.prices?.find(p => p.interval === 'monthly')?.amount / 100);
            if (price > 0 && t.creditLimit > 0) {
                total += (t.creditLimit / price);
                count++;
            }
        });
        return count > 0 ? Math.floor(total / count) : 2300000;
    }, [dynamicConfig]);

    // Data Hooks for Usage Stats
    const { cards: collection } = useCollection();
    const { decks } = useDecks();

    // Use override_tier if present, otherwise subscription_tier, default to FREE
    const currentTierId = userProfile?.override_tier || userProfile?.subscription_tier;
    const config = getTierConfig(currentTierId);

    const getCreditLimit = (tierKey) => {
        if (!dynamicConfig) return TIER_CONFIG[tierKey]?.limits?.aiCredits || 0;

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

    // Fallback if subscription_status is missing but tier is not free (manual assignment)
    const status = userProfile?.subscription_status || (currentTierId !== TIERS.FREE ? 'active' : 'free');

    // Calculate effective end date (Trial > Subscription)
    const isTrial = status === 'trial';
    const endDateRaw = isTrial ? userProfile?.trial_end_date : userProfile?.subscription_end_date;
    const endDate = endDateRaw ? new Date(endDateRaw).toLocaleDateString() : null;

    // Calculate Usage Stats
    const stats = useMemo(() => {
        if (!collection || !decks) return { decks: 0, collection: 0, wishlist: 0 };

        const collectionItems = collection.filter(c => !c.is_wishlist);
        const wishlistItems = collection.filter(c => c.is_wishlist);

        // Base counts
        let totalCards = collectionItems.reduce((acc, card) => acc + (card.count || 1), 0);
        let wishlistCount = wishlistItems.reduce((acc, card) => acc + (card.count || 1), 0);

        return {
            decks: decks.length,
            collection: totalCards,
            wishlist: wishlistCount,
            credits: (userProfile?.credits_monthly || 0) + (userProfile?.credits_topup || 0)
        };
    }, [collection, decks]);

    const handleManageSubscription = async () => {
        setIsLoading(true);
        try {
            const response = await api.post('/api/payments/create-portal-session', {});
            if (response.url) {
                window.location.href = response.url;
            } else {
                alert('Failed to redirect to billing portal.');
            }
        } catch (error) {
            console.error("Billing portal error:", error);
            alert('Could not open billing portal. ' + (error.response?.data?.error || error.message));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubscribe = async (tierId) => {
        setIsLoading(true);
        try {
            const response = await api.post('/api/payments/create-checkout-session', {
                tierId,
                interval: billingInterval,
                successUrl: `${window.location.origin}/settings?success=true`,
                cancelUrl: `${window.location.origin}/settings?canceled=true`
            });

            if (response.url) {
                window.location.href = response.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (error) {
            console.error("Subscription error:", error);
            alert(error.message || 'Failed to start subscription process');
            setIsLoading(false);
        }
    };

    const handleBuyPack = async (pack) => {
        setIsLoading(true);
        try {
            const response = await api.post('/api/payments/create-topup-session', {
                credits: pack.creditLimit,
                cost: pack.price,
                priceId: pack.priceId
            });
            if (response.url) {
                window.location.href = response.url;
            }
        } catch (error) {
            console.error("Top-up error:", error);
            alert('Failed to start top-up checkout.');
            setIsLoading(false);
        }
    };

    const getTierIcon = (tierId) => {
        switch (tierId) {
            case TIERS.FREE: return <Shield className="w-12 h-12 text-gray-400" />;
            case TIERS.TIER_1: return <Star className="w-12 h-12 text-blue-400" />;
            case TIERS.TIER_2: return <Zap className="w-12 h-12 text-purple-400" />;
            case TIERS.TIER_3: return <Crown className="w-12 h-12 text-yellow-400" />;
            case TIERS.TIER_4: return <Crown className="w-12 h-12 text-orange-500" />;
            case TIERS.TIER_5: return <Crown className="w-12 h-12 text-red-500" />;
            default: return <Shield className="w-12 h-12 text-gray-400" />;
        }
    };

    const renderProgressBar = (label, current, max, icon) => {
        const percentage = max === Infinity ? 0 : Math.min((current / max) * 100, 100);

        let isNearLimit = false;
        let colorClass = 'bg-green-500';

        if (label === 'AI Credits') {
            // Inverted logic for credits (Remaining / Max)
            // Low % is Bad (Red)
            isNearLimit = max > 0 && (current / max) < 0.1;
            if (percentage < 10) colorClass = 'bg-red-500';
            else if (percentage < 30) colorClass = 'bg-yellow-500';
            else colorClass = 'bg-green-500';
        } else {
            // Standard logic (Used / Max)
            // High % is Bad (Red)
            isNearLimit = max !== Infinity && (current / max) >= 0.9;
            if (max === Infinity) colorClass = 'bg-blue-500';
            else if (percentage >= 90) colorClass = 'bg-red-500';
            else if (percentage >= 75) colorClass = 'bg-yellow-500';
        }

        return (
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm font-medium flex items-center gap-2">
                        <span>{icon}</span> {label}
                    </span>
                    <span className={`font-bold text-sm ${isNearLimit ? 'text-red-400' : 'text-white'}`}>
                        {current} / {max === Infinity ? '∞' : max}
                    </span>
                </div>

                <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-700/50">
                    <div
                        className={`h-full ${colorClass} transition-all duration-1000 ease-out`}
                        style={{ width: max === Infinity ? '100%' : `${percentage}%` }}
                    />
                </div>
                {
                    isNearLimit && (
                        <p className="text-[10px] text-red-400 mt-1 mt-2">
                            {label === 'AI Credits' ? 'Running low on credits!' : 'Running low on space!'}
                        </p>
                    )
                }
            </div >
        );
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-4">Membership & Billing</h2>

            {/* Current Plan Card */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-start justify-between relative z-10 gap-6">
                    <div className="flex gap-4">
                        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 shrink-0">
                            {getTierIcon(currentTierId)}
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-1">{config.name}</h3>
                            <p className="text-gray-400 text-sm max-w-md">{config.description}</p>

                            <div className="flex flex-col gap-2 mt-4">
                                {/* Status Badge */}
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border ${status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                        status === 'canceled' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                            isTrial ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                status === 'past_due' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    'bg-gray-700 text-gray-300 border-gray-600'
                                        }`}>
                                        {status === 'free' ? 'Free Plan' : status === 'trial' ? 'Full Access Trial' : status.replace('_', ' ')}
                                    </span>
                                    {userProfile?.override_tier && (
                                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border bg-purple-500/10 text-purple-400 border-purple-500/20">
                                            Admin Override
                                        </span>
                                    )}
                                </div>

                                {/* Timer / Renewal Info */}
                                {endDate && status !== 'free' && !userProfile?.override_tier && (
                                    <div className={`mt-2 p-3 rounded-lg border ${isTrial ? 'bg-blue-500/10 border-blue-500/30' : 'bg-gray-800 border-gray-700'}`}>
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                                            {status === 'canceled' ? 'Access Expires' : (isTrial ? 'Trial Remaining' : 'Next Renewal')}
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            {isTrial ? (
                                                <>
                                                    <span className="text-xl font-bold text-white">
                                                        {Math.max(0, Math.ceil((new Date(endDateRaw) - new Date()) / (1000 * 60 * 60 * 24)))}
                                                    </span>
                                                    <span className="text-sm text-gray-400">Days Left</span>
                                                    <span className="text-xs text-gray-500 ml-1">({endDate})</span>
                                                </>
                                            ) : (
                                                <span className="text-sm font-bold text-white">
                                                    {new Date(endDateRaw).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 w-full md:w-auto">
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-purple-900/20 transition-all hover:scale-105 whitespace-nowrap"
                        >
                            {currentTierId === TIERS.FREE ? 'Upgrade Plan' : 'Change Plan'}
                        </button>

                        {currentTierId !== TIERS.FREE && (
                            <button
                                onClick={handleManageSubscription}
                                disabled={isLoading}
                                className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium border border-gray-600 transition-colors text-sm"
                            >
                                <CreditCard className="w-4 h-4" />
                                {isLoading ? 'Loading...' : 'Manage Billing'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-purple-500/10 to-transparent rounded-bl-full pointer-events-none" />
            </div>

            {/* Usage Tracking */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">📊</span> Usage & Limits
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {renderProgressBar('AI Credits', stats.credits, getCreditLimit(currentTierId), '⚡')}
                    {renderProgressBar('Decks', stats.decks, config.limits.decks, '📚')}
                    {renderProgressBar('Collection', stats.collection, config.limits.collection, '🃏')}
                    {renderProgressBar('Wishlist', stats.wishlist, config.limits.wishlist, '✨')}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-right">
                    * Limits apply to active items. Archived/Deleted items do not count.
                </p>
            </div>

            {/* Upgrade Modal */}
            {showUpgradeModal && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-24 text-left font-sans">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
                    <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-[95vw] max-h-[85vh] overflow-y-auto shadow-2xl animate-scale-in">
                        <div className="sticky top-0 z-20 flex justify-between items-center p-6 bg-gray-900/95 backdrop-blur border-b border-gray-800">
                            <h2 className="text-2xl font-bold text-white">Select a Plan</h2>
                            <button onClick={() => setShowUpgradeModal(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 md:p-8">
                            <SubscriptionSelection
                                billingInterval={billingInterval}
                                setBillingInterval={setBillingInterval}
                                onSubscribe={handleSubscribe}
                                isLoading={isLoading}
                                currentTier={currentTierId}
                                dynamicConfig={dynamicConfig}
                                rate={avgRate}
                                onBuyPack={handleBuyPack}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};

export default Membership;
