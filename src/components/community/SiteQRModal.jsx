import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

const SiteQRModal = ({ isOpen, onClose, referralUrl, username }) => {
    if (!isOpen) return null;

    const downloadQR = () => {
        const svg = document.getElementById("qr-gen");
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.download = `MTG-Forge-Referral-${username}.png`;
            downloadLink.href = `${pngFile}`;
            downloadLink.click();
        };
        img.src = "data:image/svg+xml;base64," + btoa(svgData);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-[#1a1c23] border border-indigo-500/30 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-fade-in pointer-events-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="text-center space-y-6">
                    <div>
                        <h2 className="text-2xl font-black text-white mb-2">Share The Forge</h2>
                        <p className="text-sm text-gray-400">Scan this code to join {username}'s Pod and start brewing together.</p>
                    </div>

                    <div className="bg-white p-4 rounded-3xl inline-block shadow-inner mx-auto">
                        <QRCodeSVG
                            id="qr-gen"
                            value={referralUrl}
                            size={200}
                            level="H"
                            includeMargin={true}
                            imageSettings={{
                                src: "/logo.png",
                                x: undefined,
                                y: undefined,
                                height: 40,
                                width: 40,
                                excavate: true,
                            }}
                        />
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={downloadQR}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download QR Code
                        </button>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                            Supports iOS & Android Camera Apps
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SiteQRModal;
