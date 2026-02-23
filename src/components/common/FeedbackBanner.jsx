import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const FeedbackBanner = () => {
    const location = useLocation();

    // Only show on pages other than the landing page
    if (location.pathname === '/') return null;

    return (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40">
            {/* 
                Bottom-16 on mobile to stay above the bottom mobile nav bar (h-16).
                Bottom-0 on desktop.
            */}
            <div className="bg-gradient-to-r from-primary-600/90 via-orange-600/90 to-primary-600/90 backdrop-blur-md border-t border-white/10 px-4 py-2 flex items-center justify-center gap-4 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.3)] animate-slide-up">
                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-block text-xl">🔨</span>
                    <p className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider">
                        The Forge is in <span className="text-amber-200">Alpha</span>. Help us grow!
                    </p>
                </div>

                <Link
                    to="/support"
                    className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-1 rounded-full text-[9px] sm:text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                >
                    Support & Feedback
                </Link>

                <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l border-white/20 text-[10px] text-white/60">
                    <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-green-400"></span>
                    Live Testing
                </div>
            </div>
        </div>
    );
};

export default FeedbackBanner;
