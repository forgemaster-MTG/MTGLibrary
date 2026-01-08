import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useBinders } from '../../hooks/useBinders';

const ARCHETYPES = [
    {
        id: 'deckbuilder',
        name: "The Deckbuilder",
        description: "Optimized for brewing and gameplay. Find specific effects and colors instantly.",
        features: [
            "Sort by Color Identity & Type",
            "Group by Card Color",
            "Best for: Commander players",
            "Fastest to find game pieces"
        ],
        icon: "🛠️",
        sort: ['color_identity', 'type', 'cmc', 'name'],
        grouping: 'color'
    },
    {
        id: 'collector',
        name: "The Collector",
        description: "Traditional binder organization. Perfect for tracking set completion and variants.",
        features: [
            "Sort by Set & Collector Number",
            "Group by Expansion Set",
            "Best for: Set completists",
            "Matches physical binder layouts"
        ],
        icon: "📚",
        sort: ['set', 'collector_number', 'name'],
        grouping: 'set'
    },
    {
        id: 'hybrid',
        name: "The Hybrid",
        description: "The best of both. Keep your bulk in boxes and your staples in binders.",
        features: [
            "Bulk sorted by Set (Boxes)",
            "Smart Binders for Rares/Foils",
            "Best for: Large collections",
            "Separates value from bulk"
        ],
        icon: "⚡",
        sort: ['set', 'collector_number'], // Bulk default
        grouping: 'set',
        hasSmartBinders: true
    },
    {
        id: 'advanced',
        name: "Advanced",
        description: "Complete control. Define your own sorting and priority hierarchy.",
        features: [
            "Custom Sort Logic (Max 4 layers)",
            "User-defined Grouping",
            "Best for: Specific needs",
            "Full granularity control"
        ],
        icon: "⚙️",
        sort: [], // Custom
        grouping: 'custom'
    }
];

const SORT_OPTIONS = [
    { value: 'color', label: 'Color' },
    { value: 'color_identity', label: 'Color Identity' },
    { value: 'type', label: 'Card Type' },
    { value: 'cmc', label: 'Mana Value (CMC)' },
    { value: 'rarity', label: 'Rarity' },
    { value: 'set', label: 'Set Release' },
    { value: 'collector_number', label: 'Collector Number' },
    { value: 'name', label: 'Name' },
    { value: 'price', label: 'Price' },
    { value: 'power', label: 'Power' },
    { value: 'toughness', label: 'Toughness' },
    { value: 'artist', label: 'Artist' }
];

const OrganizationWizardModal = ({ isOpen, onClose, onComplete }) => {
    const { updateSettings } = useAuth();
    const { createBinder } = useBinders(); // Assuming functionality exists
    const [step, setStep] = useState(1);
    const [selectedArchetype, setSelectedArchetype] = useState(null);
    const [customSort, setCustomSort] = useState([null, null, null, null]); // Max 4
    const [hybridOptions, setHybridOptions] = useState({
        rares: true,
        foils: true,
        value: true,
        valueThreshold: 2.00
    });
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleArchetypeSelect = (id) => {
        const arch = ARCHETYPES.find(a => a.id === id);
        setSelectedArchetype(arch);
        if (id === 'advanced') {
            setStep(1.5);
        } else if (id === 'hybrid') {
            setStep(2);
        } else {
            // Instant save for simple profiles
            finish(arch.sort, arch.grouping);
        }
    };

    const handleCustomSortChange = (index, value) => {
        const newSort = [...customSort];
        newSort[index] = value;
        setCustomSort(newSort);
    };

    const finish = async (sortHierarchy, groupingPreference) => {
        setSaving(true);
        try {
            // 1. Save Settings
            const cleanSort = sortHierarchy.filter(Boolean);

            // If Advanced and no explicit grouping, infer from first sort key
            let finalGrouping = groupingPreference;
            if (groupingPreference === 'custom' && cleanSort.length > 0) {
                // Map sort keys to grouping keys
                const primary = cleanSort[0];
                if (['color', 'color_identity'].includes(primary)) finalGrouping = 'color';
                else if (['set', 'release'].includes(primary)) finalGrouping = 'set';
                else if (['type'].includes(primary)) finalGrouping = 'type';
                else if (['rarity'].includes(primary)) finalGrouping = 'rarity';
                else finalGrouping = 'color'; // Fallback
            }

            const organizationSettings = {
                mode: selectedArchetype.id,
                sortHierarchy: cleanSort,
                groupingPreference: finalGrouping
            };

            await updateSettings({ organization: organizationSettings });

            // Note: We no longer auto-create binders in the DB.
            // visual "Smart Binders" are handled dynamically in CollectionPage.

            if (onComplete) onComplete();
            else onClose();
        } catch (err) {
            console.error("Failed to save organization settings", err);
            // Add toast here
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl relative">

                {/* Header */}
                <div className="p-8 pb-0 text-center">
                    <h2 className="text-3xl font-black text-white mb-2">Organize Your Collection</h2>
                    <p className="text-gray-400">Make your digital library feel like home.</p>
                </div>

                <div className="p-8">
                    {/* STEP 1: Archetype */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {ARCHETYPES.map(arch => (
                                <button
                                    key={arch.id}
                                    onClick={() => handleArchetypeSelect(arch.id)}
                                    className="group relative bg-gray-800/50 hover:bg-gray-800 border-2 border-transparent hover:border-indigo-500 rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col h-full"
                                >
                                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{arch.icon}</div>
                                    <h3 className="text-xl font-bold text-white mb-2">{arch.name}</h3>
                                    <p className="text-sm text-gray-300 mb-4 h-12">{arch.description}</p>

                                    <ul className="text-xs text-gray-400 space-y-2 mt-auto pt-4 border-t border-gray-700/50">
                                        {arch.features.map((feature, i) => (
                                            <li key={i} className="flex items-center gap-2">
                                                <span className="text-indigo-500">•</span>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* STEP 1.5: Advanced Sort */}
                    {step === 1.5 && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <p className="text-indigo-300 font-bold uppercase tracking-widest text-xs text-center">Define your custom hierarchy (Max 4)</p>

                            <div className="space-y-3 max-w-md mx-auto">
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-500 border border-gray-700">
                                            {i + 1}
                                        </div>
                                        <select
                                            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={customSort[i] || ''}
                                            onChange={(e) => handleCustomSortChange(i, e.target.value)}
                                        >
                                            <option value="">(None)</option>
                                            {SORT_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-6">
                                <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white font-bold">Back</button>
                                <button
                                    onClick={() => finish(customSort, 'custom')}
                                    disabled={!customSort[0] || saving}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Applying...' : 'Apply Hierarchy'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Hybrid Options */}
                    {step === 2 && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl mb-4">
                                <p className="text-sm text-indigo-300">
                                    We'll set your main view to <strong>Set & Collector Number</strong> (for your boxes),
                                    and create <strong>Smart Binders</strong> for your special cards.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hybridOptions.rares}
                                        onChange={e => setHybridOptions({ ...hybridOptions, rares: e.target.checked })}
                                        className="w-5 h-5 text-indigo-500 rounded focus:ring-indigo-500 bg-gray-900 border-gray-600"
                                    />
                                    <div>
                                        <div className="font-bold text-white">Rares & Mythics</div>
                                        <div className="text-xs text-gray-400">Create a "Trade Binder" for high rarity cards.</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hybridOptions.foils}
                                        onChange={e => setHybridOptions({ ...hybridOptions, foils: e.target.checked })}
                                        className="w-5 h-5 text-indigo-500 rounded focus:ring-indigo-500 bg-gray-900 border-gray-600"
                                    />
                                    <div>
                                        <div className="font-bold text-white">Foils</div>
                                        <div className="text-xs text-gray-400">Create a separate "Foils" binder.</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hybridOptions.value}
                                        onChange={e => setHybridOptions({ ...hybridOptions, value: e.target.checked })}
                                        className="w-5 h-5 text-indigo-500 rounded focus:ring-indigo-500 bg-gray-900 border-gray-600"
                                    />
                                    <div className="flex-1">
                                        <div className="font-bold text-white">Valuable Cards</div>
                                        <div className="text-xs text-gray-400">Create a "High Value" binder.</div>
                                    </div>
                                    {hybridOptions.value && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400">$</span>
                                            <input
                                                type="number"
                                                value={hybridOptions.valueThreshold}
                                                onChange={e => setHybridOptions({ ...hybridOptions, valueThreshold: e.target.value })}
                                                className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </div>
                                    )}
                                </label>
                            </div>

                            <div className="flex justify-between pt-6">
                                <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white font-bold">Back</button>
                                <button
                                    onClick={() => finish(selectedArchetype.sort, selectedArchetype.grouping, true)}
                                    disabled={saving}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Configuring...' : 'Finish Setup'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrganizationWizardModal;
