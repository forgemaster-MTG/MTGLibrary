import React from 'react';

const PHASES = ['Untap', 'Upkeep', 'Draw', 'Main 1', 'Combat', 'Main 2', 'End'];

export default function PhaseTracker({ currentPhase, turnCount, landsPlayed, onNextPhase }) {
    return (
        <div className="flex items-center bg-gray-900/80 backdrop-blur-md rounded-2xl border border-white/10 px-4 py-2 shadow-2xl relative overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="flex items-center gap-6 relative z-10">
                {/* Turn Indicator */}
                <div className="flex flex-col items-center border-r border-white/10 pr-4">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] leading-none mb-1">Turn</span>
                    <span className="text-xl font-black text-white italic leading-none">{turnCount}</span>
                </div>

                {/* Lands Played Indicator */}
                <div className="flex flex-col items-center border-r border-white/10 pr-4">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] leading-none mb-1">Lands</span>
                    <span className={`text-xl font-black italic leading-none ${landsPlayed >= 1 ? 'text-amber-500' : 'text-emerald-400'}`}>
                        {landsPlayed}/1
                    </span>
                </div>

                {/* Phases List */}
                <div className="flex items-center gap-1 md:gap-2">
                    {PHASES.map((phase, index) => {
                        const isActive = currentPhase === phase;
                        const isPast = PHASES.indexOf(currentPhase) > index;

                        return (
                            <div
                                key={phase}
                                className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-40'}`}
                            >
                                <div className={`h-1.5 w-8 md:w-12 rounded-full mb-2 transition-all duration-500 ${isActive
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                                    : isPast ? 'bg-indigo-900/40' : 'bg-gray-800'
                                    }`} />
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-indigo-400' : 'text-gray-500'
                                    }`}>
                                    {phase}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Next Button */}
                <button
                    onClick={onNextPhase}
                    className="ml-2 w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-110 active:scale-95 group/btn"
                    title="Next Phase (Space)"
                >
                    <svg className="w-5 h-5 transition-transform group-hover/btn:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
