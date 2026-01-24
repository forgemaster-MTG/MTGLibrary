import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext();

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3000, action = null) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, action }]);

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
                <div className="fixed top-24 left-0 right-0 md:top-auto md:bottom-4 md:left-auto md:right-4 z-[99999] flex flex-col gap-2 pointer-events-none items-center md:items-end px-0 md:px-4">
                    {toasts.map(toast => (
                        <div
                            key={toast.id}
                            className={`
                                shadow-2xl text-sm font-black transition-all transform animate-fade-in-down pointer-events-auto cursor-pointer
                                w-full h-auto min-h-[50px] text-center backdrop-blur-xl border-y border-white/10 flex items-center justify-center px-6 py-4
                                ${toast.type === 'success' ? 'bg-green-600/90 text-white' : ''}
                                ${toast.type === 'error' ? 'bg-red-600/90 text-white' : ''}
                                ${toast.type === 'info' ? 'bg-indigo-600/90 text-white shadow-indigo-500/30' : ''}
                                ${toast.type === 'warning' ? 'bg-yellow-500 text-black' : ''}
                                md:w-auto md:rounded-xl md:border md:text-left md:px-4 md:py-3 md:animate-fade-in-up md:min-h-0
                            `}
                            onClick={() => removeToast(toast.id)}
                        >
                            {toast.message}
                            {toast.action && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toast.action.onClick?.();
                                        removeToast(toast.id);
                                    }}
                                    className="ml-3 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-bold uppercase tracking-wider transition-colors border border-white/10"
                                >
                                    {toast.action.label || 'Action'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}
