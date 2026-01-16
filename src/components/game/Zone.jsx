import React, { memo } from 'react';
import CardObject from './CardObject';
import { useDroppable } from '@dnd-kit/core';

const Zone = memo(function Zone({ id, cards, title, className = '', layout = 'grid', onCardClick }) {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
    });

    const style = {
        opacity: isOver ? 0.9 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            className={`relative rounded-2xl transition-all ${className} ${isOver ? 'ring-2 ring-emerald-500/50 bg-emerald-500/5' : ''}`}
            style={style}
        >
            {/* Zone Title Label */}
            <div className="absolute -top-3 left-4 bg-gray-950 px-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] z-10 border border-white/5 rounded-full">
                {title}
            </div>

            {/* Content Rendering based on Layout */}
            <div className={`w-full h-full p-4 ${layout === 'spread' ? 'flex items-center gap-[-4rem]' : ''} ${layout === 'stacked' ? 'relative flex items-center justify-center' : ''}`}>

                {layout === 'stacked' && (
                    <div className="relative w-36 h-52">
                        {cards.slice(-3).map((card, index) => (
                            <div
                                key={card.instanceId}
                                className="absolute inset-0 transition-transform"
                                style={{ transform: `translate(${index * 2}px, ${index * 2}px)`, zIndex: index }}
                            >
                                <CardObject card={card} zoneId={id} />
                            </div>
                        ))}
                        {cards.length === 0 && (
                            <div className="w-full h-full border-2 border-dashed border-white/5 rounded-xl flex items-center justify-center text-[10px] font-black text-gray-800 uppercase tracking-widest">
                                Empty
                            </div>
                        )}
                    </div>
                )}

                {layout === 'spread' && (
                    <div className="flex -space-x-24 hover:-space-x-12 transition-all duration-500 py-8 px-12 overflow-x-auto no-scrollbar">
                        {cards.map(card => (
                            <div key={card.instanceId} className="shrink-0 first:ml-0 transition-transform hover:-translate-y-8 hover:z-50">
                                <CardObject card={card} zoneId={id} />
                            </div>
                        ))}
                    </div>
                )}

                {(layout === 'grid' || layout === 'free') && (
                    <div className={`w-full h-full ${layout === 'free' ? 'relative' : 'flex flex-wrap gap-12'}`}>
                        {cards.map((card, index) => {
                            if (layout === 'free' && card.position) {
                                return (
                                    <div
                                        key={card.instanceId}
                                        className="absolute transition-shadow active:z-[1000]"
                                        style={{
                                            left: card.position.x,
                                            top: card.position.y,
                                            zIndex: 10 + index
                                        }}
                                    >
                                        <CardObject card={card} zoneId={id} />
                                    </div>
                                );
                            }
                            // Fallback grid for free items without position or grid layout
                            return (
                                <div key={card.instanceId} className={layout === 'free' ? 'absolute' : ''} style={layout === 'free' ? { left: (index % 4) * 200, top: Math.floor(index / 4) * 280 } : {}}>
                                    <CardObject card={card} zoneId={id} />
                                </div>
                            );
                        })}
                    </div>
                )}

                {cards.length === 0 && layout !== 'stacked' && (
                    <div className="w-full h-full flex items-center justify-center text-gray-800 text-xs font-black uppercase tracking-[0.3em] select-none opacity-20">
                        {title} Void
                    </div>
                )}
            </div>
        </div>
    );
});

export default Zone;
