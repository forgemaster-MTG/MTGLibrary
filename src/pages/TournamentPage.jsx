import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNavigate, useParams } from 'react-router-dom';
import { Trophy, Plus, Calendar, ArrowRight } from 'lucide-react';
import TournamentDetail from '../components/Tournaments/TournamentDetail';
import TournamentGrid from '../components/Tournaments/TournamentGrid';
import TournamentCreateModal from '../components/Tournaments/TournamentCreateModal';

const TournamentPage = () => {
    const { id } = useParams();
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!id) {
            fetchTournaments();
        }
    }, [id]);

    const fetchTournaments = async () => {
        try {
            const data = await api.get('/api/tournaments');
            setTournaments(data || []);
        } catch (err) {
            console.error('Failed to fetch tournaments', err);
        } finally {
            setLoading(false);
        }
    };

    if (id) {
        return <TournamentDetail />;
    }

    if (loading) return <div className="p-8 text-center text-gray-400">Loading Arena...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-3">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        The Arena
                    </h1>
                    <p className="text-gray-400 mt-1">Organize tournaments and track competitive standings.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Tournament
                </button>
            </div>



            {tournaments.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                    <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-gray-300">No Tournaments Yet</h3>
                    <p className="text-gray-500 mb-6">Create your first event to start tracking games!</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
                    >
                        Create Event
                    </button>
                </div>
            ) : (
                <TournamentGrid tournaments={tournaments} />
            )}

            {/* Create Modal */}
            <TournamentCreateModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
        </div>
    );
};

export default TournamentPage;
