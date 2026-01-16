import React, { memo } from 'react';
import Zone from './Zone';
import { useDroppable } from '@dnd-kit/core';

// Playmat Layout
// We'll use a CSS Grid for standard layout:
// [     Opponent / Command Zone     ]
// [           Battlefield           ]
// [           Battlefield           ]
// [ Hand ] [ Library/GY/Exile ]

const Playmat = memo(function Playmat({ state, onCardClick }) {
    const { zones } = state;

    return (
        <div className="flex flex-col h-full gap-4 p-4 bg-[radial-gradient(circle_at_50%_-20%,_#1e1b4b_0%,_#020617_100%)] rounded-3xl border border-white/5 shadow-inner relative overflow-hidden">
            {/* Background Texture Overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

            {/* Top Area: Command Zone & Exile */}
            <div className="flex h-56 gap-6 shrink-0 z-10">
                <Zone id="command" cards={zones.command} title="Command Zone" className="w-64 bg-white/5 backdrop-blur-sm border-white/10 hover:border-white/20" onCardClick={onCardClick} />
                <Zone id="exile" cards={zones.exile} title="Exile" className="w-64 bg-white/5 backdrop-blur-sm border-white/10 hover:border-white/20" onCardClick={onCardClick} />

                {/* Floating Resource Display Placeholder (Optional) */}
            </div>

            {/* Battlefield - The main area */}
            <div className="flex-grow bg-emerald-500/5 rounded-3xl border-2 border-dashed border-emerald-500/10 p-6 relative min-h-[400px] shadow-inner group">
                {/* Board Label */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
                    <span className="text-[200px] font-black uppercase tracking-tighter rotate-[-15deg]">Battlefield</span>
                </div>

                <Zone
                    id="battlefield"
                    cards={zones.battlefield}
                    title="Battlefield"
                    className="h-full w-full border-none"
                    layout="free"
                    onCardClick={onCardClick}
                />
            </div>

            {/* Bottom Area: Hand, Library, Graveyard */}
            <div className="h-72 flex gap-6 shrink-0 z-10">
                {/* Hand */}
                <div className="flex-grow bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-xl">
                    <Zone
                        id="hand"
                        cards={zones.hand}
                        title="Hand"
                        layout="spread"
                        className="h-full w-full border-none"
                        onCardClick={onCardClick}
                    />
                </div>

                {/* Library & Graveyard Stack */}
                <div className="w-80 flex gap-4">
                    <Zone id="library" cards={zones.library} title={`Library (${zones.library.length})`} className="w-1/2 bg-white/5 backdrop-blur-sm border-white/10 hover:border-white/20" layout="stacked" onCardClick={onCardClick} />
                    <Zone id="graveyard" cards={zones.graveyard} title={`Graveyard (${zones.graveyard.length})`} className="w-1/2 bg-white/5 backdrop-blur-sm border-white/10 hover:border-white/20" layout="stacked" onCardClick={onCardClick} />
                </div>
            </div>
        </div>
    );
});

export default Playmat;
