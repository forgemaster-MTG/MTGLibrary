import React, { useRef, useState } from 'react';

const LifeCounter = ({ life, onChange, isSelf = false, label }) => {
    // Simple +/- buttons.
    // Future: Add long-press logic for +/- 10

    return (
        <div className={`flex flex-col items-center justify-center ${isSelf ? 'h-full' : 'h-32'} w-full relative group`}>
            <div className="absolute inset-x-0 top-0 text-center py-2 z-10 pointer-events-none">
                <span className={`${isSelf ? 'text-sm text-gray-400' : 'text-xs text-gray-500'} font-black uppercase tracking-widest truncate max-w-[90%] inline-block shadow-black drop-shadow-md`}>
                    {label}
                </span>
            </div>

            <div className="flex w-full h-full">
                {/* Minus Button */}
                <button
                    onClick={() => onChange(-1)}
                    className={`flex-1 flex items-center justify-center ${isSelf ? 'bg-red-900/20 hover:bg-red-900/40' : 'bg-red-900/10 hover:bg-red-900/20'} active:bg-red-500/30 transition-colors touch-manipulation`}
                >
                    <span className="sr-only">Minus 1 Life</span>
                    {/* Invisible click area, cosmetic icon */}
                </button>

                {/* Life Display (Centered absolute to overlay buttons seam) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className={`${isSelf ? 'text-8xl md:text-9xl' : 'text-5xl'} font-black text-white tabular-nums drop-shadow-xl tracking-tighter`}>
                        {life}
                    </span>
                </div>

                {/* Plus Button */}
                <button
                    onClick={() => onChange(1)}
                    className={`flex-1 flex items-center justify-center ${isSelf ? 'bg-green-900/20 hover:bg-green-900/40' : 'bg-green-900/10 hover:bg-green-900/20'} active:bg-green-500/30 transition-colors touch-manipulation`}
                >
                    <span className="sr-only">Plus 1 Life</span>
                </button>
            </div>

            {/* Visual divider */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-1/2 bg-white/5 pointer-events-none"></div>
        </div>
    );
};

export default LifeCounter;
