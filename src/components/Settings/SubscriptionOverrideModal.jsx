import React, { useState, useEffect } from 'react';
import { TIERS, TIER_CONFIG } from '../../config/tiers';

const SubscriptionOverrideModal = ({ isOpen, onClose, onConfirm, user }) => {
    const [selectedTier, setSelectedTier] = useState(TIERS.FREE);

    useEffect(() => {
        if (isOpen && user) {
            setSelectedTier(user.override_tier || user.subscription_tier || TIERS.FREE);
        }
    }, [isOpen, user]);

    if (!isOpen || !user) return null;

    const config = TIER_CONFIG[selectedTier];
    const isFree = selectedTier === TIERS.FREE;

    // Prices to show as "Lost Revenue"
    const prices = config.prices || {};
    // Manually mapping display prices if not in config, but config has price IDs.
    // Ideally we'd have display prices in config. 
    // Let's hardcode display maps for now based on what we know, or just list the variables.
    // The user prompt specifically asked to show: "(monthly, every 6 months, and annually) lost"

    // We can infer price from Tier Name -> Known Price map or just show them generic.
    // Let's use a helper map for display since IDs aren't human readable.
    const priceDisplay = {
        [TIERS.FREE]: { m: '$0', b: '$0', y: '$0' },
        [TIERS.TIER_1]: { m: '$2.99', b: '$14.99', y: '$29.99' },
        [TIERS.TIER_2]: { m: '$4.99', b: '$24.99', y: '$49.99' },
        [TIERS.TIER_3]: { m: '$9.99', b: '$49.99', y: '$99.99' },
        [TIERS.TIER_4]: { m: '$14.99', b: '$74.99', y: '$149.99' },
        [TIERS.TIER_5]: { m: '$19.99', b: '$99.99', y: '$199.99' },
    };

    const currentPrices = priceDisplay[selectedTier] || { m: '-', b: '-', y: '-' };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 border border-purple-500/30 rounded-xl p-6 max-w-lg w-full shadow-2xl transform transition-all animate-fade-in relative">
                <h3 className="text-xl font-bold text-white mb-2">Override Subscription</h3>
                <p className="text-gray-400 text-sm mb-6">
                    Manually set the subscription tier for <span className="text-white font-bold">{user.username}</span>.
                    This will bypass Stripe billing.
                </p>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Select Tier</label>
                        <select
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                            value={selectedTier}
                            onChange={(e) => setSelectedTier(e.target.value)}
                        >
                            {Object.values(TIERS).map(t => (
                                <option key={t} value={t}>{TIER_CONFIG[t].name} ({t.replace('tier_', 'Tier ')})</option>
                            ))}
                        </select>
                    </div>

                    {!isFree && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                            <h4 className="text-red-400 font-bold text-sm mb-2">⚠️ Potential Revenue Loss</h4>
                            <p className="text-gray-400 text-xs mb-3">
                                By overriding this user to <strong>{config.name}</strong>, you are bypassing the following billing options:
                            </p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-gray-800/50 p-2 rounded">
                                    <div className="text-xs text-gray-500">Monthly</div>
                                    <div className="text-white font-mono">{currentPrices.m}</div>
                                </div>
                                <div className="bg-gray-800/50 p-2 rounded">
                                    <div className="text-xs text-gray-500">6 Months</div>
                                    <div className="text-white font-mono">{currentPrices.b}</div>
                                </div>
                                <div className="bg-gray-800/50 p-2 rounded">
                                    <div className="text-xs text-gray-500">Yearly</div>
                                    <div className="text-white font-mono">{currentPrices.y}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3">
                    {user.override_tier && (
                        <button
                            onClick={() => onConfirm(null)}
                            className="mr-auto px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold border border-red-500/30 transition-colors"
                        >
                            Remove Override
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(selectedTier)}
                        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg"
                    >
                        Apply Override
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionOverrideModal;
