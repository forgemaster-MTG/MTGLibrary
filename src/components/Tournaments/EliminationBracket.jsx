import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';

const EliminationBracket = ({ pairings, participants }) => {
    // 1. Organize data into rounds
    const rounds = useMemo(() => {
        if (!pairings || pairings.length === 0) return [];

        const roundMap = {};
        let maxRound = 0;

        pairings.forEach(p => {
            if (!roundMap[p.round_number]) {
                roundMap[p.round_number] = [];
            }
            roundMap[p.round_number].push(p);
            if (p.round_number > maxRound) maxRound = p.round_number;
        });

        // Ensure we have an array of rounds in order
        const sortedRounds = [];
        for (let i = 1; i <= maxRound; i++) {
            if (roundMap[i]) {
                // Sort pairings by table number to keep structure consistent
                sortedRounds.push(roundMap[i].sort((a, b) => a.table_number - b.table_number));
            }
        }
        return sortedRounds;
    }, [pairings]);

    const getPlayerName = (id) => {
        if (!id) return 'Bye'; // Or 'TBD'
        const p = participants.find(part => part.id === id);
        return p ? (p.username || p.guest_name) : 'Unknown';
    };

    if (rounds.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                No bracket data available yet. Start the tournament to generate the bracket.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto pb-6 custom-scrollbar">
            <div className="flex gap-8 min-w-max px-4">
                {rounds.map((roundPairings, roundIndex) => (
                    <div key={roundIndex} className="flex flex-col justify-around gap-8">
                        <div className="text-center text-gray-500 font-bold uppercase text-xs mb-2 tracking-wider">
                            Round {roundIndex + 1}
                        </div>
                        <div className="flex flex-col justify-around flex-grow gap-4">
                            {roundPairings.map((match) => (
                                <MatchCard
                                    key={match.id}
                                    match={match}
                                    getPlayerName={getPlayerName}
                                />
                            ))}
                        </div>
                    </div>
                ))}

                {/* Optional: Winner Column if tournament is complete */}
                {/* We could check if the last round has a winner and display them separately */}
            </div>
        </div>
    );
};

const MatchCard = ({ match, getPlayerName }) => {
    const isP1Winner = match.winner_id === match.player1_id;
    const isP2Winner = match.winner_id === match.player2_id;

    return (
        <div className="w-48 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col shadow-lg relative">
            {/* Connector Lines (Visual Logic would be complex here, keeping it simple boxes for now) */}

            <div className={`p-2 flex justify-between items-center ${isP1Winner ? 'bg-green-900/20' : ''} border-b border-gray-700/50`}>
                <span className={`text-sm truncate ${isP1Winner ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                    {getPlayerName(match.player1_id)}
                </span>
                {isP1Winner && <Trophy className="w-3 h-3 text-yellow-500" />}
            </div>

            <div className={`p-2 flex justify-between items-center ${isP2Winner ? 'bg-green-900/20' : ''}`}>
                <span className={`text-sm truncate ${isP2Winner ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                    {match.player2_id ? getPlayerName(match.player2_id) : <span className="text-gray-600 italic">Bye</span>}
                </span>
                {isP2Winner && <Trophy className="w-3 h-3 text-yellow-500" />}
            </div>
        </div>
    );
};

export default EliminationBracket;
