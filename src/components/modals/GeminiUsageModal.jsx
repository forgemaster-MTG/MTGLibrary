import React, { useState, useEffect } from 'react';
import { PRICING, getModelTier } from '../../services/gemini';

const GeminiUsageModal = ({ isOpen, onClose }) => {
    const [stats, setStats] = useState({});

    useEffect(() => {
        if (isOpen) {
            const stored = JSON.parse(localStorage.getItem('gemini_usage_stats') || '{}');
            setStats(stored);
        }
    }, [isOpen]);

    const calculateCost = (model, input, output) => {
        const tier = getModelTier(model);
        const p = PRICING[tier] || PRICING.flash;
        return (input * p.input) + (output * p.output);
    };

    const handleReset = () => {
        if (window.confirm("Are you sure you want to reset all usage statistics?")) {
            localStorage.removeItem('gemini_usage_stats');
            setStats({});
        }
    };

    if (!isOpen) return null;

    let totalCost = 0;
    let totalRequests = 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md animate-fade-in">
            <div className="bg-gray-900 border border-indigo-500/30 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <span className="text-indigo-400">📊</span> AI Oracle Usage & Costs
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">Independent tracking per API key and model tier.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {Object.keys(stats).length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-4xl mb-4">⏳</div>
                            <h3 className="text-xl font-bold text-gray-300">No stats recorded yet</h3>
                            <p className="text-gray-500">Usage is tracked locally as you use AI features.</p>
                        </div>
                    ) : (
                        Object.entries(stats).map(([keyId, models]) => (
                            <div key={keyId} className="space-y-4">
                                <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                    {keyId.replace('_', ' ')}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(models).map(([model, mStats]) => {
                                        const cost = calculateCost(model, mStats.inputTokens, mStats.outputTokens);
                                        totalCost += cost;
                                        totalRequests += (mStats.success + mStats.failure + mStats[429]);

                                        return (
                                            <div key={model} className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 hover:border-indigo-500/30 transition-all group">
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="font-mono text-sm text-indigo-300">{model}</span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase">
                                                        {getModelTier(model)}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                                    <div className="bg-gray-900/50 rounded-xl p-2">
                                                        <div className="text-xs text-gray-500 uppercase font-black">Success</div>
                                                        <div className="text-lg font-bold text-emerald-400">{mStats.success}</div>
                                                    </div>
                                                    <div className="bg-gray-900/50 rounded-xl p-2">
                                                        <div className="text-xs text-gray-500 uppercase font-black">fail</div>
                                                        <div className="text-lg font-bold text-red-400">{mStats.failure}</div>
                                                    </div>
                                                    <div className="bg-gray-900/50 rounded-xl p-2">
                                                        <div className="text-xs text-gray-500 uppercase font-black">429</div>
                                                        <div className="text-lg font-bold text-yellow-400">{mStats[429] || 0}</div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-end border-t border-white/5 pt-3">
                                                    <div className="text-[10px] text-gray-500 leading-tight">
                                                        Tokens: {mStats.inputTokens.toLocaleString()} in / {mStats.outputTokens.toLocaleString()} out
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] text-gray-500 uppercase font-black">Shadow Cost</div>
                                                        <div className="text-indigo-400 font-bold">${cost.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer / Summary */}
                <div className="p-6 bg-gray-950/50 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex gap-8">
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Total Usage Estimate</div>
                            <div className="text-3xl font-black text-indigo-400">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div className="border-l border-white/10 pl-8">
                            <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Total API Requests</div>
                            <div className="text-3xl font-black text-white">{totalRequests}</div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={handleReset} className="px-6 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold transition-all text-sm">
                            Reset Stats
                        </button>
                        <button onClick={onClose} className="px-8 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/20">
                            Close
                        </button>
                    </div>
                </div>

                <div className="px-6 py-3 bg-indigo-600/10 text-center">
                    <p className="text-[10px] text-indigo-300 uppercase font-black tracking-widest">
                        ⚠️ Costs are estimates based on standard Google AI Studio pricing tiers for context only.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GeminiUsageModal;
