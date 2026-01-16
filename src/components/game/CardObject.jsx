import React, { useState, memo, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useGame } from '../../contexts/GameContext';
import CardContextMenu from './CardContextMenu';

// Helper to parse mana cost strings like "{2}{U}{B}" (replicated from reducer for UI)
function canAffordCard(pool, costString) {
    if (!costString) return true;
    const costs = { w: 0, u: 0, b: 0, r: 0, g: 0, c: 0, generic: 0 };
    const matches = costString.match(/\{([^}]+)\}/g);
    if (!matches) return true;

    matches.forEach(match => {
        const symbol = match.slice(1, -1).toLowerCase();
        if (['w', 'u', 'b', 'r', 'g', 'c'].includes(symbol)) costs[symbol]++;
        else if (!isNaN(symbol)) costs.generic += parseInt(symbol);
    });

    const tempPool = { ...pool };
    for (const color of ['w', 'u', 'b', 'r', 'g', 'c']) {
        if (tempPool[color] < costs[color]) return false;
        tempPool[color] -= costs[color];
    }
    const totalRemaining = Object.values(tempPool).reduce((a, b) => a + b, 0);
    return totalRemaining >= costs.generic;
}

const CardObject = memo(function CardObject({ card, zoneId, isOverlay = false, size = 'md' }) {
    const { state, actions } = useGame();
    const [contextMenu, setContextMenu] = useState(null);

    // Gameplay check: can this be played from hand?
    const inHand = zoneId === 'hand' || (isOverlay && card.fromZone === 'hand');
    const isLand = card.type_line && card.type_line.includes('Land');

    const affordable = useMemo(() =>
        inHand && !isLand && canAffordCard(state.manaPool, card.mana_cost),
        [inHand, isLand, state.manaPool, card.mana_cost]);

    const playableLand = useMemo(() =>
        inHand && isLand && state.turn.landsPlayed < 1,
        [inHand, isLand, state.turn.landsPlayed]);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: card.instanceId,
        data: {
            card,
            fromZone: zoneId
        },
        disabled: isOverlay
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
        willChange: 'transform',
    } : {
        willChange: 'transform',
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleClick = (e) => {
        if (isDragging) return;
        actions.tapCard(card.instanceId, zoneId);
    };

    // Size Mapping
    const sizeClasses = {
        sm: 'w-32 h-44 rounded-xl',
        md: 'w-40 h-56 rounded-[1.5rem]',
        lg: 'w-48 h-64 rounded-[2rem]',
        tactical: 'w-44 h-60 rounded-2xl'
    };

    // Determine effective size based on zone if not explicitly provided
    const effectiveSize = size || (zoneId === 'battlefield' ? 'tactical' : (zoneId === 'hand' ? 'md' : 'sm'));
    const rotateClass = card.tapped ? 'rotate-90 translate-x-8' : '';

    return (
        <>
            <div
                ref={!isOverlay ? setNodeRef : null}
                style={style}
                {...(!isOverlay ? listeners : {})}
                {...(!isOverlay ? attributes : {})}
                onClick={!isOverlay ? handleClick : undefined}
                onContextMenu={!isOverlay ? handleContextMenu : undefined}
                className={`
                    relative ${sizeClasses[effectiveSize]} bg-gray-900 border-2 transition-all duration-300
                    ${isOverlay ? 'border-indigo-500 shadow-2xl scale-110' : 'border-white/10 shadow-lg'}
                    ${card.isToken ? 'border-dashed border-emerald-500/50' : ''}
                    ${(affordable || playableLand) && !isDragging ? 'ring-4 ring-emerald-500/30' : ''}
                    hover:border-indigo-500/50 hover:shadow-indigo-500/40 hover:scale-[1.05] 
                    cursor-grab active:cursor-grabbing group z-[10] hover:z-[50]
                    ${rotateClass}
                    ${isDragging ? 'opacity-0' : 'opacity-100'}
                `}
            >
                <CardContent card={card} isOverlay={isOverlay} size={effectiveSize} zoneId={zoneId} />

                {/* Affordance Glow */}
                {(affordable || playableLand) && !isDragging && (
                    <div className="absolute inset-0 rounded-inherit bg-emerald-500/5 animate-pulse pointer-events-none" />
                )}
            </div>

            {contextMenu && (
                <CardContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    actions={actions}
                    card={card}
                    zoneId={zoneId}
                />
            )}
        </>
    );
});

export default CardObject;

const CardContent = memo(function CardContent({ card, isOverlay, size, zoneId }) {
    const { state } = useGame();
    const p1p1 = card.counters?.p1p1 || 0;
    const loyalty = card.counters?.loyalty || 0;
    const other = card.counters?.other || 0;

    const hasPT = card.power !== undefined && card.toughness !== undefined;

    // Safely calculate P/T handling "*" or non-numeric values
    const { currentPower, currentToughness } = useMemo(() => {
        const pVal = parseInt(card.power);
        const tVal = parseInt(card.toughness);
        return {
            currentPower: hasPT ? (isNaN(pVal) ? card.power : pVal + p1p1) : null,
            currentToughness: hasPT ? (isNaN(tVal) ? card.toughness : tVal + p1p1) : null
        };
    }, [card.power, card.toughness, hasPT, p1p1]);

    const isLarge = size === 'lg' || size === 'tactical' || size === 'md';

    return (
        <div className="w-full h-full relative pointer-events-none select-none overflow-hidden rounded-inherit">
            {card.faceDown ? (
                <div className="w-full h-full bg-indigo-950 rounded-inherit flex items-center justify-center border-4 border-white/5 overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                    <div className={`${isLarge ? 'w-24 h-24' : 'w-16 h-16'} rounded-full border-2 border-white/20 bg-indigo-900/30 backdrop-blur-md flex items-center justify-center shadow-2xl`}>
                        <div className={`${isLarge ? 'w-16 h-16' : 'w-10 h-10'} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 opacity-50 blur-sm animate-pulse`} />
                    </div>
                </div>
            ) : (
                <div className={`w-full h-full overflow-hidden rounded-inherit relative bg-gray-950 flex flex-col`}>
                    {card.image_uri ? (
                        <img
                            src={card.image_uri}
                            alt={card.name}
                            loading="lazy"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://game-icons.net/icons/ffffff/000000/1x1/delapouite/card-back.svg';
                                e.target.style.opacity = 0.5;
                            }}
                            className="w-full h-full object-cover select-none pointer-events-none"
                        />
                    ) : (
                        <div className="p-4 text-xs text-gray-400 font-bold uppercase tracking-tighter bg-gray-900 h-full flex flex-col items-center justify-center text-center">
                            <span className="text-white text-sm mb-1">{card.name}</span>
                            {card.type_line && <span className="opacity-50 text-[10px] leading-tight">{card.type_line}</span>}
                        </div>
                    )}

                    {/* Token Ribbon */}
                    {card.isToken && (
                        <div className={`absolute top-0 right-0 bg-emerald-600 ${isLarge ? 'text-[10px] px-3 py-1' : 'text-[8px] px-2 py-0.5'} font-black text-white rounded-bl-xl shadow-md uppercase tracking-widest z-20 border-l border-b border-white/10`}>
                            Token
                        </div>
                    )}

                    {/* Status Icons */}
                    <div className="absolute bottom-2 right-2 flex flex-col gap-2 z-30">
                        {card.tapped && (
                            <div className={`${isLarge ? 'w-8 h-8' : 'w-6 h-6'} rounded-full bg-amber-500/90 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/20 animate-in zoom-in duration-300`}>
                                <svg className={`${isLarge ? 'w-5 h-5' : 'w-4 h-4'} text-white`} fill="currentColor" viewBox="0 0 20 20"><path d="M4.555 13.791L14.17 9.852l-1.474-3.56L3.081 10.23l1.474 3.561z" /></svg>
                            </div>
                        )}
                        {card.summoningSickness && card.type_line?.includes('Creature') && (
                            <div className={`${isLarge ? 'w-8 h-8' : 'w-6 h-6'} rounded-full bg-indigo-500/90 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/20 animate-in zoom-in duration-300`}>
                                <span className={`${isLarge ? 'text-sm' : 'text-xs'} font-black text-white italic`}>zZz</span>
                            </div>
                        )}
                    </div>

                    {/* HUD: Power/Toughness Overlay */}
                    {hasPT && (
                        <div className={`absolute ${isLarge ? 'bottom-2 left-2' : 'bottom-1 left-1'} z-40`}>
                            <div className={`bg-black/80 backdrop-blur-xl border-2 border-white/20 rounded-xl ${isLarge ? 'px-3 py-1.5 gap-2' : 'px-2 py-1 gap-1'} flex items-center shadow-2xl transition-transform group-hover:scale-110`}>
                                <span className={`${isLarge ? 'text-lg' : 'text-sm'} font-black italic tracking-tighter ${p1p1 > 0 ? 'text-emerald-400' : p1p1 < 0 ? 'text-red-400' : 'text-white'}`}>
                                    {currentPower}
                                </span>
                                <span className="text-gray-500 font-black">/</span>
                                <span className={`${isLarge ? 'text-lg' : 'text-sm'} font-black italic tracking-tighter ${p1p1 > 0 ? 'text-emerald-400' : p1p1 < 0 ? 'text-red-400' : 'text-white'}`}>
                                    {currentToughness}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* HUD: Loyalty Overlay */}
                    {card.type_line?.includes('Planeswalker') && (
                        <div className={`absolute ${isLarge ? 'bottom-2 left-2' : 'bottom-1 left-1'} z-40`}>
                            <div className={`bg-orange-600/90 backdrop-blur-xl border-2 border-white/20 rounded-xl ${isLarge ? 'px-3 py-1 gap-2' : 'px-2 py-0.5 gap-1'} flex items-center shadow-2xl`}>
                                <svg className={`${isLarge ? 'w-5 h-5' : 'w-3 h-3'} text-white`} fill="currentColor" viewBox="0 0 20 20"><path d="M10 2l-7 7 7 7 7-7-7-7z" /></svg>
                                <span className={`${isLarge ? 'text-xl' : 'text-base'} font-black text-white italic tracking-tighter`}>{loyalty || card.loyalty}</span>
                            </div>
                        </div>
                    )}

                    {/* HUD: Counters & Tax Overlay (Top Left) */}
                    <div className={`absolute ${isLarge ? 'top-2 left-2 gap-2' : 'top-1 left-1 gap-1'} flex flex-col z-30 pointer-events-none`}>
                        {p1p1 !== 0 && (
                            <div className={`bg-indigo-600 text-white rounded-xl ${isLarge ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'} font-black shadow-2xl border-2 border-white/20 flex items-center gap-2 animate-in slide-in-from-left-4 duration-300`}>
                                <span className="opacity-70 text-[10px] uppercase tracking-tighter hidden md:inline">Counters</span>
                                <span className={isLarge ? 'text-sm' : 'text-xs'}>{p1p1 > 0 ? `+${p1p1}` : p1p1}</span>
                            </div>
                        )}
                        {card.isCommander && zoneId === 'command' && (
                            <div className={`bg-red-600 text-white rounded-xl ${isLarge ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'} font-black shadow-2xl border-2 border-white/20 flex items-center gap-2`}>
                                <span className="opacity-70 text-[10px] uppercase tracking-tighter hidden md:inline">Tax</span>
                                <span className={isLarge ? 'text-sm' : 'text-xs'}>+{(state.commanderTax?.[card.instanceId] || 0) * 2}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {!isOverlay && !card.faceDown && (
                <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors pointer-events-none rounded-inherit" />
            )}
        </div>
    );
});
