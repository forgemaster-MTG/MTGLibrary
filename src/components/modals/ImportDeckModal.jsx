import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { DeckImportService } from '../../services/DeckImportService';

const ImportDeckModal = ({ isOpen, onClose, onImport }) => {
    const [rawText, setRawText] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [activeTab, setActiveTab] = useState('paste'); // 'paste', 'url'
    const [url, setUrl] = useState('');
    const [loadingStatus, setLoadingStatus] = useState(''); // '' = not loading
    const [isWishlist, setIsWishlist] = useState(false);
    const [isThematic, setIsThematic] = useState(false);

    const handleParse = async () => {
        let result = null;

        try {
            if (activeTab === 'paste') {
                setLoadingStatus('Parsing text...');
                result = DeckImportService.parseText(rawText);
            } else {
                const source = url.includes('moxfield') ? 'Moxfield' : url.includes('archidekt') ? 'Archidekt' : 'External Source';
                setLoadingStatus(`Retrieving data from ${source}...`);
                result = await DeckImportService.parseUrl(url);
            }

            if (result.errors && result.errors.length > 0 && result.mainboard.length === 0) {
                // If total failure, just show it
                setParsedData(result);
                return;
            }

            setLoadingStatus('Resolving card artwork...');

            // Resolve images BEFORE setting parsedData to prevent pop-in
            const mainboardWithImages = await DeckImportService.resolveCards(result.mainboard);
            const sideboardWithImages = await DeckImportService.resolveCards(result.sideboard);

            setParsedData({
                ...result,
                mainboard: mainboardWithImages,
                sideboard: sideboardWithImages
            });

        } catch (e) {
            console.error(e);
        } finally {
            setLoadingStatus('');
        }
    };

    const handleConfirm = () => {
        if (parsedData) {
            onImport(parsedData, { isWishlist, isThematic });
            onClose();
        }
    };

    const reset = () => {
        setRawText('');
        setParsedData(null);
        setLoadingStatus('');
    };

    const toggleCommander = (card, listType) => {
        setParsedData(prev => {
            const newList = prev[listType].map(c => {
                if (c === card) {
                    return { ...c, isCommander: !c.isCommander };
                }
                return c;
            });
            return { ...prev, [listType]: newList };
        });
    };

    const CardTile = ({ card, listType }) => (
        <div className={`relative group aspect-[2.5/3.5] bg-gray-800 rounded-lg overflow-hidden shadow-lg border transition-all hover:scale-105 hover:z-10 cursor-pointer ${card.isCommander ? 'border-amber-500 ring-2 ring-amber-500/50' : 'border-white/5 hover:border-primary-500/50'}`}>
            {card.image_uri ? (
                <img src={card.image_uri} alt={card.name} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gray-800 border-2 border-dashed border-gray-700 hover:border-gray-500 transition-colors">
                    {/* Placeholder Icon */}
                    <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-400 font-bold line-clamp-2">{card.name}</span>
                    {card.set && <span className="text-[10px] text-gray-600 mt-1 font-mono uppercase">{card.set}</span>}
                </div>
            )}

            {/* Quantity Badge */}
            <div className="absolute top-1 right-1 bg-black/80 backdrop-blur text-white text-xs font-bold px-1.5 py-0.5 rounded border border-white/10 shadow-sm z-10">
                x{card.quantity}
            </div>

            {/* Foil Badge */}
            {card.isFoil && (
                <div className="absolute top-1 left-1 bg-gradient-to-br from-yellow-400/20 to-purple-500/20 backdrop-blur text-yellow-200 text-[10px] font-bold px-1.5 py-0.5 rounded border border-yellow-500/30 shadow-sm z-10">
                    FOIL
                </div>
            )}

            {/* Commander Badge */}
            {card.isCommander && (
                <div className="absolute bottom-1 right-1 left-1 bg-amber-600/90 backdrop-blur text-white text-[10px] font-bold px-1 py-0.5 rounded border border-amber-400/30 shadow-sm z-10 text-center uppercase tracking-wider">
                    Commander
                </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                <p className="font-bold text-white text-sm mb-1">{card.name}</p>
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleCommander(card, listType);
                        }}
                        className={`p-2 rounded-full transition-colors ${card.isCommander ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'}`}
                        title={card.isCommander ? "Unset Commander" : "Set as Commander"}
                    >
                        <svg className="w-5 h-5" fill={card.isCommander ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen">
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

                <div className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-6xl p-0 shadow-2xl mx-4 overflow-hidden flex flex-col h-[85vh]">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gray-900/95 shrink-0 z-20">
                        <div>
                            <Dialog.Title className="text-2xl font-black text-white flex items-center gap-3">
                                Import Deck
                                {parsedData && (
                                    <input
                                        type="text"
                                        value={parsedData.name || 'Untitled Deck'}
                                        onChange={(e) => setParsedData(prev => ({ ...prev, name: e.target.value }))}
                                        className="text-sm font-normal text-gray-300 bg-gray-800/50 px-3 py-1 rounded-full border border-white/5 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all placeholder-gray-500 hover:bg-gray-800 min-w-[200px]"
                                        placeholder="Deck Name"
                                    />
                                )}
                            </Dialog.Title>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        {!parsedData ? (
                            <div className="p-8 flex gap-8 h-full">
                                {/* Import Type Sidebar */}
                                <div className="w-48 flex flex-col gap-2 border-r border-white/5 pr-4 shrink-0">
                                    <button
                                        onClick={() => setActiveTab('paste')}
                                        className={`text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'paste' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        Paste Text
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('url')}
                                        className={`text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'url' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        From URL
                                    </button>
                                    <div className="mt-auto p-4 bg-gray-800/30 rounded-xl border border-white/5 text-xs text-gray-500">
                                        <p className="font-bold text-gray-400 mb-2">Supported Formats:</p>
                                        <ul className="space-y-1.5 opacity-80">
                                            <li>• Arena Exports</li>
                                            <li>• MTGO Text</li>
                                            <li>• Moxfield URLs</li>
                                            <li>• Archidekt URLs</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 flex flex-col justify-center relative h-full">
                                    {/* Loading Overlay */}
                                    {loadingStatus && (
                                        <div className="absolute inset-0 z-20 bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200 rounded-xl">
                                            <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-6"></div>
                                            <h4 className="text-xl font-bold text-white mb-2">{loadingStatus}</h4>
                                            <p className="text-gray-400 text-sm">This may take a few seconds...</p>
                                        </div>
                                    )}

                                    {activeTab === 'paste' && (
                                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                                            <textarea
                                                value={rawText}
                                                onChange={(e) => setRawText(e.target.value)}
                                                placeholder={`Paste your decklist here...\n\nExample:\n1 Sol Ring\n1 Command Tower\n1 Arcane Signet`}
                                                className="w-full flex-1 bg-gray-950 border border-white/10 rounded-xl p-5 text-gray-300 font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none shadow-inner custom-scrollbar"
                                                disabled={!!loadingStatus}
                                            />
                                            <div className="flex justify-end mt-4 shrink-0">
                                                <button
                                                    onClick={handleParse}
                                                    disabled={!rawText.trim() || !!loadingStatus}
                                                    className="bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary-500/20 transition-all hover:scale-105 active:scale-95"
                                                >
                                                    Parse Deck
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'url' && (
                                        <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in slide-in-from-right-4 duration-300">
                                            <div className="w-20 h-20 bg-gray-800/50 rounded-2xl flex items-center justify-center mb-6 border border-white/5 shadow-xl">
                                                <svg className="w-10 h-10 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                            </div>
                                            <h3 className="text-2xl font-bold text-white mb-2">Import from Website</h3>
                                            <p className="text-gray-400 mb-8 max-w-sm">Use a public URL to instantly import your deck list with full visuals.</p>

                                            <div className="w-full max-w-xl group relative">
                                                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500 to-primary-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                                <div className="relative flex gap-2 p-1 bg-gray-900 rounded-xl">
                                                    <input
                                                        type="text"
                                                        value={url}
                                                        onChange={(e) => setUrl(e.target.value)}
                                                        placeholder="https://moxfield.com/decks/..."
                                                        className="flex-1 bg-transparent border-none px-4 py-3 text-white placeholder-gray-600 focus:ring-0 outline-none"
                                                        disabled={!!loadingStatus}
                                                    />
                                                    <button
                                                        onClick={handleParse}
                                                        disabled={!url || !!loadingStatus}
                                                        className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition-all"
                                                    >
                                                        Fetch
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            // Preview State
                            <div className="flex flex-col h-full bg-gray-950/30 overflow-hidden">
                                <style>{`
                                    .custom-scrollbar::-webkit-scrollbar {
                                        width: 10px;
                                        height: 10px;
                                    }
                                    .custom-scrollbar::-webkit-scrollbar-track {
                                        background: rgba(0, 0, 0, 0.4);
                                        border-radius: 5px;
                                    }
                                    .custom-scrollbar::-webkit-scrollbar-thumb {
                                        background: rgba(255, 255, 255, 0.4);
                                        border-radius: 5px;
                                        border: 2px solid rgba(0, 0, 0, 0.2);
                                    }
                                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                        background: rgba(255, 255, 255, 0.6);
                                    }
                                `}</style>
                                <div className="flex-1 overflow-y-scroll p-6 custom-scrollbar min-h-0">
                                    <div className="space-y-8">
                                        {/* Mainboard */}
                                        <div>
                                            <h4 className="text-green-400 font-bold mb-4 flex items-center gap-2 sticky top-0 bg-gray-900/95 py-2 z-10 backdrop-blur-sm border-b border-white/5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                                                Mainboard
                                                <span className="text-gray-500 ml-2 text-sm bg-gray-800 px-2 py-0.5 rounded-full border border-white/5">
                                                    {parsedData.mainboard.length} unique / {parsedData.mainboard.reduce((a, b) => a + b.quantity, 0)} cards
                                                </span>
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                                                {parsedData.mainboard.map((card, i) => (
                                                    <CardTile key={i} card={card} listType="mainboard" />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Sideboard */}
                                        {parsedData.sideboard.length > 0 && (
                                            <div>
                                                <h4 className="text-purple-400 font-bold mb-4 flex items-center gap-2 sticky top-0 bg-gray-900/95 py-2 z-10 backdrop-blur-sm border-b border-white/5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50" />
                                                    Sideboard / Commander
                                                    <span className="text-gray-500 ml-2 text-sm bg-gray-800 px-2 py-0.5 rounded-full border border-white/5">
                                                        {parsedData.sideboard.length} unique / {parsedData.sideboard.reduce((a, b) => a + b.quantity, 0)} cards
                                                    </span>
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                                                    {parsedData.sideboard.map((card, i) => (
                                                        <CardTile key={i} card={card} listType="sideboard" />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer Padding */}
                                        <div className="h-20" />
                                    </div>
                                </div>

                                {/* Sticky Footer */}
                                <div className="p-4 border-t border-white/10 bg-gray-900/95 backdrop-blur-lg flex justify-between items-center z-30">
                                    <button onClick={reset} className="flex items-center gap-2 text-gray-400 hover:text-white font-medium text-sm transition-colors hover:bg-gray-800 px-3 py-2 rounded-lg">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                        Back to Input
                                    </button>

                                    <div className="flex items-center gap-6">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={isWishlist}
                                                    onChange={(e) => setIsWishlist(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white group-hover:text-primary-300 transition-colors">Import as Wishlist</span>
                                                <span className="text-[10px] text-gray-500">Don't add to collection</span>
                                            </div>
                                        </label>

                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={isThematic}
                                                    onChange={(e) => setIsThematic(e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">Thematic Deck</span>
                                                <span className="text-[10px] text-gray-500">Restrict to Set/Era</span>
                                            </div>
                                        </label>

                                        {parsedData.errors.length > 0 && (
                                            <div className="text-red-400 text-xs flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                {parsedData.errors.length} Warnings
                                            </div>
                                        )}
                                        <button
                                            onClick={handleConfirm}
                                            className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-500/20 hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            Confirm Import
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Dialog>
    );
};

export default ImportDeckModal;
