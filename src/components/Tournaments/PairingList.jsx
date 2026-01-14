import React from 'react';
import { api } from '../../services/api';
import { Trophy, Shield, Minus, Check, PlayCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const PairingList = ({ tournamentId, round, initialPairings, participants, onUpdate, isPending, isOrganizer }) => {
    const { user } = useAuth();
    const [isEditMode, setIsEditMode] = React.useState(false);
    const { addToast } = useToast();

    if (isPending) {
        return (
            <div className="text-center py-20 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-300">Tournament Pending</h3>
                <p className="text-gray-500">Add players and click Start to generate pairings.</p>
            </div>
        );
    }

    if (!initialPairings || initialPairings.length === 0) {
        return <div className="p-4 text-center text-gray-400">No pairings for this round.</div>;
    }

    // Create a lookup map for participants
    const playerMap = participants.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {});

    const handleResult = async (matchId, winnerId, isDraw) => {
        try {
            await api.post(`/api/tournaments/${tournamentId}/matches`, {
                matchId,
                winnerId: isDraw ? null : winnerId,
                isDraw
            });
            onUpdate();
        } catch (err) {
            console.error('Failed to report result', err);
            addToast('Failed to save result', 'error');
        }
    };

    const handleEditPairing = async (batchId, updates) => {
        try {
            await api.put(`/api/tournaments/${tournamentId}/pairings/${batchId}`, updates);
            addToast('Pairing updated', 'success');
            // Delay update slightly to let DB settle
            setTimeout(onUpdate, 500);
        } catch (err) {
            console.error('Failed to edit pairing', err);
            addToast('Failed to update pairing', 'error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Round {round} Pairings</h3>
                {isOrganizer && (
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all ${isEditMode ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
                    >
                        {isEditMode ? 'Done Editing' : 'Edit Pairings'}
                    </button>
                )}
            </div>

            {initialPairings.map((match) => {
                const p1 = playerMap[match.player1_id];
                const p2 = playerMap[match.player2_id];
                const isP1Winner = match.winner_id === match.player1_id && !match.is_draw;
                const isP2Winner = match.winner_id === match.player2_id && !match.is_draw;
                const isDraw = match.is_draw;
                const myParticipant = participants.find(p => p.user_id === user?.id);
                const isMyMatch = myParticipant && (match.player1_id === myParticipant.id || match.player2_id === myParticipant.id);

                return (
                    <div key={match.id} className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 transition-all ${isMyMatch && !isEditMode ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800 border-gray-700'}`}>
                        <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-gray-500 font-mono text-sm">Table {match.table_number}</span>
                                {isMyMatch && !match.winner_id && !match.is_draw && !isEditMode && (
                                    <button
                                        onClick={() => window.open(`/play/room/pair-${match.id}`, '_blank')}
                                        className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded flex items-center gap-1 shadow-lg"
                                    >
                                        <PlayCircle className="w-3 h-3" /> JOIN
                                    </button>
                                )}
                            </div>

                            {/* Player 1 */}
                            <div className={`flex-1 text-right font-bold ${isP1Winner ? 'text-green-400' : 'text-white'}`}>
                                {isEditMode ? (
                                    <select
                                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs w-full text-right"
                                        value={match.player1_id || ''}
                                        onChange={(e) => handleEditPairing(match.id, { player1Id: e.target.value })}
                                    >
                                        {participants.map(p => <option key={p.id} value={p.id}>{p.username || p.guest_name}</option>)}
                                    </select>
                                ) : (
                                    p1 ? (p1.username || p1.guest_name) : 'Unknown'
                                )}
                            </div>

                            <div className="text-gray-500 font-bold text-xs">VS</div>

                            {/* Player 2 */}
                            <div className={`flex-1 text-left font-bold ${isP2Winner ? 'text-green-400' : 'text-white'}`}>
                                {isEditMode ? (
                                    <select
                                        className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs w-full"
                                        value={match.player2_id || ''}
                                        onChange={(e) => handleEditPairing(match.id, { player2Id: e.target.value || null })}
                                    >
                                        <option value="">(Bye)</option>
                                        {participants.map(p => <option key={p.id} value={p.id}>{p.username || p.guest_name}</option>)}
                                    </select>
                                ) : (
                                    p2 ? (p2.username || p2.guest_name) : (match.player2_id === null ? 'BYE' : 'Unknown')
                                )}
                            </div>
                        </div>

                        {/* Controls */}
                        {!isEditMode && (
                            !match.player2_id ? (
                                <div className="px-4 py-2 bg-gray-700/50 rounded-lg text-gray-400 text-sm">
                                    Automatic Win
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleResult(match.id, match.player1_id, false)}
                                        className={`p-2 rounded-lg transition-colors ${isP1Winner
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                                            }`}
                                        title="Player 1 Wins"
                                    >
                                        <Trophy className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleResult(match.id, null, true)}
                                        className={`p-2 rounded-lg transition-colors ${isDraw
                                            ? 'bg-yellow-600 text-white'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                                            }`}
                                        title="Draw"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleResult(match.id, match.player2_id, false)}
                                        className={`p-2 rounded-lg transition-colors ${isP2Winner
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                                            }`}
                                        title="Player 2 Wins"
                                    >
                                        <Trophy className="w-4 h-4" />
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default PairingList;
