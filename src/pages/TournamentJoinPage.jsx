import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, Shield } from 'lucide-react';

const TournamentJoinPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [tournament, setTournament] = useState(null);
    const [myDecks, setMyDecks] = useState([]);
    const [selectedDeck, setSelectedDeck] = useState('');
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [tRes, dRes] = await Promise.all([
                api.get(`/api/tournaments/${id}`),
                api.get('/api/decks')
            ]);
            setTournament(tRes.data);
            setMyDecks(dRes.data);
        } catch (err) {
            setError('Failed to load tournament info.');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        setJoining(true);
        try {
            await api.post(`/api/tournaments/${id}/join`, { deckId: selectedDeck || null });
            navigate(`/tournaments/${id}`);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to join tournament');
            setJoining(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-2">{tournament.name}</h1>
            <p className="text-gray-400 mb-6">Format: <span className="capitalize text-blue-400">{tournament.format}</span></p>

            {tournament.status !== 'pending' ? (
                <div className="text-center py-6 bg-gray-900/50 rounded-lg border border-red-500/30">
                    <p className="text-red-400">This tournament is already active or completed.</p>
                    <button onClick={() => navigate(`/tournaments/${id}`)} className="mt-4 text-blue-400 hover:text-blue-300">
                        View Tournament
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Select a Deck (Optional)</label>
                        <select
                            value={selectedDeck}
                            onChange={(e) => setSelectedDeck(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">No Deck / Decide Later</option>
                            {myDecks.map(deck => (
                                <option key={deck.id} value={deck.id}>
                                    {deck.name} ({deck.format || 'Standard'})
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                            Selecting a deck locks in your list for this tournament.
                        </p>
                    </div>

                    <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {joining ? 'Joining...' : 'Join Tournament'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default TournamentJoinPage;
