import React, { useEffect, useRef } from 'react';

export default function CardContextMenu({ x, y, onClose, actions, card, zoneId }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleAction = (fn) => {
        fn();
        onClose();
    };

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 min-w-[180px] overflow-hidden"
            style={{ left: x, top: y }}
        >
            <div className="px-4 py-1.5 border-b border-white/5 mb-1">
                <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest leading-none">Card Actions</span>
                <div className="text-white text-xs font-bold truncate">{card.name}</div>
            </div>

            {/* Core Movement Actions */}
            <MenuButton
                onClick={() => handleAction(() => actions.moveCard(card.instanceId, zoneId, 'graveyard'))}
                label="Destroy / Discard"
                icon={<svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
            />
            <MenuButton
                onClick={() => handleAction(() => actions.moveCard(card.instanceId, zoneId, 'exile'))}
                label="Exile"
                icon={<svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
            <MenuButton
                onClick={() => handleAction(() => actions.moveCard(card.instanceId, zoneId, 'library', 0))} // Top of library
                label="Put on Top"
                icon={<svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>}
            />
            <MenuButton
                onClick={() => handleAction(() => actions.moveCard(card.instanceId, zoneId, 'hand'))}
                label="Return to Hand"
                icon={<svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
            />

            <div className="h-px bg-white/5 my-1" />

            {/* Counter Actions */}
            <div className="px-4 py-1 text-[8px] font-bold text-gray-500 uppercase tracking-widest">Counters</div>
            <div className="flex px-2 pb-1 gap-1">
                <CounterControl label="+1/+1" onAdd={() => actions.addCounter(card.instanceId, zoneId, 'p1p1', 1)} onSub={() => actions.removeCounter(card.instanceId, zoneId, 'p1p1', 1)} />
                <CounterControl label="Loyalty" onAdd={() => actions.addCounter(card.instanceId, zoneId, 'loyalty', 1)} onSub={() => actions.removeCounter(card.instanceId, zoneId, 'loyalty', 1)} />
            </div>

            <div className="h-px bg-white/5 my-1" />

            <MenuButton
                onClick={() => handleAction(() => actions.tapCard(card.instanceId, zoneId))}
                label={card.tapped ? "Untap" : "Tap"}
                icon={<svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
            />
        </div>
    );
}

function MenuButton({ onClick, label, icon }) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all text-left group"
        >
            <span className="opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
            <span>{label}</span>
        </button>
    );
}

function CounterControl({ label, onAdd, onSub }) {
    return (
        <div className="flex-1 flex flex-col items-center bg-white/5 rounded-lg py-1 px-2 border border-white/5">
            <span className="text-[8px] text-gray-500 mb-1">{label}</span>
            <div className="flex gap-2">
                <button onClick={onSub} className="text-gray-400 hover:text-red-500 text-[10px] p-1 font-black">－</button>
                <button onClick={onAdd} className="text-gray-400 hover:text-emerald-500 text-[10px] p-1 font-black">＋</button>
            </div>
        </div>
    );
}
