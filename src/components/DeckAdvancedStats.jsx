import React, { useMemo } from 'react';

const MANA_COLORS = [
    { key: 'W', name: 'White', color: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200/50', bg: 'bg-yellow-500/10', pip: '☀️' },
    { key: 'U', name: 'Blue', color: 'bg-blue-400', text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', pip: '💧' },
    { key: 'B', name: 'Black', color: 'bg-gray-600', text: 'text-gray-400', border: 'border-gray-500/30', bg: 'bg-gray-500/10', pip: '💀' },
    { key: 'R', name: 'Red', color: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/10', pip: '🔥' },
    { key: 'G', name: 'Green', color: 'bg-green-500', text: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10', pip: '🌳' },
    { key: 'C', name: 'Colorless', color: 'bg-gray-400', text: 'text-gray-500', border: 'border-gray-600/30', bg: 'bg-gray-600/10', pip: '💎' }
];

const DeckAdvancedStats = ({ cards = [] }) => {
    const stats = useMemo(() => {
        const counts = {
            pips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            production: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            curve: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 },
            colorCurve: {
                W: [0, 0, 0, 0, 0, 0, 0, 0], U: [0, 0, 0, 0, 0, 0, 0, 0], B: [0, 0, 0, 0, 0, 0, 0, 0],
                R: [0, 0, 0, 0, 0, 0, 0, 0], G: [0, 0, 0, 0, 0, 0, 0, 0], C: [0, 0, 0, 0, 0, 0, 0, 0]
            },
            totalPips: 0,
            totalProduction: 0,
            nonLandCount: 0,
            avgCMC: 0
        };

        let totalCMC = 0;

        cards.forEach(card => {
            const data = card.data || card;
            const typeLine = (data.type_line || '').toLowerCase();
            const isLand = typeLine.includes('land');
            const manaCost = data.mana_cost || '';
            const oracle = (data.oracle_text || '').toLowerCase();

            // 1. Mana Pips (Cost) - Excluding Lands unless they have a cost (rare)
            if (!isLand) {
                counts.nonLandCount += (card.countInDeck || 1);
                const cmc = data.cmc ?? 0;
                totalCMC += cmc * (card.countInDeck || 1);

                // Parse pips
                const pips = manaCost.match(/\{([^}]+)\}/g) || [];
                pips.forEach(p => {
                    const symbol = p.slice(1, -1);
                    // Handle hybrid {W/U}, {B/P}, {2/G}
                    const parts = symbol.split('/');
                    parts.forEach(part => {
                        if (['W', 'U', 'B', 'R', 'G', 'C'].includes(part)) {
                            counts.pips[part] += (card.countInDeck || 1);
                            counts.totalPips += (card.countInDeck || 1);

                            // Color Curve
                            const idx = Math.min(Math.floor(cmc), 7);
                            counts.colorCurve[part][idx] += (card.countInDeck || 1);
                        }
                    });
                });

                // Overall Curve
                const curveIdx = cmc >= 7 ? '7+' : Math.floor(cmc);
                counts.curve[curveIdx] += (card.countInDeck || 1);
            }

            // 2. Production
            let produced = data.produced_mana || [];

            // Heuristics for "Any Color" or mana rocks
            if (oracle.includes('any color') || oracle.includes('mana of any color')) {
                produced = ['W', 'U', 'B', 'R', 'G'];
            }
            // Basic land fallback if produced_mana is missing
            if (produced.length === 0 && isLand) {
                if (typeLine.includes('plains')) produced.push('W');
                if (typeLine.includes('island')) produced.push('U');
                if (typeLine.includes('swamp')) produced.push('B');
                if (typeLine.includes('mountain')) produced.push('R');
                if (typeLine.includes('forest')) produced.push('G');
            }
            // Mana rocks / dorks heuristics
            if (!isLand && oracle.includes('add {')) {
                ['w', 'u', 'b', 'r', 'g', 'c'].forEach(c => {
                    if (oracle.includes(`add {${c}}`)) produced.push(c.toUpperCase());
                });
            }

            const uniqueProduced = [...new Set(produced)];
            uniqueProduced.forEach(p => {
                if (counts.production[p] !== undefined) {
                    counts.production[p] += (card.countInDeck || 1);
                    counts.totalProduction += (card.countInDeck || 1);
                }
            });
        });

        counts.avgCMC = counts.nonLandCount > 0 ? (totalCMC / counts.nonLandCount).toFixed(2) : 0;
        return counts;
    }, [cards]);

    const renderHistogram = (data, colorClass = 'bg-primary-500', height = 'h-48') => {
        const entries = Object.entries(data);
        const maxVal = Math.max(...entries.map(e => e[1]), 1);

        return (
            <div className={`flex gap-1 ${height} w-full px-2`}>
                {entries.map(([label, val]) => (
                    <div key={label} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                        {val > 0 && (
                            <div
                                className={`w-full ${colorClass} rounded-t transition-all duration-500 group-hover:brightness-125`}
                                style={{ height: `${(val / maxVal) * 100}%` }}
                            >
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 px-1 rounded">
                                    {val}
                                </div>
                            </div>
                        )}
                        <div className="text-[10px] font-bold text-gray-500 mt-2">{label}</div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* 1. Aggregate Bars */}
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span>Cost (Pips)</span>
                        <span>{stats.totalPips} Total</span>
                    </div>
                    <div className="h-4 w-full bg-gray-900/50 rounded-full overflow-hidden flex border border-gray-800">
                        {MANA_COLORS.filter(c => stats.pips[c.key] > 0).map(c => (
                            <div
                                key={c.key}
                                className={`${c.color} h-full transition-all duration-700`}
                                style={{ width: `${(stats.pips[c.key] / stats.totalPips) * 100}%` }}
                                title={`${c.name}: ${stats.pips[c.key]}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span>Production</span>
                        <span>{stats.totalProduction} Sources</span>
                    </div>
                    <div className="h-4 w-full bg-gray-900/50 rounded-full overflow-hidden flex border border-gray-800 shadow-inner">
                        {MANA_COLORS.filter(c => stats.production[c.key] > 0).map(c => (
                            <div
                                key={c.key}
                                className={`${c.color} h-full transition-all duration-700 opacity-80`}
                                style={{ width: `${(stats.production[c.key] / stats.totalProduction) * 100}%` }}
                                title={`${c.name}: ${stats.production[c.key]}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. Color Panels Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {MANA_COLORS.map(c => {
                    const pipCount = stats.pips[c.key];
                    const prodCount = stats.production[c.key];
                    const pipPerc = stats.totalPips > 0 ? Math.round((pipCount / stats.totalPips) * 100) : 0;
                    const prodPerc = stats.totalProduction > 0 ? Math.round((prodCount / stats.totalProduction) * 100) : 0;
                    const isActive = pipCount > 0 || prodCount > 0;

                    return (
                        <div key={c.key} className={`p-4 rounded-2xl border transition-all duration-300 ${isActive ? `${c.bg} ${c.border}` : 'bg-gray-800/10 border-gray-800/50 opacity-40'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-2xl">{c.pip}</span>
                                <div className="text-right">
                                    <div className={`text-[10px] font-black uppercase tracking-tighter ${c.text}`}>{c.name}</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase">
                                        <span>Cost</span>
                                        <span className="text-white">{pipPerc}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-950 rounded-full overflow-hidden">
                                        <div className={`h-full ${c.color} transition-all duration-1000`} style={{ width: `${pipPerc}%` }} />
                                    </div>
                                    <div className="text-[10px] text-gray-600 font-mono">{pipCount} pips</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase">
                                        <span>Prod</span>
                                        <span className="text-white">{prodPerc}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-950 rounded-full overflow-hidden">
                                        <div className={`h-full ${c.color} opacity-60 transition-all duration-1000`} style={{ width: `${prodPerc}%` }} />
                                    </div>
                                    <div className="text-[10px] text-gray-600 font-mono">{prodCount} mana</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 3. Main Curve */}
            <div className="bg-gray-950/40 p-6 rounded-2xl border border-gray-800/50">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter">Mana Curve</h3>
                        <p className="text-xs text-gray-500 font-medium">Average Mana Value (Non-lands): <span className="text-primary-400">{stats.avgCMC}</span></p>
                    </div>
                </div>
                {renderHistogram(stats.curve, 'bg-primary-500', 'h-40')}
            </div>

            {/* 4. Color Curves */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {MANA_COLORS.filter(c => stats.pips[c.key] > 0).map(c => (
                    <div key={c.key} className="bg-gray-900/30 p-4 rounded-xl border border-gray-800/50">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-lg">{c.pip}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{c.name} Spells</span>
                        </div>
                        {renderHistogram(
                            Object.fromEntries(stats.colorCurve[c.key].map((v, i) => [i === 7 ? '7+' : i, v])),
                            c.color,
                            'h-24'
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DeckAdvancedStats;
