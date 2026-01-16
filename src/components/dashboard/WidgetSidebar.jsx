import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Disclosure, Transition } from '@headlessui/react';
import WIDGETS from './WidgetRegistry';

const SidebarItem = ({ id, onAdd }) => {
    const widget = WIDGETS[id];

    return (
        <Disclosure as="div" className="mb-2">
            {({ open }) => (
                <div className="group">
                    {/* Widget Header with Add Button */}
                    <div className="relative flex items-center justify-between p-3 rounded-xl border border-white/5 bg-gray-900/60 hover:bg-gray-800/80 shadow-sm transition-all">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <span className="text-[11px] font-black text-gray-200 uppercase tracking-widest truncate">{widget.title}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Add Button */}
                            <button
                                onClick={() => onAdd(id)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95"
                            >
                                Add
                            </button>

                            {/* Disclosure Toggle */}
                            <Disclosure.Button className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all">
                                <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </Disclosure.Button>
                        </div>
                    </div>

                    {/* Disclosure Content (Descriptions) */}
                    <Transition
                        show={open}
                        enter="transition-all duration-300 ease-out"
                        enterFrom="opacity-0 max-h-0"
                        enterTo="opacity-100 max-h-[500px]"
                        leave="transition-all duration-200 ease-in"
                        leaveFrom="opacity-100 max-h-[500px]"
                        leaveTo="opacity-0 max-h-0"
                    >
                        <Disclosure.Panel className="px-4 py-3 mt-1 bg-gray-950/40 rounded-xl border border-white/5 text-[10px] space-y-3">
                            <p className="text-gray-400 font-medium italic leading-relaxed">
                                {widget.description}
                            </p>

                            <div className="space-y-2">
                                <div className="text-[9px] font-black text-indigo-400/80 uppercase tracking-tighter">Size Specifics</div>
                                {Object.entries(widget.sizes || {}).map(([size, desc]) => (
                                    <div key={size} className="flex gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                        <span className="text-gray-300 font-black uppercase w-10 shrink-0 tracking-tighter">{size}</span>
                                        <span className="text-gray-500 leading-tight">{desc}</span>
                                    </div>
                                ))}
                            </div>
                        </Disclosure.Panel>
                    </Transition>
                </div>
            )}
        </Disclosure>
    );
};

const WidgetSidebar = ({ layout, isOpen, onClose, onAddWidget }) => {
    const activeWidgets = new Set(layout.grid || []);

    const availableWidgets = Object.keys(WIDGETS).filter(id => !activeWidgets.has(id));

    return (
        <Transition
            show={isOpen}
            enter="transition-transform duration-500 ease-out"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transition-transform duration-300 ease-in"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
            className="fixed top-0 right-0 h-full w-80 z-[100] border-l border-white/10 shadow-2xl"
        >
            <div className="h-full bg-gray-950/80 backdrop-blur-2xl flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Forge Library</h2>
                        <p className="text-[10px] text-gray-500 font-bold mt-1">CLICK ADD TO USE WIDGETS</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {availableWidgets.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-8">
                            <svg className="w-12 h-12 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Library Empty</p>
                            <p className="text-[10px] text-gray-600 mt-2 italic">All available widgets are currently on your dashboard.</p>
                        </div>
                    ) : (
                        availableWidgets.map(id => (
                            <SidebarItem key={id} id={id} onAdd={onAddWidget} />
                        ))
                    )}
                </div>

                {/* Footer Help */}
                <div className="p-6 bg-indigo-600/5 mt-auto border-t border-white/5">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-indigo-200">Pro Tip</p>
                            <p className="text-[10px] text-indigo-400/70 leading-relaxed mt-1">Widgets snap to the 12-column grid. Try placing smaller ones next to larger ones to auto-stack.</p>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    );
};

export default WidgetSidebar;
