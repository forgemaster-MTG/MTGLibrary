import React from 'react';
import DeckAdvancedStats from '../DeckAdvancedStats';

const DeckStatsModal = ({ isOpen, onClose, cards, deckName }) => {
    // Lock body scroll
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-gray-900/60 backdrop-blur-3xl w-full max-w-6xl max-h-[90vh] mx-auto rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden ring-1 ring-white/5 relative">

                {/* Decorative Background Glows */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-inner">
                            <span className="text-3xl">📊</span>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none mb-1">{helperName} Analysis</h2>
                            <p className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.3em]">{deckName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-gray-400 hover:text-white border border-white/5 hover:border-white/10 group"
                    >
                        <svg className="w-6 h-6 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    <DeckAdvancedStats cards={cards} />
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-white/5 bg-white/5 flex justify-end shrink-0 gap-4">
                    <button
                        onClick={onClose}
                        className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl uppercase tracking-[0.2em] text-[11px] border border-white/10 active:scale-95 flex items-center gap-2 group/btn"
                    >
                        <span>Close Analysis</span>
                        <svg className="w-4 h-4 text-white/50 group-hover/btn:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); margin: 20px 0; border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
                ` }} />
            </div>
        </div>
    );
};

export default DeckStatsModal;
