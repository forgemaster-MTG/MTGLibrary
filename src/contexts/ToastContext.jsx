import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext();

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto remove only if duration is positive
        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {/* Toast Container - Portaled to body with high z-index */}
            {createPortal(
                <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                    {toasts.map(toast => (
                        <div
                            key={toast.id}
                            className={`
                                px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all transform animate-fade-in-up pointer-events-auto cursor-pointer
                                ${toast.type === 'success' ? 'bg-green-600 text-white' : ''}
                                ${toast.type === 'error' ? 'bg-red-600 text-white' : ''}
                                ${toast.type === 'info' ? 'bg-gray-800 text-white border border-gray-700' : ''}
                                ${toast.type === 'warning' ? 'bg-yellow-500 text-black' : ''}
                            `}
                            onClick={() => removeToast(toast.id)}
                        >
                            {toast.message}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}
