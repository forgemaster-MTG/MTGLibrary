import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

const CardAutocomplete = ({ value, onChange, onSelect, placeholder = "Find card in sets..." }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    // Handle clicks outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Debounced autocomplete fetch
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (value.length < 2) {
                setSuggestions([]);
                return;
            }

            setLoading(true);
            try {
                const response = await api.get('/api/cards/autocomplete', { q: value });
                setSuggestions(response.data || []);
                setShowSuggestions(true);
            } catch (err) {
                console.error("Autocomplete failed", err);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timer);
    }, [value]);

    const handleSuggestionClick = (name) => {
        onChange(name);
        setShowSuggestions(false);
        if (onSelect) onSelect(name);
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {loading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-400"></div>
                ) : (
                    <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                )}
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-indigo-500/20 rounded-xl text-gray-300 placeholder-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-sm"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => value.length >= 2 && setShowSuggestions(true)}
            />

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                    {suggestions.map((name, index) => (
                        <button
                            key={index}
                            onClick={() => handleSuggestionClick(name)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-indigo-600 hover:text-white transition-colors border-b border-white/5 last:border-0"
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CardAutocomplete;
