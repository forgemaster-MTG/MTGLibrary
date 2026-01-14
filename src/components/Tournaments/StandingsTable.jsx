import React from 'react';
import { Trophy } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api';

const StandingsTable = ({ participants, tournamentId, currentUserId, isOrganizer, onUpdate }) => {
    if (!participants || participants.length === 0) {
        return <div className="p-4 text-center text-gray-400">No participants yet.</div>;
    }

    const { addToast } = useToast();

    // Sort by Score DESC, then Wins DESC, then Losses ASC
    const sorted = [...participants].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.losses - b.losses; // Less losses = better
    });

    const handleDrop = async (participantId) => {
        if (!confirm('Are you sure you want to drop this player? They will be removed from future pairings.')) return;
        try {
            await api.post(`/api/tournaments/${tournamentId}/drop`, { participantId });
            addToast('Player dropped successfully', 'success');
            onUpdate();
        } catch (err) {
            console.error(err);
            addToast('Failed to drop player', 'error');
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                        <th className="p-4 font-medium uppercase text-xs">Rank</th>
                        <th className="p-4 font-medium uppercase text-xs w-full">Player</th>
                        <th className="p-4 font-medium uppercase text-xs text-center">Pts</th>
                        <th className="p-4 font-medium uppercase text-xs text-center">W</th>
                        <th className="p-4 font-medium uppercase text-xs text-center">L</th>
                        <th className="p-4 font-medium uppercase text-xs text-center">D</th>
                        <th className="p-4 font-medium uppercase text-xs text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {sorted.map((p, index) => (
                        <tr key={p.id} className={`transition-colors ${p.is_active === false ? 'bg-red-900/10 opacity-60' : 'hover:bg-gray-800/50'}`}>
                            <td className="p-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                    index === 1 ? 'bg-gray-400/20 text-gray-400' :
                                        index === 2 ? 'bg-orange-700/20 text-orange-700' :
                                            'text-gray-500'
                                    }`}>
                                    {index + 1}
                                </div>
                            </td>
                            <td className="p-4 font-bold text-white">
                                <div className="flex flex-col">
                                    <span>{p.username || p.guest_name}</span>
                                    {p.deck_snapshot && (
                                        <span className="text-xs text-blue-400 font-normal">{p.deck_snapshot.name}</span>
                                    )}
                                </div>
                            </td>
                            <td className="p-4 text-center font-bold text-yellow-500 text-lg">
                                {p.score}
                            </td>
                            <td className="p-4 text-center text-green-400 font-medium">{p.wins}</td>
                            <td className="p-4 text-center text-red-400 font-medium">{p.losses}</td>
                            <td className="p-4 text-center text-gray-400 font-medium">{p.draws}</td>
                            <td className="p-4 text-center">
                                {p.is_active === false ? (
                                    <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded">Dropped</span>
                                ) : (
                                    (isOrganizer || p.user_id === currentUserId) && (
                                        <button
                                            onClick={() => handleDrop(p.id)}
                                            className="text-xs bg-gray-700 hover:bg-red-900/50 text-gray-300 hover:text-red-300 px-2 py-1 rounded border border-gray-600 hover:border-red-800 transition-colors"
                                        >
                                            Drop
                                        </button>
                                    )
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default StandingsTable;
