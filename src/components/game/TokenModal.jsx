import React, { useState } from 'react';

const COMMON_TOKENS = [
    { name: 'Soldier', power: 1, toughness: 1, color: 'W', type: 'Token Creature — Soldier' },
    { name: 'Zombie', power: 2, toughness: 2, color: 'B', type: 'Token Creature — Zombie' },
    { name: 'Knight', power: 2, toughness: 2, color: 'W', type: 'Token Creature — Knight', keywords: ['Vigilance'] },
    { name: 'Spirit', power: 1, toughness: 1, color: 'U', type: 'Token Creature — Spirit', keywords: ['Flying'] },
    { name: 'Goblin', power: 1, toughness: 1, color: 'R', type: 'Token Creature — Goblin' },
    { name: 'Beast', power: 3, toughness: 3, color: 'G', type: 'Token Creature — Beast' },
    { name: 'Treasure', power: 0, toughness: 0, color: 'C', type: 'Token Artifact — Treasure', text: 'T, Sacrifice this artifact: Add one mana of any color.' },
    { name: 'Clue', power: 0, toughness: 0, color: 'C', type: 'Token Artifact — Clue', text: '2, Sacrifice this artifact: Draw a card.' },
    { name: 'Food', power: 0, toughness: 0, color: 'C', type: 'Token Artifact — Food', text: '2, T, Sacrifice this artifact: You gain 3 life.' },
];

export default function TokenModal({ isOpen, onClose, onCreateToken }) {
    const [customToken, setCustomToken] = useState({
        name: '',
        power: 0,
        toughness: 0,
        type: 'Token Creature',
        color: 'C'
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-gray-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Generator Engine</h2>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Create Tokens & Emblems</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-gray-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-8">
                    {/* Common Presets */}
                    <section>
                        <h3 className="text-xs font-black text-primary-400 uppercase tracking-widest mb-4">Common Presets</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {COMMON_TOKENS.map((token) => (
                                <button
                                    key={token.name}
                                    onClick={() => onCreateToken(token)}
                                    className="flex flex-col items-start p-4 bg-white/5 border border-white/5 hover:border-primary-500/50 hover:bg-primary-500/5 rounded-2xl transition-all group"
                                >
                                    <div className="flex items-center justify-between w-full mb-2">
                                        <div className="w-8 h-8 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-[10px] font-black group-hover:scale-110 transition-transform">
                                            {token.color}
                                        </div>
                                        {token.power > 0 && (
                                            <span className="text-xs font-black text-gray-400 group-hover:text-white transition-colors">{token.power}/{token.toughness}</span>
                                        )}
                                    </div>
                                    <span className="text-sm font-bold text-white mb-1">{token.name}</span>
                                    <span className="text-[10px] text-gray-500 truncate w-full text-left italic">{token.type}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Custom Token Form */}
                    <section className="bg-white/5 p-6 rounded-3xl border border-white/5">
                        <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4">Manual Synthesis</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Identifier</label>
                                    <input
                                        type="text"
                                        value={customToken.name}
                                        onChange={(e) => setCustomToken({ ...customToken, name: e.target.value })}
                                        placeholder="Token Name..."
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Power</label>
                                        <input
                                            type="number"
                                            value={customToken.power}
                                            onChange={(e) => setCustomToken({ ...customToken, power: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Toughness</label>
                                        <input
                                            type="number"
                                            value={customToken.toughness}
                                            onChange={(e) => setCustomToken({ ...customToken, toughness: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Type Line</label>
                                    <input
                                        type="text"
                                        value={customToken.type}
                                        onChange={(e) => setCustomToken({ ...customToken, type: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <button
                                    onClick={() => onCreateToken(customToken)}
                                    disabled={!customToken.name}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-2xl shadow-xl shadow-emerald-900/20 transition-all active:scale-95"
                                >
                                    Synthesize Token
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
