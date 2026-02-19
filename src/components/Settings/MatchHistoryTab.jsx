import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { Trophy, Calendar, Clock, User, Shield, Trash2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

import CombatGraph from '../Stats/CombatGraph';
import { BarChart2 } from 'lucide-react';
import MatchDetailsModal from './MatchDetailsModal';

const MatchHistoryTab = () => {
    const { userProfile } = useAuth();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [matchLogs, setMatchLogs] = useState({}); // Cache logs: { matchId: logs[] }
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null); // For Details Modal

    useEffect(() => {
        if (userProfile?.id) {
            fetchMatches();
        }
    }, [userProfile]);

    const fetchMatches = async () => {
        try {
            setLoading(true);
            const data = await api.get(`/api/matches/user/${userProfile.id}`);
            setMatches(data || []);
        } catch (err) {
            console.error('Failed to load match history:', err);
            setError('Failed to load match history.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMatch = async (matchId) => {
        if (!window.confirm('Are you sure you want to delete this match record?')) return;
        try {
            await api.delete(`/api/matches/${matchId}`);
            setMatches(prev => prev.filter(m => m.match_id !== matchId));
        } catch (err) {
            console.error(err);
            alert('Failed to delete match');
        }
    };

    const handleClearHistory = async () => {
        if (!window.confirm('Are you sure you want to clear ALL match history? This cannot be undone.')) return;
        try {
            await api.delete(`/api/matches/user/${userProfile.id}`);
            setMatches([]);
        } catch (err) {
            console.error(err);
            alert('Failed to clear history');
        }
    };

    const handleViewReport = async (match) => {
        const matchId = match.match_id;
        setSelectedMatch(match);

        // Fetch logs if not cached
        if (!matchLogs[matchId]) {
            setLoadingLogs(true);
            try {
                const logs = await api.get(`/api/matches/${matchId}/logs`);
                setMatchLogs(prev => ({ ...prev, [matchId]: logs }));
            } catch (err) {
                console.error('Failed to fetch logs:', err);
            } finally {
                setLoadingLogs(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-8 text-red-400 bg-red-900/10 rounded-xl border border-red-500/20">
                {error}
            </div>
        );
    }

    if (matches.length === 0) {
        return (
            <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
                <div className="bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Matches Yet</h3>
                <p className="text-gray-400">Join a Live Session to track your games!</p>
            </div>
        );
    }

    // Calculate stats
    const totalGames = matches.length;
    const wins = matches.filter(m => m.placement === 1).length;
    const winRate = Math.round((wins / totalGames) * 100);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Games</div>
                    <div className="text-3xl font-black text-white">{totalGames}</div>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Wins</div>
                    <div className="text-3xl font-black text-primary-400">{wins}</div>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Win Rate</div>
                    <div className="text-3xl font-black text-green-400">{winRate}%</div>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Recent Activity</div>
                    <div className="text-sm font-medium text-gray-300 mt-1">
                        {matches[0] ? format(new Date(matches[0].ended_at), 'MMM d') : '-'}
                    </div>
                </div>
            </div>

            {/* Match List */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Recent Matches</h3>
                    {matches.length > 0 && (
                        <button
                            onClick={handleClearHistory}
                            className="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2 px-3 py-2 hover:bg-red-500/10 rounded transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear History
                        </button>
                    )}
                </div>
                <div className="grid gap-3">
                    {matches.map((match) => {
                        const isWin = match.placement === 1;
                        const date = new Date(match.ended_at);
                        const duration = Math.floor((new Date(match.ended_at) - new Date(match.started_at)) / 1000 / 60);


                        // Construct players array for graph
                        const graphPlayers = [
                            { id: match.my_participant_id, name: 'Me' },
                            ...(match.opponents || []).map(o => ({ id: o.participant_id, name: o.name }))
                        ];

                        return (
                            <div key={match.match_id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden group">
                                <div className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4 hover:bg-gray-750 transition-colors">
                                    {/* Result Badge */}
                                    <div className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border ${isWin
                                        ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
                                        : 'bg-gray-700/50 border-gray-600 text-gray-400'
                                        }`}>
                                        {isWin ? <Trophy className="w-6 h-6" /> : <span className="text-lg font-bold">#{match.placement}</span>}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col gap-1 mb-1">
                                            {/* My Deck */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Me:</span>
                                                <h4 className="font-bold text-white truncate max-w-[200px]">
                                                    {match.deck_name || 'Generic Deck'}
                                                </h4>
                                                {match.deck_commander && (
                                                    <span className="text-[10px] bg-primary-500/20 text-primary-300 px-1.5 py-0.5 rounded border border-primary-500/30 truncate max-w-[150px]">
                                                        {typeof match.deck_commander === 'object' ? match.deck_commander.name : match.deck_commander}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Opponents */}
                                            {match.opponents?.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">VS:</span>
                                                    {match.opponents.map((opp, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded">
                                                            <User className="w-3 h-3 text-gray-500" />
                                                            <span className="text-sm text-gray-300">{opp.name}</span>
                                                            <span className="text-xs text-gray-500 border-l border-gray-700 pl-1.5 ml-0.5">
                                                                {opp.deck_name || 'Generic'}
                                                            </span>
                                                            {opp.commander && (
                                                                <span className="text-[10px] text-gray-600 truncate max-w-[80px]">
                                                                    ({typeof opp.commander === 'object' ? opp.commander.name : opp.commander})
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(date, 'MMM d, h:mm a')}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {duration} min
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleViewReport(match)}
                                            className="p-2 text-primary-400 hover:text-white bg-primary-500/10 hover:bg-primary-500 rounded-lg transition-colors flex items-center gap-2 border border-primary-500/20"
                                        >
                                            <BarChart2 className="w-4 h-4" />
                                            <span className="text-xs font-bold hidden md:inline">Report</span>
                                        </button>

                                        <button
                                            onClick={() => handleDeleteMatch(match.match_id)}
                                            className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Record"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Details Modal */}
            <MatchDetailsModal
                isOpen={!!selectedMatch}
                onClose={() => setSelectedMatch(null)}
                match={selectedMatch}
                logs={selectedMatch ? matchLogs[selectedMatch.match_id] : []}
            />
        </div>
    );
};

export default MatchHistoryTab;
