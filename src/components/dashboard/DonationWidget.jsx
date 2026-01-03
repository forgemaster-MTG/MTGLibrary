import React from 'react';

const DonationWidget = ({ onOpenModal }) => {
    return (
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden group">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-all duration-700"></div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-xl shadow-inner">
                        💖
                    </div>
                    <div>
                        <h3 className="font-bold text-white leading-tight">Support the Forge</h3>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Community Project</p>
                    </div>
                </div>

                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                    MTG-Forge is built by enthusiasts, for enthusiasts. Help us keep the AI Architect powered up!
                </p>

                <button
                    onClick={onOpenModal}
                    className="w-full py-3 bg-white hover:bg-indigo-50 text-indigo-950 font-black rounded-xl transition-all transform hover:-translate-y-1 shadow-lg shadow-white/5 flex items-center justify-center gap-2 group/btn"
                >
                    Donate Now
                    <svg className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
            </div>
        </div>
    );
};

export default DonationWidget;
