import React, { useState, useEffect } from 'react';
import HistoryService from '../../services/HistoryService';

const StateHistoryModal = ({ isOpen, onClose }) => {
    const [historyData, setHistoryData] = useState({
        history: [],
        pointer: -1
    });

    useEffect(() => {
        if (!isOpen) return;

        // Initial fetch
        setHistoryData({
            history: HistoryService.getLog(),
            pointer: HistoryService.pointer
        });

        const unsubscribe = HistoryService.subscribe((status) => {
            setHistoryData({
                history: status.history,
                pointer: status.pointer
            });
        });
        return unsubscribe;
    }, [isOpen]);

    if (!isOpen) return null;

    const { history, pointer } = historyData;

    const handleJump = async (targetReversedIndex) => {
        // history is reversed in getLog().
        // index 0 in UI is the LATEST action (highest index in real timeline)
        // realIndex = (length - 1) - uiIndex
        const realIndex = (history.length - 1) - targetReversedIndex;

        if (realIndex === pointer) return; // Same state

        if (window.confirm(`Revert to state after "${history[targetReversedIndex].action}"?`)) {
            await HistoryService.jumpTo(realIndex);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20 rounded-t-2xl">
                    <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="text-cyan-400">Time Machine</span>
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-white/10">Session History</span>
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="overflow-y-auto p-4 custom-scrollbar space-y-2 flex-grow">
                    {history.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">No actions recorded this session.</div>
                    ) : (
                        history.map((item, index) => {
                            // Calculate real pointer index matching this item
                            const itemRealIndex = (history.length - 1) - index;
                            const isPast = itemRealIndex < pointer;
                            const isCurrent = itemRealIndex === pointer;
                            const isFuture = itemRealIndex > pointer;

                            return (
                                <div
                                    key={item.timestamp}
                                    onClick={() => handleJump(index)}
                                    className={`
                                        relative pl-4 pr-3 py-3 rounded-xl border transition-all cursor-pointer group flex items-start gap-3
                                        ${isCurrent ? 'bg-cyan-900/20 border-cyan-500/50 ring-1 ring-cyan-500/20' : ''}
                                        ${isPast ? 'bg-gray-800/50 border-white/5 opacity-70 hover:opacity-100 hover:bg-gray-800' : ''}
                                        ${isFuture ? 'bg-gray-900/30 border-white/5 opacity-40 hover:opacity-100 grayscale hover:grayscale-0' : ''}
                                    `}
                                >
                                    {/* Timeline Line */}
                                    {index !== history.length - 1 && (
                                        <div className="absolute left-[27px] top-10 bottom-[-10px] w-px bg-white/10 group-hover:bg-white/20" />
                                    )}

                                    <div className={`
                                        w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors
                                        ${isCurrent ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-gray-800 border border-white/10 text-gray-500 group-hover:border-cyan-500/50 group-hover:text-cyan-400'}
                                    `}>
                                        {isCurrent ? (
                                            <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
                                        ) : index === 0 ? (
                                            <span className="text-[10px] font-bold">Latest</span>
                                        ) : (
                                            <span className="text-[9px]">{index}</span>
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        <div className={`text-sm font-bold ${isCurrent ? 'text-cyan-400' : 'text-gray-300 group-hover:text-white'}`}>
                                            {item.action}
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[10px] font-mono text-gray-500">
                                                {new Date(item.timestamp).toLocaleTimeString()}
                                            </span>
                                            {isCurrent && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-600 bg-cyan-900/30 px-1.5 py-0.5 rounded">Active State</span>
                                            )}
                                        </div>
                                    </div>

                                    {!isCurrent && (
                                        <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="px-2 py-1 bg-white/10 rounded text-[9px] font-bold uppercase tracking-wider text-white">
                                                Restore
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default StateHistoryModal;
