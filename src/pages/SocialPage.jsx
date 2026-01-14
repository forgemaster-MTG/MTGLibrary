import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Activity, Trophy } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import FriendList from '../components/Social/FriendList';
import SocialFeed from '../components/Social/SocialFeed';
import Leaderboard from '../components/Social/Leaderboard';
import { api } from '../services/api';

const SocialPage = () => {
    const { user, userProfile, refreshUserProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('feed');
    const [lfgStatus, setLfgStatus] = useState(false);

    useEffect(() => {
        if (userProfile?.lfg_status !== undefined) {
            setLfgStatus(userProfile.lfg_status);
        }
    }, [userProfile]);

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
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <PageHeader
                    title="Social Hub"
                    subtitle="Connect with friends and track the meta."
                    icon={Users}
                />

                <div className={`p-4 rounded-xl border transition-colors ${lfgStatus ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-900 border-gray-800'}`}>
                    <div className="flex items-center gap-3">
                        <button
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

            <div className="bg-gray-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="border-b border-white/5">
                    <div className="flex overflow-x-auto">
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
                </div>
            </div>
        </div>
    );
};

export default SocialPage;
