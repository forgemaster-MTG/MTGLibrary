import React from 'react';
import { AlertCircle } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', isDangerous = false }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className={`bg-gray-900 border ${isDangerous ? 'border-red-500/50' : 'border-blue-500/50'} rounded-2xl max-w-sm w-full p-6 shadow-2xl transform transition-all scale-100`}>
                <div className="flex flex-col items-center text-center mb-6">
                    <div className={`w-12 h-12 rounded-full ${isDangerous ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-400'} flex items-center justify-center mb-4`}>
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-2 font-bold rounded-lg transition-colors ${isDangerous
                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
