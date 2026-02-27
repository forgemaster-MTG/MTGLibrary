import React, { createContext, useState, useContext, useEffect } from 'react';

const OmniContext = createContext();

export function OmniProvider({ children }) {
    // Setup standard state with MTG as default
    const [activeGame, setActiveGame] = useState(() => {
        // Try to get from localStorage first so user preference persists
        const saved = localStorage.getItem('forgemaster_active_game');
        return saved || 'mtg';
    });

    // Whenever the active game changes, persist it
    useEffect(() => {
        localStorage.setItem('forgemaster_active_game', activeGame);
        // You could also dispatch a custom event here if you need non-React
        // code to know about the switch.
    }, [activeGame]);

    return (
        <OmniContext.Provider value={{ activeGame, setActiveGame }}>
            {children}
        </OmniContext.Provider>
    );
}

// Custom hook to easily use the context
export function useOmni() {
    const context = useContext(OmniContext);
    if (!context) {
        throw new Error('useOmni must be used within an OmniProvider');
    }
    return context;
}
