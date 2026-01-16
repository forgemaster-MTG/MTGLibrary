import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import WIDGETS from './WidgetRegistry';

const LibraryItem = ({ id }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: id,
        data: { fromLibrary: true } // Mark as from library
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    const widget = WIDGETS[id];

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg border border-gray-700 cursor-grab hover:bg-gray-700 active:cursor-grabbing shadow-sm"
        >
            <div className="w-6 h-6 bg-indigo-500/20 rounded flex items-center justify-center text-xs text-indigo-400 font-bold">
                +
            </div>
            <span className="text-xs font-bold text-gray-300">{widget.title}</span>
        </div>
    );
};

const WidgetLibrary = ({ layout }) => {
    const activeWidgets = new Set([
        ...(layout.top || []),
        ...(layout.main || []),
        ...(layout.sidebar || [])
    ]);

    const availableWidgets = Object.keys(WIDGETS).filter(id => !activeWidgets.has(id));

    if (availableWidgets.length === 0) return null;

    return (
        <div className="mb-6 p-4 bg-gray-900/80 border border-indigo-500/30 rounded-2xl backdrop-blur-md animate-slide-down">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Widget Library
            </h3>
            <div className="flex flex-wrap gap-3">
                {availableWidgets.map(id => (
                    <LibraryItem key={id} id={id} />
                ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
                Drag items from here to your dashboard zones.
            </p>
        </div>
    );
};

export default WidgetLibrary;
