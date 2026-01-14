import React from 'react';
import { Calendar, Trophy, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TournamentGrid = ({ tournaments, emptyMessage = "No tournaments found." }) => {
    const navigate = useNavigate();

    if (!tournaments || tournaments.length === 0) {
        return (
            <div className="text-center py-20 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-300">No Tournaments</h3>
                <p className="text-gray-500 mb-6">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map(t => (
                <div
                    key={t.id}
                    onClick={() => navigate(`/tournaments/${t.id}`)}
                    className="group bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-yellow-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-yellow-500/10"
                >
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold text-white group-hover:text-yellow-400 transition-colors">
                            {t.name}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${t.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            t.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-700 text-gray-400'
                            }`}>
                            {t.status}
                        </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-400 mb-6">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(t.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4" />
                            {t.format.toUpperCase()}
                        </div>
                    </div>

                    <div className="flex items-center text-yellow-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                        Manage Tournament <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TournamentGrid;
