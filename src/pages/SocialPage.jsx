import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Users, Activity, Trophy, Swords } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import FriendList from '../components/Social/FriendList';
import SocialFeed from '../components/Social/SocialFeed';
import Leaderboard from '../components/Social/Leaderboard';
import TournamentGrid from '../components/Tournaments/TournamentGrid';
import TournamentCreateModal from '../components/Tournaments/TournamentCreateModal';
import { api } from '../services/api';
import FeatureTour from '../components/common/FeatureTour';

const SocialPage = () => {
    const { user, userProfile, refreshUserProfile } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'feed');
    const [lfgStatus, setLfgStatus] = useState(false);
    const [tournaments, setTournaments] = useState([]);
    const [loadingTournaments, setLoadingTournaments] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Tour
    const [isTourOpen, setIsTourOpen] = useState(false);
    useEffect(() => {
        const handleStartTour = () => setIsTourOpen(true);
        window.addEventListener('start-tour', handleStartTour);
        if (!localStorage.getItem('tour_seen_social_tour_v1')) {
            setTimeout(() => setIsTourOpen(true), 1000);
        }
        return () => window.removeEventListener('start-tour', handleStartTour);
    }, []);

    const TOUR_STEPS = [
        { target: 'h1', title: 'Social Hub', content: 'Connect with friends and the community.' },
        { target: '#social-lfg-toggle', title: 'Looking for Game', content: 'Toggle this on to let your friends know you are ready to play.' },
        { target: '#social-tabs', title: 'Navigation', content: 'Switch between Activity Feed, Friends, Leaderboards, and Tournaments.' }
    ];

    useEffect(() => {
        if (userProfile?.lfg_status !== undefined) {
            setLfgStatus(userProfile.lfg_status);
        }
    }, [userProfile]);

    useEffect(() => {
        if (activeTab === 'tournaments') {
            fetchTournaments();
        }
        setSearchParams({ tab: activeTab }, { replace: true });
    }, [activeTab, setSearchParams]);

    const fetchTournaments = async () => {
        try {
            setLoadingTournaments(true);
            const data = await api.get('/api/tournaments');
            setTournaments(data || []);
        } catch (err) {
            console.error('Failed to fetch tournaments', err);
        } finally {
            setLoadingTournaments(false);
        }
    };

    const handleLfgChange = async () => {
        const newStatus = !lfgStatus;
        setLfgStatus(newStatus);
        try {
            if (userProfile?.id) {
                await api.updateUser(userProfile.id, { lfg_status: newStatus });
                if (refreshUserProfile) await refreshUserProfile();
            }
        } catch (err) {
            console.error('Failed to update LFG status', err);
            setLfgStatus(!newStatus);
        }
    };

    const tabs = [
        { id: 'feed', label: 'Activity Feed', icon: Activity },
        { id: 'friends', label: 'Friends', icon: Users },
        { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
        { id: 'tournaments', label: 'Tournaments', icon: Swords },
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <PageHeader
                    title="Social Hub"
                    subtitle="Connect with friends and track the meta."
                    icon={Users}
                />

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/trades')}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-transform hover:scale-105"
                    >
                        <span>🤝</span>
                        Trade Hub
                    </button>

                    <div className={`p-4 rounded-xl border transition-colors ${lfgStatus ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-900 border-gray-800'}`}>
                        <div className="flex items-center gap-3">
                            <button
                                id="social-lfg-toggle"
                                onClick={handleLfgChange}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${lfgStatus ? 'bg-green-500' : 'bg-gray-700'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${lfgStatus ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            <div>
                                <div className={`text-sm font-bold ${lfgStatus ? 'text-green-400' : 'text-gray-400'}`}>
                                    Looking for Game
                                </div>
                                <div className="text-xs text-gray-500">
                                    Signal your friends you're ready to play
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="border-b border-white/5">
                    <div className="flex overflow-x-auto" id="social-tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                        ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                        }`}
                                >
                                    <Icon size={18} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6">
                    {activeTab === 'feed' && <SocialFeed />}
                    {activeTab === 'friends' && <FriendList />}
                    {activeTab === 'leaderboard' && <Leaderboard />}
                    {activeTab === 'tournaments' && (
                        loadingTournaments ? (
                            <div className="text-center py-10 text-gray-500">Loading Tournaments...</div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg text-sm transition-colors"
                                    >
                                        <Swords className="w-4 h-4" />
                                        Create Tournament
                                    </button>
                                </div>
                                <TournamentGrid
                                    tournaments={tournaments}
                                    emptyMessage="No active tournaments found based on filters."
                                />
                            </div>
                        )
                    )}
                </div>
            </div>

            <TournamentCreateModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
            <FeatureTour
                steps={TOUR_STEPS}
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                tourId="social_tour_v1"
            />
        </div>
    );
};

export default SocialPage;
