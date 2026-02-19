import React, { useState } from 'react';

const OPERATORS = {
    string: [
        { id: 'contains', label: 'contains' },
        { id: 'is', label: 'is exactly' },
        { id: 'not', label: 'is not' }
    ],
    number: [
        { id: 'gt', label: 'is greater than' },
        { id: 'lt', label: 'is less than' },
        { id: 'eq', label: 'is exactly' }
    ],
    select: [
        { id: 'in', label: 'is one of' },
        { id: 'not_in', label: 'is none of' }
    ],
    color: [
        { id: 'contains', label: 'contains' },
        { id: 'contains_any', label: 'contains any of' },
        { id: 'is_exactly', label: 'is exactly' }
    ],
    boolean: [
        { id: 'is', label: 'is' }
    ]
};

const FIELDS = [
    { id: 'name', label: 'Name', type: 'string' },
    { id: 'colors', label: 'Color Identity', type: 'color' },
    { id: 'rarity', label: 'Rarity', type: 'select', options: ['common', 'uncommon', 'rare', 'mythic'] },
    { id: 'type', label: 'Type Line', type: 'string' },
    { id: 'price', label: 'Market Price ($)', type: 'number' },
    { id: 'cmc', label: 'Mana Value (CMC)', type: 'number' },
    { id: 'set', label: 'Set Code', type: 'string' },
    { id: 'count', label: 'Quantity', type: 'number' },
    {
        id: 'in_deck', label: 'In a Deck?', type: 'boolean', options: [
            { id: 'true', label: 'In a Deck' },
            { id: 'false', label: 'Not in a Deck' }
        ]
    }
];

const RuleBuilder = ({ rules: propRules = [], onChange }) => {
    const rules = Array.isArray(propRules) ? propRules : [];
    const [showRaw, setShowRaw] = useState(false);

    const addRule = () => {
        const newRule = { field: 'name', operator: 'contains', value: '' };
        onChange([...rules, newRule]);
    };

    const updateRule = (index, updates) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], ...updates };

        // Reset operator if field type changes
        if (updates.field) {
            const field = FIELDS.find(f => f.id === updates.field);
            const ops = OPERATORS[field.type] || OPERATORS.string;
            newRules[index].operator = ops[0].id;
            newRules[index].value = field.type === 'select' ? [] : field.type === 'color' ? [] : field.type === 'boolean' ? field.options[0].id : '';
        }

        onChange(newRules);
    };

    const removeRule = (index) => {
        onChange(rules.filter((_, i) => i !== index));
    };

    const handleColorToggle = (index, color) => {
        const currentValues = rules[index].value || [];
        const nextValues = currentValues.includes(color)
            ? currentValues.filter(c => c !== color)
            : [...currentValues, color].sort((a, b) => 'WUBRG'.indexOf(a) - 'WUBRG'.indexOf(b));
        updateRule(index, { value: nextValues });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Logic Rules</h3>
                <button
                    onClick={addRule}
                    className="text-[10px] font-bold bg-primary-600/20 text-primary-400 border border-primary-500/30 px-3 py-1 rounded-full hover:bg-primary-600 hover:text-white transition-all"
                >
                    + Add Condition
                </button>
            </div>

            <div className="space-y-3">
                {rules.map((rule, idx) => {
                    const field = FIELDS.find(f => f.id === rule.field) || FIELDS[0];
                    const ops = OPERATORS[field.type] || OPERATORS.string;

                    return (
                        <div key={idx} className="group flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-gray-950/40 p-3 rounded-2xl border border-gray-800/50 hover:border-gray-700 transition-all">
                            {/* IF / AND Prefix */}
                            <div className="w-12 text-[10px] font-black uppercase text-primary-500/60">
                                {idx === 0 ? 'IF' : 'AND'}
                            </div>

                            {/* Field Selector */}
                            <select
                                value={rule.field}
                                onChange={(e) => updateRule(idx, { field: e.target.value })}
                                className="bg-gray-950/50 border border-white/5 text-white text-xs font-black rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            >
                                {FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </select>

                            {/* Operator Selector */}
                            <select
                                value={rule.operator}
                                onChange={(e) => updateRule(idx, { operator: e.target.value })}
                                className="bg-gray-950/50 border border-white/5 text-primary-400 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            >
                                {ops.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                            </select>

                            {/* Value Input */}
                            <div className="flex-1 min-w-[150px]">
                                {field.type === 'color' ? (
                                    <div className="flex gap-1">
                                        {'WUBRGC'.split('').map(c => (
                                            <button
                                                key={c}
                                                onClick={() => handleColorToggle(idx, c)}
                                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border ${rule.value?.includes(c)
                                                    ? 'bg-primary-600 border-primary-400 shadow-[0_0_10px_rgba(79,70,229,0.4)]'
                                                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'
                                                    }`}
                                            >
                                                <i className={`ms ms-${c.toLowerCase()} ms-cost text-xs ${rule.value?.includes(c) ? 'text-white' : ''}`}></i>
                                            </button>
                                        ))}
                                    </div>
                                ) : field.type === 'select' ? (
                                    <div className="flex flex-wrap gap-1">
                                        {field.options.map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    const current = rule.value || [];
                                                    const next = current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt];
                                                    updateRule(idx, { value: next });
                                                }}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all border ${rule.value?.includes(opt)
                                                    ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                                                    : 'bg-gray-800 border-gray-700 text-gray-500'
                                                    }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                ) : field.type === 'boolean' ? (
                                    <div className="flex gap-1">
                                        {field.options.map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => updateRule(idx, { value: opt.id })}
                                                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${rule.value === opt.id
                                                    ? 'bg-primary-600 border-primary-400 text-white'
                                                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <input
                                        type={field.type === 'number' ? 'number' : 'text'}
                                        value={rule.value}
                                        placeholder="Value..."
                                        onChange={(e) => updateRule(idx, { value: e.target.value })}
                                        className="w-full bg-gray-900/50 border-none text-white text-xs rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                )}
                            </div>

                            {/* Remove Action */}
                            <button
                                onClick={() => removeRule(idx)}
                                className="p-1 px-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-sm"
                                title="Remove Rule"
                            >
                                ×
                            </button>
                        </div>
                    );
                })}

                {rules.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-800 rounded-3xl">
                        <p className="text-gray-600 text-sm font-medium italic">No rules defined. This binder will be empty or use manual selection.</p>
                        <button
                            onClick={addRule}
                            className="text-primary-400 text-xs font-bold mt-2 hover:underline"
                        >
                            + Click to create your first rule
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-4 p-4 bg-primary-950/10 border border-primary-900/20 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary-400">Binder Recipe Output</span>
                    </div>
                    <button
                        onClick={() => setShowRaw(!showRaw)}
                        className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-wider"
                    >
                        {showRaw ? 'Show Preview' : 'Import / Export'}
                    </button>
                </div>

                {showRaw ? (
                    <div>
                        <textarea
                            value={JSON.stringify(rules, null, 2)}
                            onChange={(e) => {
                                try {
                                    const parsed = JSON.parse(e.target.value);
                                    if (Array.isArray(parsed)) {
                                        onChange(parsed);
                                    }
                                } catch (err) {
                                    // Allow typing, but don't update if invalid JSON yet
                                }
                            }}
                            className="w-full h-32 bg-gray-900/50 border border-primary-500/30 rounded-xl p-3 text-[10px] font-mono text-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y"
                            placeholder="Paste rule JSON here..."
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                            Copy this JSON to share rules between binders. Paste existing JSON to load it.
                        </p>
                    </div>
                ) : (
                    <div className="font-mono text-[10px] text-gray-500 break-all leading-relaxed select-text cursor-text active:text-primary-400 transition-colors"
                        onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(rules, null, 2));
                            // Optional: Could show a small toast here if we had access to addToast context easily, 
                            // but for now the visual feedback of text selection is enough or we assume power users use the Import/Export view.
                        }}
                        title="Click to copy JSON to clipboard"
                    >
                        {rules.length > 0 ? (
                            <>
                                SELECT * FROM collection WHERE user_id = current_user
                                {rules.map((r, i) => (
                                    <span key={i} className="text-primary-300/60 block ml-4">
                                        AND {r.field} {r.operator} '{Array.isArray(r.value) ? r.value.join(', ') : r.value}'
                                    </span>
                                ))}
                            </>
                        ) : (
                            "-- No rules defined yet --"
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default RuleBuilder;
