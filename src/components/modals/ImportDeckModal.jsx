import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { DeckImportService } from '../../services/DeckImportService';

const ImportDeckModal = ({ isOpen, onClose, onImport }) => {
    const [rawText, setRawText] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [activeTab, setActiveTab] = useState('paste'); // 'paste', 'url'
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);

    const handleParse = async () => {
        if (activeTab === 'paste') {
            const result = DeckImportService.parseText(rawText);
            setParsedData(result);
        } else {
            setLoading(true);
            try {
                const result = await DeckImportService.parseUrl(url);
                setParsedData(result);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleConfirm = () => {
        if (parsedData) {
            onImport(parsedData);
            onClose();
        }
    };

    const reset = () => {
        setRawText('');
        setParsedData(null);
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen">
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

                <div className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl p-6 shadow-2xl mx-4">
                    <div className="flex justify-between items-center mb-6">
                        <Dialog.Title className="text-2xl font-black text-white">Import Deck</Dialog.Title>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {!parsedData ? (
                        <div className="flex gap-8 min-h-[400px]">
                            {/* Import Type Sidebar */}
                            <div className="w-48 flex flex-col gap-2 border-r border-white/5 pr-4">
                                <button
                                    onClick={() => setActiveTab('paste')}
                                    className={`text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'paste' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    Paste Text
                                </button>
                                <button
                                    onClick={() => setActiveTab('url')}
                                    className={`text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'url' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    From URL
                                </button>
                                <div className="mt-auto p-3 bg-gray-800/50 rounded-lg text-xs text-gray-500">
                                    Supports:
                                    <ul className="list-disc ml-4 mt-1 space-y-1">
                                        <li>Arena Exports</li>
                                        <li>MTGO text</li>
                                        <li>Moxfield URLs</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 flex flex-col">
                                {activeTab === 'paste' && (
                                    <>
                                        <textarea
                                            value={rawText}
                                            onChange={(e) => setRawText(e.target.value)}
                                            placeholder={`Paste your decklist here...\n\nExample:\n1 Sol Ring\n1 Command Tower\n1 Arcane Signet`}
                                            className="w-full flex-1 bg-gray-950 border border-white/10 rounded-xl p-4 text-gray-300 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                        />
                                        <div className="flex justify-end mt-4">
                                            <button
                                                onClick={handleParse}
                                                disabled={!rawText.trim()}
                                                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-bold"
                                            >
                                                Parse Deck
                                            </button>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'url' && (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Import from Website</h3>
                                        <p className="text-gray-400 mb-6">Paste a URL from Moxfield, Archidekt, or TappedOut.</p>
                                        <div className="flex w-full max-w-lg gap-2">
                                            <input
                                                type="text"
                                                value={url}
                                                onChange={(e) => setUrl(e.target.value)}
                                                placeholder="https://moxfield.com/decks/..."
                                                className="flex-1 bg-gray-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <button
                                                onClick={handleParse}
                                                disabled={!url || loading}
                                                className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl font-bold disabled:opacity-50"
                                            >
                                                {loading ? '...' : 'Fetch'}
                                            </button>
                                        </div>
                                        <p className="mt-4 text-xs text-green-500/80">
                                            Supports Moxfield & Archidekt
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Preview State
                        <div className="flex flex-col h-[500px]">
                            <div className="grid grid-cols-2 gap-8 flex-1 overflow-hidden">
                                <div className="flex flex-col">
                                    <h4 className="text-green-400 font-bold mb-2 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        Mainboard ({parsedData.mainboard.reduce((a, b) => a + b.quantity, 0)})
                                    </h4>
                                    <div className="flex-1 bg-gray-950/50 rounded-xl p-4 overflow-y-auto border border-white/5 space-y-1">
                                        {parsedData.mainboard.map((card, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm group">
                                                <span className="text-gray-300">
                                                    <span className="font-bold text-white mr-2">{card.quantity}</span>
                                                    {card.name}
                                                </span>
                                                {card.set && <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 font-mono">{card.set}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col">
                                    <h4 className="text-purple-400 font-bold mb-2 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                                        Sideboard / Commander ({parsedData.sideboard.reduce((a, b) => a + b.quantity, 0)})
                                    </h4>
                                    <div className="flex-1 bg-gray-950/50 rounded-xl p-4 overflow-y-auto border border-white/5 space-y-1">
                                        {parsedData.sideboard.length > 0 ? parsedData.sideboard.map((card, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <span className="text-gray-300">
                                                    <span className="font-bold text-white mr-2">{card.quantity}</span>
                                                    {card.name}
                                                </span>
                                                {card.set && <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 font-mono">{card.set}</span>}
                                            </div>
                                        )) : (
                                            <div className="h-full flex items-center justify-center text-gray-600 italic">No Sideboard</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Errors */}
                            {parsedData.errors.length > 0 && (
                                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                    <h5 className="text-red-400 text-xs font-bold uppercase mb-1">Parse Warnings</h5>
                                    <ul className="text-xs text-red-300/80 list-disc ml-4">
                                        {parsedData.errors.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </div>
                            )}

                            <div className="mt-6 flex justify-between items-center pt-4 border-t border-white/5">
                                <button onClick={reset} className="text-gray-400 hover:text-white font-medium text-sm">
                                    ← Back to Paste
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="bg-green-600 hover:bg-green-500 text-white px-8 py-2 rounded-xl font-bold shadow-lg shadow-green-500/20"
                                >
                                    Confirm Import
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Dialog>
    );
};

export default ImportDeckModal;
