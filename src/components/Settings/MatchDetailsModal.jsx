import React, { useMemo } from 'react';
import { X, Trophy, Activity, Skull, Zap, TrendingUp, DollarSign, Shield } from 'lucide-react';
import CombatGraph from '../Stats/CombatGraph';
import { format } from 'date-fns';

const StatCard = ({ label, value, subtext, icon: Icon, color = "text-gray-400" }) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
        <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
            <div className="text-2xl font-black text-white">{value}</div>
            {subtext && <div className="text-[10px] text-gray-400 mt-1">{subtext}</div>}
        </div>
        {Icon && <Icon className={`w-8 h-8 opacity-20 ${color}`} />}
    </div>
);

const MatchDetailsModal = ({ isOpen, onClose, match, logs }) => {
    if (!isOpen || !match) return null;

    // Calculate Extended Stats from Logs
    const stats = useMemo(() => {
        if (!logs || logs.length === 0) return null;

        const myId = match.my_participant_id;
        let totalDamageTaken = 0;
        let totalDamageDealt = 0; // Only reliable if we had source tracking, but we handle "life" updates as generic
        let turns = 0;

        // Resource tracking (last known value)
        const finalResources = { poison: 0, energy: 0, experience: 0 };
        const damageByTurn = {}; // { 1: 5, 2: 0, ... }

        logs.forEach(log => {
            const turn = log.metadata?.turn || 0;
            if (turn > turns) turns = turn;

            // Damage Taken (Negative Life Change for ME)
            if (log.action_type === 'life' && (log.actor_participant_id === myId || log.playerId === myId)) {
                const change = log.value || log.change; // Handle both DB and Socket formats
                if (change < 0) {
                    const dmg = Math.abs(change);
                    totalDamageTaken += dmg;

                    // Aggregate by turn
                    damageByTurn[turn] = (damageByTurn[turn] || 0) + dmg;
                }
            }

            // Track my resources
            if (log.action_type === 'counter' && (log.actor_participant_id === myId || log.playerId === myId)) {
                if (finalResources[log.counterType] !== undefined) {
                    finalResources[log.counterType] = log.newValue;
                }
            }
        });

        const avgDamageTaken = turns > 0 ? (totalDamageTaken / turns).toFixed(1) : '0.0';

        // Find max damage in a single turn
        const maxDamageInTurn = Math.max(0, ...Object.values(damageByTurn));

        return { avgDamageTaken, maxDamageInTurn, turns, finalResources };
    }, [match, logs]);

    // Construct players for graph
    const graphPlayers = [
        { id: match.my_participant_id, name: 'Me' },
        ...(match.opponents || []).map(o => ({ id: o.participant_id, name: o.name }))
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-gray-900 to-primary-950/30">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                            <Activity className="w-6 h-6 text-primary-500" />
                            Match Report
                        </h2>
                        <div className="flex items-center gap-4 text-xs font-bold text-gray-400 mt-2">
                            <span>{format(new Date(match.ended_at), 'PPP p')}</span>
                            <span className="w-1 h-1 bg-gray-600 rounded-full" />
                            <span>{match.duration_seconds ? `${Math.floor(match.duration_seconds / 60)}m` : 'Unknown duration'}</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Graph Section */}
                    <div className="bg-black/40 rounded-xl border border-white/5 p-6 min-h-[400px] flex flex-col relative">
                        <div className="absolute top-4 left-4 z-10">
                            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Life History</h3>
                        </div>
                        {(!logs || logs.length === 0) ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500 italic">No combat data available</div>
                        ) : (
                            <CombatGraph players={graphPlayers} logs={logs} />
                        )}
                    </div>

                    {/* Stats Grid */}
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard
                                label="Avg Dmg Taken / Turn"
                                value={stats.avgDamageTaken}
                                icon={Shield}
                                color="text-red-500"
                            />
                            <StatCard
                                label="Most Dmg / Turn"
                                value={stats.maxDamageInTurn}
                                icon={Skull}
                                color="text-orange-500"
                            />
                            <StatCard
                                label="Turns Played"
                                value={stats.turns}
                                icon={Activity}
                                color="text-blue-500"
                            />
                            {/* Resource Snapshot (if non-zero) */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">My Resources</div>
                                <div className="flex items-center gap-3">
                                    {stats.finalResources.poison > 0 && (
                                        <div className="flex items-center gap-1 text-green-500" title="Poison">
                                            <Skull className="w-4 h-4" /> <span className="font-bold">{stats.finalResources.poison}</span>
                                        </div>
                                    )}
                                    {stats.finalResources.energy > 0 && (
                                        <div className="flex items-center gap-1 text-yellow-400" title="Energy">
                                            <Zap className="w-4 h-4" /> <span className="font-bold">{stats.finalResources.energy}</span>
                                        </div>
                                    )}
                                    {stats.finalResources.experience > 0 && (
                                        <div className="flex items-center gap-1 text-blue-400" title="Experience">
                                            <TrendingUp className="w-4 h-4" /> <span className="font-bold">{stats.finalResources.experience}</span>
                                        </div>
                                    )}
                                    {(!stats.finalResources.poison && !stats.finalResources.energy && !stats.finalResources.experience) && (
                                        <span className="text-gray-500 text-xs italic">None recorded</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MatchDetailsModal;
