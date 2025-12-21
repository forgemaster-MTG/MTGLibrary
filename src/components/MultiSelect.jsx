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
                <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 flex flex-col">
                    <div className="p-2 border-b border-gray-700">
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="text-gray-500 text-xs p-2 text-center">No results</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={() => toggleOption(opt.value)}
                                    className={`
                                        flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm
                                        ${selected.includes(opt.value) ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}
                                    `}
                                >
                                    <div className={`w-3 h-3 rounded-sm border ${selected.includes(opt.value) ? 'bg-white border-white' : 'border-gray-500'}`}>
                                        {selected.includes(opt.value) && (
                                            <svg className="w-full h-full text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
