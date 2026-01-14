import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown } from 'lucide-react';
import { api } from '../../services/api';

const Leaderboard = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await api.get('/api/social/leaderboard');
                setData(res);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    const getRankStyle = (index) => {
        if (index === 0) return { icon: <Trophy size={20} className="text-yellow-400" />, bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
        if (index === 1) return { icon: <Medal size={20} className="text-gray-300" />, bg: 'bg-gray-400/10', border: 'border-gray-400/30' };
        if (index === 2) return { icon: <Medal size={20} className="text-amber-700" />, bg: 'bg-orange-900/10', border: 'border-orange-700/30' };
        return { icon: <span className="text-gray-500 font-bold ml-1.5">#{index + 1}</span>, bg: 'bg-transparent', border: 'border-transparent' };
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
                <Trophy className="text-yellow-500" size={24} />
                <h2 className="text-xl font-bold text-white">Weekly Top Players</h2>
            </div>

            <div className="bg-gray-900/60 rounded-xl overflow-hidden border border-gray-800">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-900/80 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
                            <th className="p-4 w-20 text-center">Rank</th>
                            <th className="p-4">Player</th>
                            <th className="p-4 text-center">Wins</th>
                            <th className="p-4 text-center">Games</th>
                            <th className="p-4 text-center">Win Rate</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500">Loading leaderboard...</td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500">No games played this week yet. Get out there!</td>
                            </tr>
                        ) : (
                            data.map((row, index) => {
                                const style = getRankStyle(index);
                                const winRate = row.games_played > 0
                                    ? Math.round((row.wins / row.games_played) * 100)
                                    : 0;

                                return (
                                    <tr key={row.user_id} className={`hover:bg-gray-800/30 transition-colors ${index < 3 ? 'bg-gray-800/10' : ''}`}>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center items-center">
                                                {style.icon}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-gray-700 text-gray-200 border border-gray-600`}>
                                                    {row.username ? row.username[0].toUpperCase() : '?'}
                                                </div>
                                                <span className={`font-bold ${index === 0 ? 'text-yellow-400' : 'text-gray-200'}`}>
                                                    {row.username}
                                                </span>
                                                {index === 0 && <Crown size={14} className="text-yellow-500" />}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center font-bold text-green-400 text-lg">{row.wins}</td>
                                        <td className="p-4 text-center text-gray-400">{row.games_played}</td>
                                        <td className="p-4 text-center">
                                            <span className={`
                                        inline-block px-2 py-1 rounded text-xs font-bold
                                        ${winRate >= 50 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}
                                    `}>
                                                {winRate}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Leaderboard;
