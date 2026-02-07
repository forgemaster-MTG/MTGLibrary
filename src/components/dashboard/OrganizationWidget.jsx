import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const OrganizationWidget = ({ size }) => {
    const { userProfile } = useAuth();
    const mode = userProfile?.settings?.organization?.mode;

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isMedium = size === 'medium';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';

    const getModeMeta = (m) => {
        switch (m) {
            case 'deckbuilder': return { label: 'Deckbuilder', icon: '🛠️', desc: 'Sorted by Color & Type', color: 'indigo' };
            case 'collector': return { label: 'Collector', icon: '📚', desc: 'Sorted by Set & Number', color: 'blue' };
            case 'hybrid': return { label: 'Hybrid', icon: '⚡', desc: 'Binders + Bulk Boxes', color: 'amber' };
            case 'custom': return { label: 'Custom', icon: '⚙️', desc: 'Advanced Hierarchy', color: 'emerald' };
            default: return { label: 'Reference', icon: '📁', desc: 'Default Organization', color: 'gray' };
        }
    };

    const meta = getModeMeta(mode);

    if (isXS) {
        return (
            <Link to="/settings/display" className="bg-gray-900/60 border border-white/5 rounded-3xl h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all group">
                <span className="text-xl group-hover:scale-125 transition-transform">{meta.icon}</span>
                <span className="text-[10px] font-black text-gray-500 mt-1 uppercase tracking-tighter">Org</span>
            </Link>
        );
    }

    return (
        <div className={`bg-gray-900/60 border border-white/5 rounded-3xl backdrop-blur-md overflow-hidden h-full flex flex-col relative group transition-all hover:border-white/10`}>
            {/* Header / Main Info */}
            <div className={`flex items-center gap-3 ${isXL ? 'p-8 pb-4' : isSmall ? 'p-4' : 'p-6'}`}>
                <div className={`aspect-square ${isSmall ? 'w-8 h-8 text-lg' : 'w-14 h-14 text-3xl'} flex items-center justify-center bg-gray-950 rounded-2xl shadow-inner border border-white/5 group-hover:scale-110 transition-transform`}>
                    {meta.icon}
                </div>
                <div className="flex flex-col">
                    <h3 className="font-black text-white uppercase tracking-wider text-sm flex items-center gap-2">
                        Organization
                        <span className={`w-1.5 h-1.5 rounded-full bg-${meta.color}-500 animate-pulse`} />
                    </h3>
                    <div className="flex items-baseline gap-2">
                        <span className={`${isSmall ? 'text-lg' : 'text-xl'} font-black text-${meta.color}-400`}>{meta.label}</span>
                        {!isSmall && <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{meta.desc}</span>}
                    </div>
                </div>
            </div>

            {/* Comprehensive Detail Views */}
            <div className={`flex-grow px-6 ${isSmall ? 'pb-4 px-4' : 'pb-6'} overflow-hidden`}>
                {isXL ? (
                    <div className="flex gap-4 h-full">
                        <div className="flex-grow grid grid-cols-4 gap-3">
                            {[
                                { name: "Main Binder", type: "Binder", fill: 85, color: "indigo" },
                                { name: "Bulk Box A", type: "Box", fill: 40, color: "blue" },
                                { name: "Trade Folder", type: "Binder", fill: 12, color: "emerald" },
                                { name: "Rares Box", type: "Box", fill: 95, color: "amber" },
                            ].map((loc, i) => (
                                <div key={i} className="bg-gray-950/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:bg-gray-800 transition-colors cursor-pointer group/loc">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[10px] font-black text-gray-500 uppercase">{loc.type}</span>
                                        <span className={`text-[9px] font-bold text-${loc.color}-400 px-1.5 py-0.5 bg-${loc.color}-500/10 rounded-full border border-${loc.color}-500/20`}>{loc.fill}% Full</span>
                                    </div>
                                    <div className="mt-2 text-xs font-bold text-gray-300 group-hover/loc:text-white truncate">{loc.name}</div>
                                    <div className="mt-2 w-full bg-white/5 rounded-full h-1 overflow-hidden">
                                        <div className={`h-full bg-${loc.color}-500 transition-all duration-1000`} style={{ width: `${loc.fill}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2 min-w-[140px]">
                            <Link to="/settings/display" className="flex-grow flex items-center justify-center rounded-2xl border border-dashed border-white/10 text-[10px] font-bold text-gray-500 hover:border-white/20 hover:text-white transition-all p-2 text-center">Manage Storage</Link>
                            <Link to="/settings/display" className="flex-grow flex items-center justify-center rounded-2xl bg-white/5 text-[10px] font-bold text-gray-400 hover:bg-white/10 transition-all p-2 text-center">Change Mode</Link>
                        </div>
                    </div>
                ) : isLarge ? (
                    <div className="flex items-center gap-6 h-full">
                        <div className="flex-grow space-y-3">
                            <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase">
                                <span>Storage Capacity</span>
                                <span className="text-white">65% Global Fill</span>
                            </div>
                            <div className="w-full bg-gray-950 rounded-full h-3 p-0.5 border border-white/5">
                                <div className={`h-full bg-gradient-to-r from-${meta.color}-600 to-${meta.color}-400 rounded-full shadow-[0_0_10px_rgba(var(--color-primary),0.3)] transition-all duration-1000`} style={{ width: '65%' }} />
                            </div>
                            <p className="text-[10px] text-gray-500 italic">"Items are currently sorted using the {meta.label} logic. 12 binders detected."</p>
                        </div>
                        <Link to="/settings/display" className="flex-shrink-0 w-1/4 h-20 bg-white/5 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-white/10 transition-all">
                            <div className="text-xs font-black text-white">Advanced</div>
                            <div className="text-[9px] text-gray-500 uppercase font-bold">Settings &rarr;</div>
                        </Link>
                    </div>
                ) : (isMedium || isSmall) ? (
                    <div className="flex flex-col justify-end h-full">
                        <div className="h-1.5 w-full bg-gray-950 rounded-full overflow-hidden border border-white/5">
                            <div className={`h-full bg-${meta.color}-500 transition-all duration-1000`} style={{ width: '65%' }} />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">65% Full</span>
                            <Link to="/settings/display" className="text-[10px] text-white font-bold underline-offset-4 hover:underline">Settings</Link>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Subtle Gradient Hover Effect */}
            <div className={`absolute inset-0 bg-gradient-to-br from-${meta.color}-500/0 to-${meta.color}-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500`} />
        </div>
    );
};

export default OrganizationWidget;
