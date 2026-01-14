import React, { useState, useEffect } from 'react';
import { Trophy, Save, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

import CombatGraph from '../Stats/CombatGraph';

const GameSummaryModal = ({ isOpen, onClose, finalState, onSave, roomId }) => {
    const { userProfile } = useAuth();
    const [winnerId, setWinnerId] = useState(null);
    const [myDeckId, setMyDeckId] = useState(null);
    const [myDecks, setMyDecks] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('summary');

    // Load user's decks
    useEffect(() => {
        if (isOpen && userProfile) {
            api.get('/api/decks', { limit: 100 })
                .then(data => setMyDecks(Array.isArray(data) ? data : (data.decks || [])))
                .catch(console.error);
        }
    }, [isOpen, userProfile]);

    if (!isOpen || !finalState) return null;

    const { players, durationSeconds, startedAt, endedAt, logs } = finalState;

    // Helper to format duration
    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Find the winner object to get their real User ID (if registered)
            const winningPlayer = players.find(p => p.id === winnerId);
            const winnerUserId = winningPlayer?.userId || null;

            const payload = {
                roomId: roomId, // Pass current room ID for deduplication
                winnerId: winnerUserId,
                startedAt,
                endedAt,
                logs: logs || [], // Pass the logs
                players: players.map(p => ({
                    userId: p.userId || null,
                    guestName: p.name,
                    placement: p.id === winnerId ? 1 : 2, // Simple 1st/2nd for now
                    life: p.life,
                    deckId: p.deckId, // Use the deckId stored in player state from join
                    socketId: p.id // Pass the socket UUID (p.id is the socket.id in gameHandler)
                }))
            };

            await onSave(payload);
        } catch (error) {
            console.error('Failed to save match:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 p-6 text-center border-b border-white/5">
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center justify-center gap-3">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        Game Over
                    </h2>
                    <p className="text-gray-400 text-sm mt-2 font-mono">Duration: {formatDuration(durationSeconds)}</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* Tabs */}
                    <div className="flex p-1 bg-gray-800 rounded-lg">
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Summary
                        </button>
                        <button
                            onClick={() => setActiveTab('report')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'report' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Combat Report
                        </button>
                    </div>

                    {activeTab === 'summary' ? (
                        /* Winner Selection */
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                Select Winner
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {players.map(player => (
                                    <button
                                        key={player.id}
                                        onClick={() => setWinnerId(player.id)}
                                        className={`p-3 rounded-lg border text-sm font-bold transition-all flex items-center justify-between ${winnerId === player.id
                                            ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        <span className="truncate">{player.name}</span>
                                        {winnerId === player.id && <Trophy className="w-4 h-4" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Combat Report Chart */
                        <div className="h-64 w-full bg-gray-950/50 rounded-xl border border-white/5 p-4 flex flex-col justify-end relative overflow-hidden">
                            {(!logs || logs.length === 0) ? (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                    No battle data recorded.
                                </div>
                            ) : (
                                <CombatGraph players={players} logs={logs} />
                            )}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-950 border-t border-white/5 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg font-bold text-sm transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!winnerId || isSaving}
                        className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                    >
                        {isSaving ? 'Saving...' : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Match History
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default GameSummaryModal;
