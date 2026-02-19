import React, { useState, useEffect } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const SocialStatsWidget = ({ size }) => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ online: 0, pending: 0, total: 0 });

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isLargePlus = size === 'large' || size === 'xlarge';

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/api/friends');
                const pending = res.pending_received?.length || 0;
                const total = res.friends?.length || 0;
                setStats({ online: 0, pending, total });
            } catch (err) {
                console.error(err);
            }
        };
        fetchStats();
    }, []);

    if (isXS) {
        return (
            <div onClick={() => navigate('/social')} className="bg-primary-900/10 border border-primary-500/20 rounded-3xl h-full flex flex-col items-center justify-center cursor-pointer hover:bg-primary-500/20 transition-all group">
                <div className="relative">
                    <Users size={18} className="text-primary-400 group-hover:scale-110 transition-transform" />
                    {stats.pending > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-gray-950 animate-bounce" />
                    )}
                </div>
                <span className="text-[10px] font-black text-primary-400 mt-1">{stats.total}</span>
            </div>
        );
    }

    return (
        <div className={`bg-gray-900/60 border border-gray-800 rounded-3xl ${isSmall ? 'p-4' : 'p-6'} backdrop-blur-sm hover:border-gray-700 transition-colors flex flex-col h-full overflow-hidden`}>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary-500/10 rounded-xl text-primary-400">
                        <Users size={isSmall ? 16 : 20} />
                    </div>
                    <span className={`font-black tracking-tight text-white uppercase ${isSmall ? 'text-[10px]' : 'text-xs'}`}>Community</span>
                </div>
                {stats.pending > 0 && (
                    <div className="flex items-center justify-center px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30 text-[9px] font-black animate-pulse">
                        <UserPlus size={10} className="mr-1" />
                        {stats.pending} NEW
                    </div>
                )}
            </div>

            <div className="flex-grow">
                {isLargePlus ? (
                    <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-white">{stats.total}</span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Connections</span>
                        </div>
                        <div className="pt-4 border-t border-white/5">
                            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Recent Pings</h4>
                            <div className="space-y-2">
                                {["GhaveMaster sent a trade", "CommanderSarah shared a deck"].map((p, i) => (
                                    <div key={i} className="text-[10px] text-gray-300 flex items-center gap-2 bg-gray-950/40 p-2 rounded-lg border border-white/5">
                                        <div className="w-1 h-1 rounded-full bg-primary-500" />
                                        {p}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="text-3xl font-black text-white tracking-tight">{stats.total}</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Friends Connected</div>
                    </div>
                )}
            </div>

            <button
                onClick={() => navigate('/social')}
                className={`mt-4 w-full ${isSmall ? 'py-1.5 text-[10px]' : 'py-2.5 text-xs'} bg-primary-600 hover:bg-primary-500 text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all`}
            >
                View Hub
            </button>
        </div>
    );
};

export default SocialStatsWidget;
