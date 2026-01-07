import React from 'react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDanger = false, children }) => {
    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div
                className="relative bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md transform transition-all scale-100 animate-scale-in m-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2" id="modal-title">
                        {title}
                    </h3>
                    <p className="text-gray-300 mb-6">
                        {message}
                    </p>
                    {children}

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors font-medium"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`px-4 py-2 rounded-lg text-white font-bold shadow-lg transition-transform transform hover:-translate-y-0.5 ${isDanger
                                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
