import React, { useState } from 'react';
import { X, Shield, Zap, Skull, TrendingUp, DollarSign } from 'lucide-react';

const CounterControl = ({ label, value, onChange, icon: Icon, color = "text-white" }) => (
    <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
            {Icon && <Icon className={`w-5 h-5 ${color}`} />}
            <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-center gap-4">
            <button
                onClick={() => onChange(value - 1)}
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-white transition-colors"
                disabled={value <= 0}
            >
                -
            </button>
            <span className="text-2xl font-black text-white w-8 text-center tabular-nums">{value}</span>
            <button
                onClick={() => onChange(value + 1)}
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-white transition-colors"
            >
                +
            </button>
        </div>
    </div>
);

const ResourcesModal = ({ isOpen, onClose, players, myPlayerId, myCounters, myCommanderDamage, onUpdateCounter, onUpdateCmdDamage }) => {
    const [activeTab, setActiveTab] = useState('commander'); // counters | commander

    if (!isOpen) return null;

    const opponents = players.filter(p => p.id !== myPlayerId);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

            {/* Modal Content */}
            <div className="bg-gray-900 w-full sm:max-w-md h-[80vh] sm:h-auto sm:rounded-3xl rounded-t-3xl border-t sm:border border-white/10 shadow-2xl flex flex-col pointer-events-auto relative overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h2 className="text-xl font-black text-white italic uppercase tracking-wider">Resources</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('counters')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'counters' ? 'text-primary-400 bg-white/5 border-b-2 border-primary-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Counters
                    </button>
                    <button
                        onClick={() => setActiveTab('commander')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'commander' ? 'text-primary-400 bg-white/5 border-b-2 border-primary-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Commander Dmg
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeTab === 'counters' && (
                        <>
                            <CounterControl
                                label="Poison"
                                value={myCounters.poison || 0}
                                onChange={(val) => onUpdateCounter('poison', val)}
                                icon={Skull}
                                color="text-green-500"
                            />
                            <CounterControl
                                label="Energy"
                                value={myCounters.energy || 0}
                                onChange={(val) => onUpdateCounter('energy', val)}
                                icon={Zap}
                                color="text-yellow-400"
                            />
                            <CounterControl
                                label="Experience"
                                value={myCounters.experience || 0}
                                onChange={(val) => onUpdateCounter('experience', val)}
                                icon={TrendingUp}
                                color="text-blue-400"
                            />
                            <CounterControl
                                label="Tax"
                                value={myCounters.commanderTax || 0}
                                onChange={(val) => onUpdateCounter('commanderTax', val)}
                                icon={DollarSign}
                                color="text-gray-400"
                            />
                        </>
                    )}

                    {activeTab === 'commander' && (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 text-center uppercase tracking-widest mb-4">
                                Damage taken from Commanders
                            </p>
                            {opponents.length === 0 && (
                                <p className="text-gray-500 text-center py-4">No opponents found.</p>
                            )}
                            {opponents.map(opp => (
                                <CounterControl
                                    key={opp.id}
                                    label={opp.name}
                                    value={myCommanderDamage[opp.id] || 0}
                                    onChange={(val) => onUpdateCmdDamage(opp.id, val)}
                                    icon={Shield}
                                    color="text-red-400"
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResourcesModal;
