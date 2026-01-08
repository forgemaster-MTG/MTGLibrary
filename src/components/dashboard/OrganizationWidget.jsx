import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const OrganizationWidget = () => {
    const { userProfile } = useAuth();
    const mode = userProfile?.settings?.organization?.mode;

    const getModeMeta = (m) => {
        switch (m) {
            case 'deckbuilder': return { label: 'Deckbuilder', icon: '🛠️', desc: 'Sorted by Color & Type' };
            case 'collector': return { label: 'Collector', icon: '📚', desc: 'Sorted by Set & Number' };
            case 'hybrid': return { label: 'Hybrid', icon: '⚡', desc: 'Binders + Bulk Boxes' };
            case 'custom': return { label: 'Custom', icon: '⚙️', desc: 'Advanced Hierarchy' };
            default: return { label: 'Reference', icon: '📁', desc: 'Default Organization' };
        }
    };

    const meta = getModeMeta(mode);

    return (
        <Link
            to="/settings/display"
            className="group relative overflow-hidden rounded-2xl p-4 md:p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl border border-white/5 block"
        >
            <div className={`absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            <div className="absolute inset-0 bg-gray-800/50 group-hover:opacity-0 transition-opacity" />

            <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-gray-300 group-hover:text-white transition-colors h-full">
                <div className="p-3 bg-gray-900/50 rounded-full backdrop-blur-sm group-hover:scale-110 transition-transform group-hover:bg-white/20 text-2xl">
                    {meta.icon}
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-sm tracking-wide">Organization</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">{meta.label}</span>
                </div>
            </div>
        </Link>
    );
};

export default OrganizationWidget;
