import React from 'react';
import { createPortal } from 'react-dom';

const FeaturePreviewModal = ({ isOpen, onClose, imageSrc, title }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose} />
            <div className="relative z-10 max-w-5xl w-full bg-gray-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-scale-up">

                {/* Header */}
                <div className="p-4 border-b border-white/5 bg-gray-950/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white pl-2">{title}</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-black/40 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Image Container */}
                <div className="relative bg-gray-950 aspect-[16/10] overflow-hidden group">
                    <img
                        src={imageSrc}
                        alt={title}
                        className="w-full h-full object-contain"
                    />
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FeaturePreviewModal;
