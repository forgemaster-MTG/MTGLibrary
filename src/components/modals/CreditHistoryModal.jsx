import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Clock, Activity, Zap, CreditCard, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

const CreditHistoryModal = ({ onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    useEffect(() => {
        fetchHistory(page);
    }, [page]);

    const fetchHistory = async (p) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/credits/history?page=${p}&limit=10`);
            setLogs(res.data || []);
            setPagination(res.pagination || null);
        } catch (error) {
            console.error("Failed to fetch credit history:", error);
            setLogs([]); // Ensure logs is an array on error
        } finally {
            setLoading(false);
        }
    };

    const formatK = (n) => {
        if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + 'M';
        if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
        return n;
    };

    const getIcon = (type) => {
        switch (type) {
            case 'usage': return <Zap className="w-4 h-4 text-purple-400" />;
            case 'subscription_renewal': return <RefreshCw className="w-4 h-4 text-green-400" />;
            case 'topup_purchase': return <CreditCard className="w-4 h-4 text-blue-400" />;
            default: return <Activity className="w-4 h-4 text-gray-400" />;
        }
    };

    const getTypeLabel = (creditType) => {
        if (creditType === 'monthly') return <span className="text-xs bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">Monthly</span>;
        if (creditType === 'topup') return <span className="text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">Top-up</span>;
        if (creditType === 'mixed') return <span className="text-xs bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">Mixed</span>;
        return <span className="text-xs text-gray-500">n/a</span>;
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gray-900/95">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-500/10 rounded-lg">
                            <Clock className="w-6 h-6 text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Credit History</h2>
                            <p className="text-sm text-gray-400">Track your AI usage and purchases</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-0 overflow-y-auto flex-1">
                    {loading && logs.length === 0 ? (
                        <div className="flex justify-center items-center h-48 text-gray-400">Loading history...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-800/50 text-gray-400 font-medium border-b border-gray-700 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th className="p-4 pl-6">Date</th>
                                    <th className="p-4">Activity</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4 text-right">Balance</th>
                                    <th className="p-4 text-right pr-6">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {Array.isArray(logs) && logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                                        <td className="p-4 pl-6 text-gray-500 whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleDateString()}
                                            <span className="text-xs ml-2 opacity-60">
                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 rounded-md bg-gray-800 border border-gray-700">
                                                    {getIcon(log.transaction_type)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-200">{log.description || 'System Adjustment'}</p>
                                                    {log.metadata?.model && (
                                                        <p className="text-xs text-gray-500 font-mono mt-0.5">{log.metadata.model}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {getTypeLabel(log.credit_type)}
                                        </td>
                                        <td className="p-4 text-right font-mono text-gray-400">
                                            {log.balance_after ? formatK(log.balance_after) : '-'}
                                        </td>
                                        <td className={`p-4 pr-6 text-right font-mono font-bold ${log.amount > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                                            {log.amount > 0 ? '+' : ''}{formatK(log.amount)}
                                        </td>
                                    </tr>
                                ))}

                                {!loading && logs.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-gray-500">
                                            No history found. Start using AI tools to populate this ledger.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer / Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-between items-center text-sm text-gray-400">
                        <span>Page {pagination.page} of {pagination.pages}</span>
                        <div className="flex gap-2">
                            <button
                                disabled={pagination.page === 1 || loading}
                                onClick={() => setPage(p => p - 1)}
                                className="p-2 border border-gray-700 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                disabled={pagination.page === pagination.pages || loading}
                                onClick={() => setPage(p => p + 1)}
                                className="p-2 border border-gray-700 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default CreditHistoryModal;
