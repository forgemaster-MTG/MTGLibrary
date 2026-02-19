import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Share2 } from 'lucide-react';
import { getTierConfig } from '../../config/tiers';

export default function DeckToolsMenu({
    isOpen,
    onClose,
    isEditMode,
    deck,
    totalValue,
    onOpenSearch,
    onOpenStrategy,
    onOpenCollection,
    onOpenDoctor,
    onOpenAudit,
    onOpenPrint,
    onOpenExport,
    onOpenSettings,
    onOpenShare,
    onToggleMockup,
    onDelete,
    onOpenSolitaire,
    onOpenTokens,
    onOpenTournaments
}) {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { theme } = useTheme(); // can be used for specific styling nuances if needed
    const menuRef = useRef(null);
    const triggerRef = useRef(null); // To return focus if needed

    // Close on click outside (Desktop)
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target) && isOpen) {
                // Check if click was on the trigger button (handled by parent usually, but good safeguard)
                const trigger = document.getElementById('deck-tools-trigger');
                if (trigger && trigger.contains(event.target)) return;

                onClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const tierConfig = userProfile?.tierConfig || getTierConfig(userProfile?.subscription_tier);
    const canUseDoctor = tierConfig.features.deckDoctor;
    const canUseAudit = tierConfig.features.deckAudit;
    const canUseExport = tierConfig.features.deckBackup;
    const canUseMockup = tierConfig.features.mockupDeck;
    const canUseBuilder = tierConfig.features.deckSuggestions;

    const MenuContent = () => (
        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar max-h-[80vh] md:max-h-[600px]">
            {/* Section: Building */}
            <div className="space-y-2">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Deck Building</h3>
                <div className="grid grid-cols-2 gap-2">
                    {isEditMode && (
                        <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/decks/${deck.id}/build`); onClose(); }}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group ${canUseBuilder
                                ? 'bg-primary-600/10 hover:bg-primary-600/20 border-primary-500/10 hover:border-primary-500/30'
                                : 'bg-gray-800 opacity-50 cursor-not-allowed'}`}
                        >
                            <span className="text-xl">✨</span>
                            <span className="text-[10px] font-bold text-gray-300">AI Builder</span>
                        </button>
                    )}

                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenSearch(); onClose(); }}
                        className={`flex flex-col items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5 transition-all group ${isEditMode ? 'hover:bg-primary-500/10 hover:border-primary-500/20' : 'opacity-50 cursor-not-allowed'}`}
                        disabled={!isEditMode}
                    >
                        <svg className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <span className="text-[10px] font-bold text-gray-300">Search</span>
                    </button>
                </div>
            </div>

            {/* Section: Analysis */}
            <div className="space-y-2">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Logic & Analysis</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (canUseDoctor) { onOpenDoctor(); onClose(); }
                        }}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group ${canUseDoctor
                            ? 'bg-primary-500/10 hover:bg-primary-500/30 border-primary-500/20'
                            : 'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed'
                            }`}
                    >
                        <span className="text-xl group-hover:scale-110 transition-transform">🩺</span>
                        <span className="text-[10px] font-bold text-primary-300">Doctor</span>
                    </button>

                    {isEditMode && (
                        <button
                            onClick={(e) => { e.stopPropagation(); if (canUseAudit) { onOpenAudit(); onClose(); } }}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group ${canUseAudit
                                ? 'bg-purple-500/10 hover:bg-purple-500/30 border-purple-500/20'
                                : 'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed'}`}
                        >
                            <svg className={`w-5 h-5 group-hover:scale-110 transition-transform ${canUseAudit ? 'text-purple-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${canUseAudit ? 'text-purple-300' : 'text-gray-500'}`}>Audit</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Section: Tabletop */}
            <div className="space-y-2">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Tabletop Tools</h3>
                <div className="grid grid-cols-1 gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/solitaire/${deck.id}`);
                            onClose();
                        }}
                        className="w-full py-3 bg-emerald-900/10 hover:bg-emerald-900/20 text-emerald-400 rounded-xl border border-emerald-500/10 hover:border-emerald-500/30 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 group"
                    >
                        <span className="text-lg group-hover:scale-110 transition-transform">🎲</span>
                        Solitaire & Playtest
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onOpenPrint(); onClose(); }}
                            className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all group"
                        >
                            <span className="text-xl group-hover:scale-110 transition-transform">🖨️</span>
                            <span className="text-[10px] font-bold text-gray-300">Print Proxies</span>
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); navigate('/play/lobby'); onClose(); }}
                            className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all group"
                        >
                            <span className="text-xl group-hover:scale-110 transition-transform">🎥</span>
                            <span className="text-[10px] font-bold text-gray-300">Live Session</span>
                        </button>
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenTokens(); onClose(); }}
                        className="w-full py-2 bg-pink-900/10 hover:bg-pink-900/20 text-pink-400 rounded-xl border border-pink-500/10 hover:border-pink-500/30 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 group"
                    >
                        <span className="text-sm group-hover:scale-110 transition-transform">🪙</span>
                        Required Tokens
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); navigate('/tournaments'); onClose(); }}
                        className="w-full py-2 bg-amber-900/10 hover:bg-amber-900/20 text-amber-500 rounded-xl border border-amber-500/10 hover:border-amber-500/30 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 group"
                    >
                        <span className="text-sm group-hover:scale-110 transition-transform">🏆</span>
                        Find Tournament
                    </button>
                </div>
            </div>

            {/* Section: Management */}
            <div className="space-y-2 pb-6 md:pb-2">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Management</h3>
                <div className="bg-white/5 rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                    {isEditMode && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onOpenSettings(); onClose(); }}
                            className="w-full text-left px-4 py-3 text-xs flex items-center justify-between hover:bg-primary-500/10 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-gray-400 group-hover:text-primary-400 transition-colors">⚙️</span>
                                <span className="font-bold text-gray-300">Deck Settings</span>
                            </div>
                            <svg className="w-3 h-3 text-gray-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    )}

                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenShare(); onClose(); }}
                        className="w-full text-left px-4 py-3 text-xs flex items-center justify-between hover:bg-primary-500/10 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <Share2 className="w-4 h-4 text-primary-400" />
                            <span className="font-bold text-gray-300">Share Deck</span>
                        </div>
                        <svg className="w-3 h-3 text-gray-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (canUseExport) { onOpenExport(); onClose(); }
                        }}
                        className={`w-full text-left px-4 py-3 text-xs flex items-center justify-between transition-colors group ${canUseExport ? 'hover:bg-gray-800' : 'opacity-40 cursor-not-allowed'}`}
                    >
                        <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span className="font-bold text-gray-300">Export Deck</span>
                        </div>
                        {!canUseExport && <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded leading-none">PRO</span>}
                    </button>

                    {isEditMode && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (canUseMockup) { onToggleMockup(); onClose(); }
                                }}
                                className={`w-full text-left px-4 py-3 text-xs flex items-center justify-between transition-colors group ${canUseMockup ? 'hover:bg-orange-950/20' : 'opacity-40 cursor-not-allowed'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    <span className="font-bold text-gray-300">{deck.is_mockup ? 'To Collection' : 'To Mockup'}</span>
                                </div>
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
                                className="w-full text-left px-4 py-3 text-xs flex items-center gap-3 hover:bg-red-900/30 text-red-400 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                <span className="font-bold">Delete Deck</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Dropdown */}
            <div
                ref={menuRef}
                className="hidden md:block absolute right-0 top-full mt-3 w-80 bg-gray-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-hidden"
            >
                <MenuContent />
            </div>

            {/* Mobile Full-Screen Menu (Overlay below Nav) */}
            {isOpen && createPortal(
                <div className="md:hidden fixed inset-0 top-16 z-[40] bg-gray-950/95 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200 flex flex-col">
                    {/* Mobile Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gray-900/50 shrink-0">
                        <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <span className="text-2xl">🛠️</span>
                            Deck Tools
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors active:scale-95"
                            aria-label="Close Menu"
                        >
                            {/* X Icon */}
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
                        <div className="p-4 space-y-4">
                            <MenuContent />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
