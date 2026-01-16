import React, { useState, useEffect } from 'react';
import { dashboardTips } from '../../data/dashboard_tips';

const TipsWidget = ({ size }) => {
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isLargePlus = size === 'large' || size === 'xlarge';

    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * dashboardTips.length);
        setCurrentTipIndex(randomIndex);
    }, []);

    const changeTip = (direction) => {
        if (isAnimating) return;
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);

        setCurrentTipIndex(prev => {
            if (direction === 'next') {
                return (prev + 1) % dashboardTips.length;
            } else {
                return (prev - 1 + dashboardTips.length) % dashboardTips.length;
            }
        });
    };

    if (isXS) {
        return (
            <div
                onClick={() => changeTip('next')}
                className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl h-full flex items-center justify-center cursor-pointer hover:bg-yellow-500/20 transition-all group"
            >
                <svg className="w-6 h-6 text-yellow-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
        );
    }

    return (
        <div className={`bg-gray-900/50 border border-white/5 rounded-3xl ${isSmall ? 'p-4' : 'p-6'} backdrop-blur-md relative overflow-hidden group h-full flex flex-col`}>
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-20 h-20 transform rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" /></svg>
            </div>

            <h2 className="font-black text-white mb-2 flex items-center gap-2 relative z-10 text-[10px] uppercase tracking-widest">
                <span className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </span>
                Pro Tip
            </h2>

            <div className="relative z-10 flex-grow flex flex-col justify-between">
                <p className={`text-gray-300 leading-relaxed transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'} ${isLargePlus ? 'text-sm' : 'text-[11px]'}`}>
                    {dashboardTips[currentTipIndex]}
                </p>

                <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-3">
                    <span className="text-[9px] text-gray-500 font-mono font-bold uppercase tracking-widest">
                        Tip {currentTipIndex + 1} of {dashboardTips.length}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={() => changeTip('prev')} className="p-1.5 rounded-lg bg-gray-950/50 hover:bg-gray-800 text-gray-500 hover:text-white transition-all border border-white/5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => changeTip('next')} className="p-1.5 rounded-lg bg-gray-950/50 hover:bg-gray-800 text-gray-500 hover:text-white transition-all border border-white/5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TipsWidget;
