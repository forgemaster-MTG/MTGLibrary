import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useMarketData } from '../../hooks/useMarketData';

const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];

const DeckValueChart = ({ cards }) => {
    const { value } = useMarketData(cards);

    const pieData = useMemo(() => {
        if (!value) return [];
        const { distribution } = value;
        return [
            { name: 'Bulk (<$1)', value: distribution.bulk, color: '#9CA3AF' },
            { name: 'Budget ($1-5)', value: distribution.budget, color: '#10B981' },
            { name: 'Mid ($5-20)', value: distribution.mid, color: '#3B82F6' },
            { name: 'High ($20-50)', value: distribution.high, color: '#8B5CF6' },
            { name: 'Premium (>$50)', value: distribution.premium, color: '#F59E0B' },
        ].filter(d => d.value > 0);
    }, [value]);

    const topCards = useMemo(() => {
        if (!cards) return [];
        return [...cards]
            .sort((a, b) => (b.price || 0) * (b.quantity || 1) - (a.price || 0) * (a.quantity || 1))
            .slice(0, 5)
            .map(c => ({
                name: c.name,
                value: (c.price || 0) * (c.quantity || 1),
                singlePrice: c.price || 0
            }));
    }, [cards]);

    if (!value) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Distribution Donut */}
            <div className="bg-gray-900/50 p-6 rounded-2xl border border-white/5">
                <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-4">Value Distribution</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem' }}
                                itemStyle={{ color: '#F3F4F6' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                    {pieData.map(d => (
                        <div key={d.name} className="flex items-center gap-2 text-xs text-gray-400">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                            <span>{d.name}: {d.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Value Cards Bar Chart */}
            <div className="bg-gray-900/50 p-6 rounded-2xl border border-white/5">
                <h3 className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-4">Top Generators</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topCards} layout="vertical" margin={{ left: 40 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={100}
                                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                interval={0}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-gray-900 border border-gray-700 p-2 rounded shadow-xl">
                                                <p className="text-white font-bold text-xs">{data.name}</p>
                                                <p className="text-amber-400 font-mono text-xs">${data.value.toFixed(2)}</p>
                                                {data.value !== data.singlePrice && (
                                                    <p className="text-gray-500 text-[10px]">(${data.singlePrice} ea)</p>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default DeckValueChart;
