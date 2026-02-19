import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const SystemStatusWidget = ({ size, actions }) => {
    const { setIsIssueModalOpen } = actions;
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isMedium = size === 'medium';
    const isLargePlus = size === 'large' || size === 'xlarge';

    useEffect(() => {
        if (!isXS) {
            setLoading(true);
            api.getTickets({ limit: 5 })
                .then(data => setTickets(Array.isArray(data) ? data : []))
                .catch(err => console.error('[SystemStatus] Load error:', err))
                .finally(() => setLoading(false));
        }
    }, [size]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'text-green-400';
            case 'in_progress': return 'text-yellow-400';
            case 'planned': return 'text-blue-400';
            default: return 'text-gray-400';
        }
    };

    if (isXS) {
        return (
            <div
                onClick={() => setIsIssueModalOpen(true)}
                className="bg-primary-500/10 border border-primary-500/20 rounded-3xl h-full flex flex-col items-center justify-center cursor-pointer hover:bg-primary-500/20 transition-all group"
            >
                <div className="w-3 h-3 bg-primary-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)] group-hover:scale-125 transition-transform" />
                <span className="text-[10px] font-black text-primary-400 mt-2 uppercase tracking-widest">Support</span>
            </div>
        );
    }

    return (
        <div className={`bg-gray-900/40 border border-white/5 rounded-3xl ${isSmall ? 'p-3' : 'p-6'} backdrop-blur-md h-full flex flex-col`}>
            <div className={`flex justify-between items-start ${isSmall ? 'mb-2' : 'mb-4'}`}>
                <div className="flex flex-col">
                    <h2 className={`${isSmall ? 'text-sm' : 'text-base'} font-bold text-white flex items-center gap-2`}>
                        <span className="text-primary-500">⚡</span>
                        Support Hub
                    </h2>
                    {isLargePlus && <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Live Updates & Feedback</p>}
                </div>
                {!isSmall && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded-lg border border-green-500/20">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-green-400 uppercase tracking-tighter">Systems Live</span>
                    </div>
                )}
            </div>

            <div className="flex-grow overflow-hidden relative">
                {loading && tickets.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-600 text-xs">
                        Fetching tickets...
                    </div>
                ) : tickets.length > 0 ? (
                    <div className="space-y-3">
                        {tickets.slice(0, isLargePlus ? 4 : 2).map((ticket) => (
                            <div
                                key={ticket.id}
                                className="group flex flex-col p-2.5 bg-gray-950/40 border border-white/5 rounded-xl hover:bg-gray-800/60 transition-colors cursor-pointer"
                                onClick={() => setIsIssueModalOpen(true)}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <span className="text-xs text-white font-medium truncate group-hover:text-primary-400 transition-colors">{ticket.title}</span>
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/5 ${getStatusColor(ticket.status)} border border-white/5 whitespace-nowrap`}>
                                        {ticket.status?.replace('_', ' ')}
                                    </span>
                                </div>
                                {isLargePlus && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                            {ticket.votes || 0}
                                        </div>
                                        <div className="text-[10px] text-gray-600">• by {ticket.created_by_username || 'user'}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <p className="text-xs text-gray-500 italic mb-2">No active tickets.</p>
                        {!isSmall && <p className="text-[10px] text-gray-600 uppercase">Found a bug? Use the button below.</p>}
                    </div>
                )}

                {/* Fade out bottom for S/M */}
                {!isLargePlus && tickets.length > 2 && (
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-900/40 to-transparent pointer-events-none" />
                )}
            </div>

            <button
                onClick={() => setIsIssueModalOpen(true)}
                className={`w-full ${isSmall ? 'h-8 text-[10px]' : 'h-12 text-sm'} bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl shadow-lg hover:shadow-primary-500/20 transition-all flex items-center justify-center gap-2 mt-2 shrink-0`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Report Issue
            </button>
        </div>
    );
};

export default SystemStatusWidget;
