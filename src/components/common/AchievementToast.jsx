
import React, { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { achievementService } from '../../services/AchievementService';

export default function AchievementToast() {
    const [queue, setQueue] = useState([]);
    const [visible, setVisible] = useState(false);
    const [current, setCurrent] = useState(null);

    useEffect(() => {
        // Subscribe to unlocks
        const unsubscribe = achievementService.subscribe((achievement) => {
            setQueue(prev => [...prev, achievement]);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!visible && queue.length > 0) {
            const next = queue[0];
            setCurrent(next);
            setQueue(prev => prev.slice(1));
            setVisible(true);

            // Play sound?
            // const audio = new Audio('/sounds/achievement.mp3');
            // audio.play().catch(() => {});

            // Auto hide
            const timer = setTimeout(() => {
                setVisible(false);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [visible, queue]);

    if (!visible || !current) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
            <div className="flex items-center gap-4 bg-gray-900 border border-yellow-500/50 rounded-2xl p-4 shadow-[0_0_50px_rgba(234,179,8,0.2)] pr-12 relative overflow-hidden group">
                {/* Shine effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shine pointer-events-none" />

                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                    <Trophy className="w-7 h-7 text-white drop-shadow-md" />
                </div>

                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-0.5">Achievement Unlocked</div>
                    <h4 className="text-lg font-bold text-white leading-tight">{current.title}</h4>
                    <p className="text-xs text-gray-400 mt-1 leading-snug">{current.description}</p>
                    <div className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1">
                        {current.xp} XP Gained
                    </div>
                </div>

                <button
                    onClick={() => setVisible(false)}
                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white cursor-pointer transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// Ensure CSS for animation is present or added
// .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
// @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
