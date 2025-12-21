import React, { createContext, useContext, useState, useCallback } from 'react';

const CardModalContext = createContext();

export function useCardModal() {
    return useContext(CardModalContext);
}

export function CardModalProvider({ children }) {
    const [selectedCard, setSelectedCard] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    const openCardModal = useCallback((card) => {
        setSelectedCard(card);
        setIsOpen(true);
    }, []);

    const closeCardModal = useCallback(() => {
        setIsOpen(false);
        setTimeout(() => setSelectedCard(null), 300); // Clear after animation
    }, []);

    return (
        <CardModalContext.Provider value={{ selectedCard, isOpen, openCardModal, closeCardModal }}>
            {children}
        </CardModalContext.Provider>
    );
}
