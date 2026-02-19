import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    // Default to 'multiversal' (Current Purple/Indigo theme)
    // Options: 'multiversal', 'white', 'blue', 'black', 'red', 'green'
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('mtg_forge_theme') || 'multiversal';
        }
        return 'multiversal';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        console.log(`[ThemeContext] Applying theme: theme-${theme}`);

        // Remove old theme classes
        root.classList.remove('theme-multiversal', 'theme-void', 'theme-white', 'theme-blue', 'theme-black', 'theme-red', 'theme-green');

        // Add new theme class
        root.classList.add(`theme-${theme}`);

        // Persist
        localStorage.setItem('mtg_forge_theme', theme);
    }, [theme]);

    const value = {
        theme,
        setTheme,
        themes: [
            { id: 'multiversal', label: 'Multiversal', color: 'bg-[#CBC2BF]', symbol: 'ms ms-c ms-cost' },
            { id: 'white', label: 'White', color: 'bg-[#F8E7B9]', symbol: 'ms ms-w ms-cost' },
            { id: 'blue', label: 'Blue', color: 'bg-[#B3D4E5]', symbol: 'ms ms-u ms-cost' },
            { id: 'black', label: 'Black', color: 'bg-[#A69F9D]', symbol: 'ms ms-b ms-cost' },
            { id: 'red', label: 'Red', color: 'bg-[#E49977]', symbol: 'ms ms-r ms-cost' },
            { id: 'green', label: 'Green', color: 'bg-[#9EA48F]', symbol: 'ms ms-g ms-cost' },
        ]
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};
