import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const DeckCharts = ({ cards = [], type = 'all' }) => {
    // 1. Mana Curve Data
    const manaData = useMemo(() => {
        const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
        cards.forEach(card => {
            const data = card.data || card; // Handle both structures
            const typeLine = (data.type_line || '').toLowerCase();
            if (typeLine.includes('land') && !typeLine.includes('creature') && !typeLine.includes('artifact')) return; // Roughly exclude lands, but allow artifact lands? Legacy excluded lands.

            const cmc = data.cmc ?? data.manavalue ?? 0;
            if (cmc >= 7) counts['7+']++;
            else counts[Math.floor(cmc)]++;
        });
        return Object.entries(counts).map(([label, value]) => ({ label, value }));
    }, [cards]);

    // 2. Type Distribution
    const typeData = useMemo(() => {
        const counts = {};
        cards.forEach(card => {
            const data = card.data || card;
            const typeLine = data.type_line || '';
            const supportedTypes = ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Battle'];

            supportedTypes.forEach(t => {
                if (typeLine.includes(t)) {
                    counts[t] = (counts[t] || 0) + 1;
                }
            });
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [cards]);

    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c', '#d0ed57', '#8dd1e1'];

    const renderManaCurve = () => (
        <div className="h-full w-full min-h-[160px]">
            {type === 'all' && <h3 className="text-lg font-medium text-white mb-4 text-center">Mana Curve</h3>}
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={manaData}>
                    <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#9ca3af" allowDecimals={false} tick={{ fontSize: 12 }} width={30} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {manaData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );

    const renderTypeDist = () => (
        <div className="h-full w-full min-h-[160px]">
            <h3 className="text-lg font-medium text-white mb-4 text-center">Card Types</h3>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={typeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius="80%"
                        fill="#8884d8"
                        dataKey="value"
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                            return null;
                        }}
                    >
                        {typeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                    <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );

    if (type === 'mana') {
        return <div className="w-full h-full">{renderManaCurve()}</div>;
    }

    if (type === 'types') {
        return <div className="w-full h-full">{renderTypeDist()}</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-800 rounded-xl border border-gray-700">
            <div className="h-64">{renderManaCurve()}</div>
            <div className="h-64">{renderTypeDist()}</div>
        </div>
    );
};

export default DeckCharts;
