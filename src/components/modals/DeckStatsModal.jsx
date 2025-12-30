import React from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import DeckAdvancedStats from '../DeckAdvancedStats';

const DeckStatsModal = ({ isOpen, onClose, cards, deckName }) => {
    const { userProfile } = useAuth();
    const helperName = userProfile?.settings?.helper?.name || 'The Oracle';

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in overscroll-contain">
            <div className="bg-gray-900/60 backdrop-blur-3xl w-full max-w-6xl max-h-[90vh] mx-auto rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden ring-1 ring-white/5 relative">

                {/* Decorative Background Glows */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5 shrink-0">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black font-mono text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Analytics</span>
                            <span className="text-[10px] font-black font-mono text-gray-400 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">{helperName}</span>
                        </div>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Deck Performance</h2>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 custom-scrollbar">
                    <DeckAdvancedStats cards={cards} />
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-white/5 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-8 py-3.5 bg-gray-900/50 hover:bg-gray-800 text-white font-black rounded-2xl transition-all border border-white/10 hover:border-white/20 active:scale-95 text-[11px] uppercase tracking-[0.2em] shadow-lg"
                    >
                        Close Analytics
                    </button>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; border: 2px solid transparent; background-clip: content-box; transition: background 0.3s; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); border: 2px solid transparent; background-clip: content-box; }
            ` }} />
        </div>
        , document.body);
};

export default DeckStatsModal;
