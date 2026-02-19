import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import Playmat from '../components/game/Playmat';
import {
    DndContext,
    DragOverlay,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import CardObject from '../components/game/CardObject';
import PhaseTracker from '../components/game/PhaseTracker';
import { GameProvider, useGame } from '../contexts/GameContext';
import TokenModal from '../components/game/TokenModal';
import ZoneModal from '../components/game/ZoneModal';

import { useDeck } from '../hooks/useDeck';

export default function SolitairePage() {
    return (
        <GameProvider>
            <SolitaireContent />
        </GameProvider>
    );
}

function SolitaireContent() {
    const { deckId } = useParams();
    const navigate = useNavigate();
    const { state, actions } = useGame();
    const { deck, cards: deckCards, loading: deckLoading, error: deckError } = useDeck(deckId);

    const [initialized, setInitialized] = useState(false);
    const [activeDragItem, setActiveDragItem] = useState(null);
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
    const [inspectedZone, setInspectedZone] = useState(null);

    // Draggable Widgets State
    const [manaWidget, setManaWidget] = useState({ x: 32, y: 120, isMinimized: false, isVisible: true });
    const [vitalityWidget, setVitalityWidget] = useState({ x: window.innerWidth - 240, y: window.innerHeight - 300, isMinimized: false, isVisible: true });
    const [phaseWidget, setPhaseWidget] = useState({ x: window.innerWidth / 2 - 250, y: 20, isMinimized: false, isVisible: true });

    const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 8 } });
    const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
    const sensors = useSensors(mouseSensor, touchSensor);

    useEffect(() => {
        if (!deckLoading && deck && deckCards && !initialized) {
            actions.loadDeck({
                mainboard: deckCards,
                commander: deckCards.filter(c => {
                    const isCmd = deck.commander && (c.scryfall_id === (deck.commander.id || deck.commander.scryfall_id));
                    const isPartner = deck.commander_partner && (c.scryfall_id === (deck.commander_partner.id || deck.commander_partner.scryfall_id));
                    return isCmd || isPartner;
                })
            });
            setInitialized(true);
        }
    }, [deckLoading, deck, deckCards, initialized, actions]);

    const isLoading = deckLoading || !initialized;

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key.toLowerCase()) {
                case 'd': actions.drawCard(); break;
                case ' ':
                    e.preventDefault();
                    actions.nextPhase();
                    break;
                case 'u': actions.untapAll(); break;
                case 'm':
                    if (window.confirm('Mulligan hand?')) actions.mulligan();
                    break;
                case 'r':
                    if (e.ctrlKey || e.metaKey || window.confirm('Restart game?')) actions.restartGame();
                    break;
                case 's': actions.shuffleLibrary(); break;
                default: break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [actions]);

    const handleDragStart = useCallback((event) => {
        const { active } = event;
        setActiveDragItem(active.data.current?.card);
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveDragItem(null);

        if (!over) return;

        const cardId = active.id;
        const fromZone = active.data.current?.fromZone;
        const toZone = over.id;

        let position = null;
        if (toZone === 'battlefield') {
            const overRect = over.rect;
            const activeRect = active.rect.current.translated;
            if (overRect && activeRect) {
                position = {
                    x: activeRect.left - overRect.left,
                    y: activeRect.top - overRect.top
                };
            }
        }

        if (fromZone !== toZone || position) {
            actions.moveCard(cardId, fromZone, toZone, 0, position);
        }
    }, [actions]);

    const handleCardClick = useCallback((card) => actions.tapCard(card.instanceId, card.zoneId), [actions]);

    return (
        <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
            {/* Header / Game Controls */}
            <div className="h-16 border-b border-white/5 flex items-center px-6 justify-between bg-black/40 backdrop-blur-xl shrink-0 z-40 relative">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-primary-500 uppercase tracking-widest">Solitaire</span>
                        <span className="text-sm font-bold text-white truncate max-w-[200px]">
                            {deck?.name || 'Loading...'}
                        </span>
                    </div>

                    <div className="h-8 w-px bg-white/10" />

                    {/* Widget Toggles */}
                    <div className="flex gap-2">
                        <Toggle
                            active={phaseWidget.isVisible}
                            onClick={() => setPhaseWidget(p => ({ ...p, isVisible: !p.isVisible }))}
                            label="Phase"
                        />
                        <Toggle
                            active={manaWidget.isVisible}
                            onClick={() => setManaWidget(p => ({ ...p, isVisible: !p.isVisible }))}
                            label="Mana"
                        />
                        <Toggle
                            active={vitalityWidget.isVisible}
                            onClick={() => setVitalityWidget(p => ({ ...p, isVisible: !p.isVisible }))}
                            label="Vitality"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setIsTokenModalOpen(true)}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        Token
                    </button>
                    <button
                        onClick={() => setInspectedZone('library')}
                        className="px-4 py-2 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Library
                    </button>
                    <button
                        onClick={() => setInspectedZone('graveyard')}
                        className="px-4 py-2 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Graveyard
                    </button>
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <button
                        onClick={() => actions.untapAll()}
                        className="px-4 py-2 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Untap (U)
                    </button>
                    <button
                        onClick={() => actions.drawCard()}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Draw (D)
                    </button>
                    <button
                        onClick={() => { if (window.confirm('Restart game?')) actions.restartGame(); }}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Restart
                    </button>
                </div>
            </div>

            {/* Main Play Area */}
            <div className="flex-grow p-4 overflow-hidden relative select-none">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-primary-400 font-black uppercase tracking-widest animate-pulse">Initializing Board...</span>
                        </div>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <Playmat
                            state={state}
                            onCardClick={handleCardClick}
                        />

                        {createPortal(
                            <DragOverlay dropAnimation={null}>
                                {activeDragItem ? (
                                    <div className="scale-110 rotate-3 transition-transform">
                                        <CardObject card={activeDragItem} zoneId="overlay" isOverlay />
                                    </div>
                                ) : null}
                            </DragOverlay>,
                            document.body
                        )}
                    </DndContext>
                )}

                {/* Draggable Phase Tracker */}
                <DraggableWidget
                    title="Phase Bar"
                    pos={phaseWidget}
                    setPos={setPhaseWidget}
                    isVisible={phaseWidget.isVisible}
                >
                    <PhaseTracker
                        currentPhase={state.turn.phase}
                        turnCount={state.turn.count}
                        landsPlayed={state.turn.landsPlayed}
                        onNextPhase={() => actions.nextPhase()}
                    />
                </DraggableWidget>

                {/* Draggable Mana Pool */}
                <DraggableWidget
                    title="Mana Pool"
                    pos={manaWidget}
                    setPos={setManaWidget}
                    isVisible={manaWidget.isVisible}
                    icon={<div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" /><div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse delay-75" /></div>}
                >
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(state.manaPool).map(([color, count]) => (
                            <div key={color} className="flex flex-col items-center group">
                                <div className="relative">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 border-white/5 bg-black/40 shadow-xl overflow-hidden transition-transform group-hover:scale-110 mb-2`}>
                                        <img
                                            src={`https://svgs.scryfall.io/card-symbols/${color.toUpperCase()}.svg`}
                                            alt={color}
                                            className="w-8 h-8 object-contain active:scale-95 transition-transform cursor-pointer"
                                            onClick={() => actions.addMana(color)}
                                        />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary-600 border-2 border-gray-950 flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                                        {count}
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => actions.spendMana(color)} className="text-gray-600 hover:text-red-500 p-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </DraggableWidget>

                {/* Draggable Life Counter */}
                <DraggableWidget
                    title="Vitality"
                    pos={vitalityWidget}
                    setPos={setVitalityWidget}
                    isVisible={vitalityWidget.isVisible}
                >
                    <div className="flex flex-col items-center gap-2">
                        <div className="text-6xl font-black text-white italic tracking-tighter drop-shadow-2xl">
                            {state.counters.life}
                        </div>
                        <div className="flex gap-4 mt-2">
                            <button onClick={() => actions.setLife(state.counters.life - 1)} className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 flex items-center justify-center transition-all">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
                            </button>
                            <button onClick={() => actions.setLife(state.counters.life + 1)} className="w-10 h-10 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 flex items-center justify-center transition-all">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>
                    </div>
                </DraggableWidget>

                {/* Gameplay Rules Enforcement Toast */}
                {state.ui.error && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300">
                        <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-white/20">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <span className="text-sm font-black uppercase tracking-widest">{state.ui.error}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Shortcuts/Info Footer */}
            <div className="h-10 bg-black/60 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 flex items-center px-8 border-t border-white/5 shrink-0 gap-6 z-40">
                <div className="flex gap-4">
                    <button
                        onClick={() => actions.undo()}
                        disabled={state.past.length === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${state.past.length > 0 ? 'bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 border border-primary-500/20' : 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed opacity-50'}`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        <span className="font-bold text-xs uppercase tracking-widest">Undo</span>
                    </button>
                    <div className="bg-gray-800/50 backdrop-blur-md px-6 py-2 rounded-xl border border-white/5 flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary-500" /> [1-7] Draw X</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Space: Next Phase</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-pink-500" /> U: Untap All</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> S: Shuffle</div>
                    </div>
                </div>
                <div className="flex-grow" />
                <span className="text-primary-500/50">Antigravity Solitaire Engine v2.0</span>
            </div>

            {/* Modals */}
            <TokenModal
                isOpen={isTokenModalOpen}
                onClose={() => setIsTokenModalOpen(false)}
                onCreateToken={(tokenData) => {
                    actions.createToken(tokenData);
                    setIsTokenModalOpen(false);
                }}
            />

            <ZoneModal
                isOpen={!!inspectedZone}
                zoneId={inspectedZone}
                onClose={() => setInspectedZone(null)}
            />
        </div>
    );
}

function Toggle({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${active ? 'bg-primary-500/20 text-primary-400 border-primary-500/50' : 'bg-gray-800/40 text-gray-600 border-white/5'}`}
        >
            {label}
        </button>
    );
}

function DraggableWidget({ title, pos, setPos, children, icon, isVisible }) {
    const dragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });

    const onMouseDown = (e) => {
        if (e.target.closest('button')) return;
        dragging.current = true;
        startPos.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        e.preventDefault();
    };

    useEffect(() => {
        const onMouseMove = (e) => {
            if (!dragging.current) return;
            setPos(prev => ({ ...prev, x: e.clientX - startPos.current.x, y: e.clientY - startPos.current.y }));
        };
        const onMouseUp = () => dragging.current = false;

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [setPos]);

    if (!isVisible) return null;

    return (
        <div
            className={`absolute bg-gray-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex flex-col shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] z-50 transition-all duration-300 ${pos.isMinimized ? 'w-16 h-16 p-2 rounded-2xl items-center justify-center' : ''}`}
            style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                top: 0,
                left: 0,
                cursor: dragging.current ? 'grabbing' : 'grab'
            }}
            onMouseDown={onMouseDown}
        >
            <div className={`flex items-center justify-between mb-4 select-none ${pos.isMinimized ? 'hidden' : ''}`}>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{title}</span>
                    {icon}
                </div>
                <button
                    onClick={() => setPos(prev => ({ ...prev, isMinimized: !prev.isMinimized }))}
                    className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>
                </button>
            </div>

            {pos.isMinimized ? (
                <button
                    onClick={() => setPos(prev => ({ ...prev, isMinimized: false }))}
                    className="w-12 h-12 flex items-center justify-center bg-primary-600/20 text-primary-400 rounded-xl hover:bg-primary-600/40 transition-all"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                </button>
            ) : children}
        </div>
    );
}
