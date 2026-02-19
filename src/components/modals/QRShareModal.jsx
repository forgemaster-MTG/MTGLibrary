import React from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';

const QRShareModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const shareUrl = "https://mtg-forge.com/share/heir-to-the-hysteria-x26l";

    return createPortal(
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up">

                {/* Header */}
                <div className="p-6 pb-2 text-center">
                    <h3 className="text-xl font-bold text-white mb-1">Share Deck</h3>
                    <p className="text-sm text-gray-400">Scan to view deck list instantly</p>
                </div>

                {/* QR Container */}
                <div className="p-8 flex flex-col items-center justify-center space-y-6">
                    <div className="bg-white p-4 rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                        <QRCodeSVG
                            value={shareUrl}
                            size={200}
                            level="H"
                            includeMargin={false}
                        />
                    </div>

                    <div className="w-full text-center space-y-3">
                        <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 text-left">Share Link</p>
                                <p className="text-xs text-primary-300 font-mono truncate text-left select-all">{shareUrl}</p>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(shareUrl)}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title="Copy"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Anyone with this link can view the full deck list and statistics.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-gray-950/50 flex justify-center">
                    <button
                        onClick={() => window.open(shareUrl, '_blank')}
                        className="text-primary-400 hover:text-white text-sm font-bold transition-colors"
                    >
                        Open Link in New Tab &rarr;
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default QRShareModal;
