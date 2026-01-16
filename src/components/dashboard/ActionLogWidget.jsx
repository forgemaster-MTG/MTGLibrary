import React, { useEffect, useState } from 'react';
import HistoryService from '../../services/HistoryService';

const ActionLogWidget = ({ size }) => {
    const [historyData, setHistoryData] = useState({
        history: [],
        pointer: -1
    });

    useEffect(() => {
        // Initial fetch
        setHistoryData({
            history: HistoryService.getLog(),
            pointer: HistoryService.pointer
        });

        // Subscribe to updates
        const unsubscribe = HistoryService.subscribe((status) => {
            setHistoryData({
                history: status.history,
                pointer: status.pointer
            });
        });
        return unsubscribe;
    }, []);

    const { history } = historyData;
    const isSmall = size === 'small';
    const isMedium = size === 'medium';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';

    // Filter out 'Initial State' if desired, or keep it.
    // Display recent actions first (history is already reversed by getLog)

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
                <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs font-bold uppercase tracking-wider">No Recent Activity</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-900/40 backdrop-blur-md rounded-3xl overflow-hidden border border-white/5">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                    Session History
                </h3>
                <span className="text-[10px] text-gray-600 font-mono">{history.length} Actions</span>
            </div>

            <div className={`flex-grow overflow-y-auto custom-scrollbar ${isSmall ? 'p-2' : 'p-4'}`}>
                <div className="space-y-2">
                    {history.map((item, index) => {
                        // Calculate actual index in timeline (reversed)
                        const isCurrent = (history.length - 1 - index) === historyData.pointer;

                        return (
                            <div
                                key={item.timestamp}
                                className={`flex items-start gap-3 p-3 rounded-xl transition-all border ${isCurrent
                                        ? 'bg-cyan-500/10 border-cyan-500/30'
                                        : 'bg-black/20 border-white/5 hover:bg-white/5'
                                    }`}
                            >
                                <div className={`mt-0.5 p-1.5 rounded-lg ${isCurrent ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800 text-gray-500'}`}>
                                    {isCurrent ? (
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    )}
                                </div>
                                <div className="flex-grow">
                                    <div className={`text-xs font-bold ${isCurrent ? 'text-cyan-100' : 'text-gray-300'}`}>
                                        {item.action}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Optional Footer for larger sizes */}
            {(isMedium || isLarge || isXL) && (
                <div className="p-3 bg-black/20 border-t border-white/5 text-[10px] text-gray-500 text-center font-mono">
                    Press Ctrl+Z to Undo • Ctrl+Y to Redo
                </div>
            )}
        </div>
    );
};

export default ActionLogWidget;
