import React from 'react';
import { useNavigate } from 'react-router-dom';
import OrganizationWidget from './OrganizationWidget';
import { getTierConfig } from '../../config/tiers';
import { useToast } from '../../contexts/ToastContext';

const QuickAction = ({ title, icon, color, onClick, compact }) => (
    <button
        onClick={onClick}
        className={`group relative overflow-hidden rounded-2xl ${compact ? 'p-2' : 'p-4 md:p-6'} text-left transition-all hover:-translate-y-1 hover:shadow-xl border border-white/5 h-full w-full`}
    >
        <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
        {/* Default darker BG */}
        <div className="absolute inset-0 bg-gray-800/50 group-hover:opacity-0 transition-opacity" />

        <div className="relative z-10 flex flex-col items-center justify-center gap-2 text-gray-300 group-hover:text-white transition-colors h-full">
            <div className={`${compact ? 'p-1.5' : 'p-3'} bg-gray-900/50 rounded-full backdrop-blur-sm group-hover:scale-110 transition-transform group-hover:bg-white/20`}>
                {icon}
            </div>
            <span className={`font-bold ${compact ? 'text-[10px]' : 'text-sm'} tracking-wide text-center leading-tight`}>{title}</span>
        </div>
    </button>
);

const QuickActionsWidget = ({ data, size }) => {
    const { userProfile, stats } = data;
    const navigate = useNavigate();
    const { addToast } = useToast();

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isMedium = size === 'medium';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';

    const handleNewDeck = () => {
        const limit = getTierConfig(userProfile?.subscription_tier).limits.decks;
        const current = stats?.uniqueDecks || 0;
        if (limit !== Infinity && current >= limit) {
            addToast(`Deck limit reached (${current}/${limit}). Upgrade to create more!`, 'error');
            return;
        }
        navigate('/decks/new');
    };

    const actions = [
        { title: "New Deck", icon: <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>, color: "from-indigo-600 to-purple-600", onClick: handleNewDeck },
        { title: "Add Cards", icon: <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, color: "from-blue-600 to-cyan-600", onClick: () => navigate('/collection') },
        { title: "Browse Sets", icon: <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, color: "from-green-600 to-emerald-600", onClick: () => navigate('/sets') },
        { title: "Wishlist", icon: <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>, color: "from-pink-600 to-rose-600", onClick: () => navigate('/collection?wishlist=true') },
    ];

    if (isXS) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-2">
                <button
                    onClick={handleNewDeck}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40 flex items-center justify-center transform active:scale-95 transition-all"
                    title="New Deck"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                </button>
                <span className="text-[10px] font-black tracking-widest uppercase mt-2 text-indigo-400">New Deck</span>
            </div>
        );
    }

    if (isXL) {
        return (
            <div className="bg-gray-950/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-xl h-full flex flex-col">
                <div className="flex gap-4 mb-8">
                    {actions.map((act, i) => (
                        <div key={i} className="flex-1">
                            <QuickAction {...act} compact={false} />
                        </div>
                    ))}
                </div>
                <div className="flex-grow border-t border-white/5 pt-6 overflow-hidden">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        {[
                            { text: "Deck 'Necrons' updated", time: "2h ago", icon: "📝" },
                            { text: "5 cards added to collection", time: "1d ago", icon: "📦" },
                            { text: "New wishlist item: 'Black Lotus'", time: "3d ago", icon: "💎" },
                        ].map((log, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-gray-900/50 p-3 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{log.icon}</span>
                                    <span className="text-gray-300">{log.text}</span>
                                </div>
                                <span className="text-gray-500 font-mono">{log.time}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`grid gap-2 md:gap-3 h-full ${isSmall ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4 items-center'}`}>
            {actions.map((act, i) => (
                <div key={i} className="min-w-0 h-full">
                    <QuickAction
                        {...act}
                        title={isSmall ? act.title.split(' ')[0] : act.title}
                        compact={isSmall}
                    />
                </div>
            ))}
            {!isSmall && !isMedium && (
                <div className="md:col-span-4 h-auto mt-2">
                    <OrganizationWidget />
                </div>
            )}
        </div>
    );
};

export default QuickActionsWidget;
