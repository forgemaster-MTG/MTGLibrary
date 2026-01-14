import React from 'react';
import { Trophy, Share2, X } from 'lucide-react';

const TournamentWinnerModal = ({ isOpen, onClose, tournamentName, winnerName, stats }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
            <div className="relative bg-gradient-to-b from-gray-900 to-black border border-yellow-500/30 rounded-2xl max-w-md w-full p-8 shadow-2xl shadow-yellow-900/20 text-center overflow-hidden">

                {/* Background decorative elements */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6 relative">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30 mb-4 animate-bounce-slow">
                        <Trophy className="w-10 h-10 text-black fill-current" />
                    </div>
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-300 uppercase tracking-widest mb-1 filter drop-shadow-sm">
                        Champion
                    </h2>
                    <p className="text-yellow-500/80 text-xs font-bold uppercase tracking-widest">
                        {tournamentName}
                    </p>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 mb-8 backdrop-blur-sm">
                    <div className="text-4xl font-bold text-white mb-2 tracking-tight">
                        {winnerName || "Unknown Winner"}
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                        <div className="text-center">
                            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Score</div>
                            <div className="text-xl font-mono text-yellow-500 font-bold">{stats?.score || 0}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Wins</div>
                            <div className="text-xl font-mono text-green-400 font-bold">{stats?.wins || 0}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Losses</div>
                            <div className="text-xl font-mono text-red-400 font-bold">{stats?.losses || 0}</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        onClick={() => alert('Sharing implemented soon!')}
                    >
                        <Share2 className="w-4 h-4" /> Share Victory
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-800 text-gray-400 font-bold rounded-xl hover:bg-gray-700 hover:text-white transition-colors"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
};

export default TournamentWinnerModal;
