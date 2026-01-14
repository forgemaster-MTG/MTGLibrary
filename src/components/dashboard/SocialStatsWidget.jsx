import React, { useState, useEffect } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const SocialStatsWidget = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ online: 0, pending: 0, total: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/api/friends');
                const pending = res.pending_received.length;
                const total = res.friends.length;
                setStats({ online: 0, pending, total });
            } catch (err) {
                console.error(err);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 backdrop-blur-sm hover:border-gray-700 transition-colors flex flex-col justify-between h-full">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <Users size={20} />
                    </div>
                    <span className="font-bold text-gray-200">Community</span>
                </div>
                {stats.pending > 0 && (
                    <div className="flex items-center justify-center w-6 h-6 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                        <UserPlus size={14} />
                    </div>
                )}
            </div>

            <div>
                <div className="text-3xl font-black text-white tracking-tight">{stats.total}</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Friends Connected</div>
            </div>

            <button
                onClick={() => navigate('/social')}
                className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 text-sm font-bold text-gray-300 rounded-lg border border-gray-700 transition-colors"
            >
                View Hub
            </button>
        </div>
    );
};

export default SocialStatsWidget;
