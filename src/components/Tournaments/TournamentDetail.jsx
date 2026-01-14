import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Clock, Users, ArrowLeft, Play, RefreshCw, AlertCircle, Trash } from 'lucide-react';
import PairingList from './PairingList';
import StandingsTable from './StandingsTable';
import EliminationBracket from './EliminationBracket';
import ConfirmationModal from '../modals/ConfirmationModal';
import TournamentWinnerModal from '../modals/TournamentWinnerModal';
import { QRCodeSVG } from 'qrcode.react';

import { useAuth } from '../../contexts/AuthContext';

const TournamentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const [tournament, setTournament] = useState(null);
    const [activeTab, setActiveTab] = useState('pairings');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Manage adding players
    const [newPlayerId, setNewPlayerId] = useState('');
    const [newGuestName, setNewGuestName] = useState('');
    const [friends, setFriends] = useState([]);

    // Modal States
    const [winnerModalOpen, setWinnerModalOpen] = useState(false);
    const [winnerData, setWinnerData] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, title: '', message: '' });
    const [joinModalOpen, setJoinModalOpen] = useState(false);

    useEffect(() => {
        if (id) {
            fetchTournamentDetails();
            fetchFriends();
        }
    }, [id]);

    const fetchTournamentDetails = async () => {
        try {
            setLoading(true);
            const data = await api.get(`/api/tournaments/${id}`);
            setTournament(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchFriends = async () => {
        try {
            const data = await api.get('/api/friends'); // Assuming this exists
            setFriends(data.friends || []);
        } catch (err) {
            console.error('Failed to load friends', err);
        }
    };

    const handleAddParticipant = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/api/tournaments/${id}/participants`, {
                userId: newPlayerId || null,
                guestName: newGuestName || null
            });
            setNewPlayerId('');
            setNewGuestName('');
            fetchTournamentDetails();
        } catch (err) {
            alert('Failed to add participant');
        }
    };

    const handleStartTournament = () => {
        setConfirmModal({
            isOpen: true,
            type: 'START',
            title: 'Start Tournament?',
            message: 'This will generate Round 1 pairings. Ensure all players are added.'
        });
    };

    const confirmStart = async () => {
        try {
            await api.post(`/api/tournaments/${id}/start`);
            fetchTournamentDetails();
            setConfirmModal({ isOpen: false });
        } catch (err) {
            alert('Failed to start tournament');
        }
    };

    const handleNextRound = () => {
        setConfirmModal({
            isOpen: true,
            type: 'NEXT_ROUND',
            title: 'Generate Next Round?',
            message: 'This will lock current round results and generate new pairings.'
        });
    };

    const confirmNextRound = async () => {
        try {
            const res = await api.post(`/api/tournaments/${id}/next-round`);

            fetchTournamentDetails();
            setConfirmModal({ isOpen: false });

            if (res.completed) {
                const updated = await api.get(`/api/tournaments/${id}`);
                const winner = updated.participants && updated.participants[0];
                if (winner) {
                    setWinnerData(winner);
                    setWinnerModalOpen(true);
                }
            }
        } catch (err) {
            alert('Failed to generate next round. Make sure all matches are finished.');
        }
    };

    const handleConfirmAction = () => {
        if (confirmModal.type === 'START') confirmStart();
        if (confirmModal.type === 'NEXT_ROUND') confirmNextRound();
    };

    const canAdvance = tournament && tournament.status === 'active' && tournament.currentPairings && tournament.currentPairings.every(m => m.winner_id || m.is_draw);
    console.log('[TournamentDetail] Auth Debug:', { userId: userProfile?.id, organizerId: tournament?.organizer_id, match: String(userProfile?.id) === String(tournament?.organizer_id) });
    const isOrganizer = userProfile?.id && tournament?.organizer_id && String(userProfile.id) === String(tournament.organizer_id);

    if (loading) return <div className="p-8 text-center text-gray-400">Loading Tournament...</div>;
    if (error) return <div className="p-8 text-center text-red-400">Error: {error}</div>;
    if (!tournament) return null;

    const joinUrl = `${window.location.origin}/tournaments/${id}/join`;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <button
                onClick={() => navigate('/social?tab=tournaments')}
                className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Arena
            </button>

            {/* Header */}
            <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700 shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-white">{tournament.name}</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${tournament.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                                tournament.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' :
                                    'bg-gray-600/50 text-gray-400 border border-gray-600'
                                }`}>
                                {tournament.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-yellow-500" />
                                {tournament.format.toUpperCase()}
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-400" />
                                Round {tournament.current_round}
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-purple-400" />
                                {tournament.participants?.length || 0} Players
                            </div>
                        </div>

                        {tournament.status === 'pending' && (
                            <button
                                onClick={() => setJoinModalOpen(true)}
                                className="mt-4 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2"
                            >
                                <Users className="w-4 h-4" /> Show Join QR Code
                            </button>
                        )}
                    </div>

                    {tournament.status === 'pending' && isOrganizer && (
                        <button
                            onClick={handleStartTournament}
                            disabled={tournament.participants?.length < 2}
                            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/20"
                        >
                            <Play className="w-5 h-5 fill-current" />
                            Start Tournament
                        </button>
                    )}

                    {tournament.status === 'active' && isOrganizer && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleNextRound}
                                disabled={!canAdvance}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/20"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Next Round
                            </button>
                        </div>
                    )}

                    {isOrganizer && (
                        <button
                            onClick={async () => {
                                if (!window.confirm('Are you sure you want to DELETE this tournament? This cannot be undone.')) return;
                                try {
                                    await api.delete(`/api/tournaments/${id}`);
                                    navigate('/tournaments');
                                } catch (err) {
                                    alert('Failed to delete tournament');
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-3 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg transition-all ml-2"
                            title="Delete Tournament"
                        >
                            <Trash className="w-5 h-5" />
                            <span className="hidden md:inline">Delete</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Settings Info (Optional) */}
            {tournament.settings?.total_rounds && (
                <div className="mb-4 text-xs text-gray-500 text-right">
                    Playing best of {tournament.settings.total_rounds} Rounds
                </div>
            )}

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Main Content (Pairings/Standings) */}
                <div className="lg:col-span-3">
                    <div className="flex border-b border-gray-700 mb-6">
                        <button
                            onClick={() => setActiveTab('pairings')}
                            className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'pairings'
                                ? 'border-yellow-500 text-yellow-500'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            Pairings
                        </button>
                        <button
                            onClick={() => setActiveTab('standings')}
                            className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'standings'
                                ? 'border-yellow-500 text-yellow-500'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`} >
                            Standings
                        </button>
                        {(tournament.format === 'elimination' || tournament.settings?.mode === 'elimination') && (
                            <button
                                onClick={() => setActiveTab('bracket')}
                                className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'bracket'
                                    ? 'border-yellow-500 text-yellow-500'
                                    : 'border-transparent text-gray-400 hover:text-white'
                                    }`}
                            >
                                Bracket
                            </button>
                        )}
                    </div>

                    {activeTab === 'pairings' && (
                        <PairingList
                            tournamentId={id}
                            round={tournament.current_round}
                            initialPairings={tournament.currentPairings}
                            participants={tournament.participants} // Pass participants for name lookup
                            onUpdate={fetchTournamentDetails}
                            isPending={tournament.status === 'pending'}
                            isOrganizer={isOrganizer}
                        />
                    )}

                    {activeTab === 'standings' && (
                        <StandingsTable
                            participants={tournament.participants}
                            tournamentId={id}
                            currentUserId={user?.id}
                            isOrganizer={isOrganizer}
                            onUpdate={fetchTournamentDetails}
                        />
                    )}

                    {activeTab === 'bracket' && (
                        <EliminationBracket
                            pairings={tournament.allPairings}
                            participants={tournament.participants}
                        />
                    )}
                </div>

                {/* Sidebar (Admin/Participants) */}
                <div className="lg:col-span-1 space-y-6">
                    {tournament.status === 'pending' && (
                        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <PlusUserIcon /> Add Player
                            </h3>
                            <form onSubmit={handleAddParticipant} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">From Friends</label>
                                    <select
                                        value={newPlayerId}
                                        onChange={e => { setNewPlayerId(e.target.value); setNewGuestName(''); }}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm focus:border-yellow-500 outline-none"
                                    >
                                        <option value="">Select Friend...</option>
                                        {friends.map(f => (
                                            <option key={f.id} value={f.id}>{f.username}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="text-center text-gray-600 text-xs font-bold">- OR -</div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Guest Name</label>
                                    <input
                                        type="text"
                                        value={newGuestName}
                                        onChange={e => { setNewGuestName(e.target.value); setNewPlayerId(''); }}
                                        placeholder="Enter Name..."
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm focus:border-yellow-500 outline-none"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!newPlayerId && !newGuestName}
                                    className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
                                >
                                    Add Participant
                                </button>
                            </form>
                        </div>
                    )}

                    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                        <h3 className="text-lg font-bold text-white mb-4">Players</h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                            {tournament.participants && tournament.participants.length > 0 ? (
                                tournament.participants.map((p, i) => (
                                    <div key={p.id} className="flex justify-between items-center p-2 bg-gray-900/50 rounded-lg">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                                                {i + 1}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-300 truncate">
                                                    {p.username || p.guest_name}
                                                </span>
                                                {p.deck_snapshot && (
                                                    <span className="text-xs text-blue-400 truncate">
                                                        {p.deck_snapshot.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-gray-500">
                                            {p.score}pts
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-500 text-sm py-4 italic">
                                    No players yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>


            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={handleConfirmAction}
                title={confirmModal.title}
                message={confirmModal.message}
            />

            <TournamentWinnerModal
                isOpen={winnerModalOpen}
                onClose={() => setWinnerModalOpen(false)}
                tournamentName={tournament.name}
                winnerName={winnerData?.username || winnerData?.guest_name}
                stats={winnerData}
            />

            {/* QR Code Modal */}
            {joinModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl max-w-sm w-full p-6 border border-gray-700 relative shadow-2xl">
                        <button
                            onClick={() => setJoinModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            ✕
                        </button>
                        <h3 className="text-xl font-bold text-white mb-2 text-center">Join Tournament</h3>
                        <p className="text-gray-400 text-sm mb-6 text-center">Scan to join on your device</p>

                        <div className="bg-white p-4 rounded-lg mx-auto w-fit mb-6">
                            <QRCodeSVG value={joinUrl} size={200} />
                        </div>

                        <div className="bg-gray-900 rounded p-3 flex items-center gap-2">
                            <input
                                type="text"
                                readOnly
                                value={joinUrl}
                                className="bg-transparent text-gray-400 text-xs w-full outline-none"
                            />
                            <button
                                onClick={() => navigator.clipboard.writeText(joinUrl)}
                                className="text-blue-400 hover:text-white text-xs font-bold"
                            >
                                COPY
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

const PlusUserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="20" y1="8" x2="20" y2="14"></line>
        <line x1="23" y1="11" x2="17" y2="11"></line>
    </svg>
);

export default TournamentDetail;
