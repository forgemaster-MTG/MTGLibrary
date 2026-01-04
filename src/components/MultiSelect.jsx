import React, { useState, useRef, useEffect } from 'react';

const MultiSelect = ({
    options = [],
    selected = [],
    onChange,
    placeholder = "Select...",
    label
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const toggleOption = (value) => {
        const newSelected = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-left text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent flex justify-between items-center"
            >
                <span className="truncate">
                    {selected.length === 0
                        ? placeholder
                        : `${selected.length} selected`}
                </span>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-h-68 flex flex-col overflow-hidden animate-fade-in-down">
                    <div className="p-3 border-b border-white/5">
                        <input
                            type="text"
                            placeholder="Filter options..."
                            className="w-full bg-gray-950/50 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-600"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest p-4 text-center">No results found</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={() => toggleOption(opt.value)}
                                    className={`
                                        flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-xs font-medium transition-all
                                        ${selected.includes(opt.value) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                                    `}
                                >
                                    <div className={`w-4 h-4 rounded-md border transition-all flex items-center justify-center ${selected.includes(opt.value) ? 'bg-white border-white scale-110' : 'border-gray-700 bg-gray-950/50'}`}>
                                        {selected.includes(opt.value) && (
                                            <svg className="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="truncate">{opt.label}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
