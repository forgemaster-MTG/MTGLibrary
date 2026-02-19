import React from 'react';
import { useGame } from '../../contexts/GameContext';
import CardObject from './CardObject';

export default function ZoneModal({ isOpen, zoneId, onClose }) {
    const { state, actions } = useGame();

    if (!isOpen || !zoneId) return null;

    const cards = state.zones[zoneId] || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

            <div className="relative bg-gray-900 border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Inspecting {zoneId}</h2>
                            <p className="text-gray-500 text-xs font-black uppercase tracking-widest">{cards.length} Objects Detected</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        {zoneId === 'library' && (
                            <button
                                onClick={() => actions.shuffleLibrary()}
                                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-white/10"
                            >
                                Shuffle Library
                            </button>
                        )}
                        <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl text-gray-400 transition-colors">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-12 bg-black/20">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-8 gap-y-12">
                        {cards.map((card, idx) => (
                            <div key={card.instanceId} className="flex flex-col items-center gap-4 group">
                                <div className="transform transition-all group-hover:scale-110 group-hover:-translate-y-2">
                                    <CardObject card={{ ...card, faceDown: false }} zoneId={zoneId} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                    <button
                                        onClick={() => actions.moveCard(card.instanceId, zoneId, 'hand')}
                                        className="bg-primary-600 hover:bg-primary-500 text-white p-2 rounded-lg text-[10px] font-black uppercase tracking-tighter"
                                        title="Move to Hand"
                                    >
                                        Hand
                                    </button>
                                    <button
                                        onClick={() => actions.moveCard(card.instanceId, zoneId, 'battlefield')}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg text-[10px] font-black uppercase tracking-tighter"
                                        title="Play Directly"
                                    >
                                        Play
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
