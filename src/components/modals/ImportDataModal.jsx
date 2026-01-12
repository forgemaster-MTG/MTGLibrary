import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collectionService } from '../../services/collectionService';
import { deckService } from '../../services/deckService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const ImportDataModal = ({ isOpen, onClose, mode = 'global' }) => { // mode: 'global' | 'deck'
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const fileInputRef = useRef(null);

    const [fileData, setFileData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Options
    const [importType, setImportType] = useState('cards'); // 'cards' | 'deck'
    // Global options
    const [replaceMode, setReplaceMode] = useState('merge'); // 'merge' | 'replace'
    // Deck options
    const [deckOptions, setDeckOptions] = useState({
        checkCollection: true,
        addToCollection: true
    });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                // Auto-detect type if possible
                // Auto-detect type if possible
                if (json.deck && json.cards) {
                    setImportType('deck');
                    setFileData(json);
                } else if (json.cards && json.decks) {
                    // Full Library Backup
                    setImportType('cards');
                    setFileData(json);
                } else if (json.collection && typeof json.collection === 'object' && !Array.isArray(json.collection)) {
                    // Legacy Firestore Backup (Object-based)
                    const cardsArray = Object.values(json.collection);
                    setImportType('cards');
                    setFileData({ cards: cardsArray });
                } else if (Array.isArray(json)) {
                    setImportType('cards');
                    setFileData({ cards: json });
                } else if (json.cards && Array.isArray(json.cards)) {
                    setImportType('cards');
                    setFileData(json);
                } else if (typeof json === 'object') {
                    // Fallback: Check if there are keys that contain arrays
                    const possibleCards = Object.values(json).find(val => Array.isArray(val) && val.length > 0 && (val[0].name || val[0].id));
                    if (possibleCards) {
                        setImportType('cards');
                        setFileData({ cards: possibleCards });
                    } else {
                        console.error('Invalid JSON structure', json);
                        addToast('Invalid JSON: Could not find card data', 'error');
                    }
                } else {
                    addToast('Invalid JSON format', 'error');
                }
            } catch (err) {
                console.error(err);
                addToast('Failed to parse JSON', 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!fileData) return;
        setLoading(true);
        try {
            if (importType === 'cards') {
                await collectionService.importBatch(currentUser.uid, fileData.cards, replaceMode, fileData.decks);
                addToast(`Successfully imported ${fileData.cards.length} cards${fileData.decks?.length ? ` and ${fileData.decks.length} decks` : ''}`, 'success');
                onClose();
            } else if (importType === 'deck') {
                const result = await deckService.importDeck(currentUser.uid, fileData.deck, fileData.cards, deckOptions);
                if (result.missingCards?.length > 0) {
                    addToast(`Imported deck with ${result.missingCards.length} missing cards`, 'warning');
                } else {
                    addToast('Deck imported successfully', 'success');
                }
                onClose();
            }
        } catch (err) {
            console.error(err);
            addToast('Import failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Import Data
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* File Upload Area */}
                    {!fileData ? (
                        <div
                            className="border-2 border-dashed border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-gray-700/30 transition-all group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <svg className="w-12 h-12 text-gray-500 group-hover:text-indigo-400 mb-4 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            <p className="text-gray-300 font-medium">Click to select backup JSON</p>
                            <p className="text-gray-500 text-sm mt-1">Supports Collection exports and Deck exports</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".json"
                                className="hidden"
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Detected Content</span>
                                    <p className="text-white font-bold text-lg">
                                        {importType === 'cards' ? (
                                            <>
                                                Collection ({fileData.cards?.length || 0} cards)
                                                {fileData.decks?.length > 0 && ` + ${fileData.decks.length} Decks`}
                                            </>
                                        ) : `Deck: ${fileData.deck?.name} (${fileData.cards?.length || 0} cards)`}
                                    </p>
                                </div>
                                <button onClick={() => setFileData(null)} className="text-sm text-red-400 hover:text-red-300 underline">Change File</button>
                            </div>

                            {/* Configuration Options */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 pb-2">Import Options</h3>

                                {importType === 'cards' && (
                                    <div className="space-y-3">
                                        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-colors">
                                            <input
                                                type="radio"
                                                name="replaceMode"
                                                checked={replaceMode === 'merge'}
                                                onChange={() => setReplaceMode('merge')}
                                                className="mt-1 bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <div>
                                                <span className="block text-white font-medium">Merge (Recommended)</span>
                                                <span className="block text-gray-400 text-sm">Add records to your existing collection. Updates if exists.</span>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-3 p-3 rounded-lg border border-red-900/30 hover:bg-red-900/10 cursor-pointer transition-colors">
                                            <input
                                                type="radio"
                                                name="replaceMode"
                                                checked={replaceMode === 'replace'}
                                                onChange={() => setReplaceMode('replace')}
                                                className="mt-1 bg-gray-900 border-gray-600 text-red-600 focus:ring-red-500"
                                            />
                                            <div>
                                                <span className="block text-white font-medium">Replace (Use with Caution)</span>
                                                <span className="block text-red-300 text-sm">
                                                    Delete your ENTIRE current collection.
                                                    {fileData.decks?.length > 0
                                                        ? " Existing decks will also be replaced by those in the backup."
                                                        : " Your decks will be preserved since this backup only contains cards."
                                                    }
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {importType === 'deck' && (
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={deckOptions.checkCollection}
                                                onChange={(e) => setDeckOptions(prev => ({ ...prev, checkCollection: e.target.checked }))}
                                                className="rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-gray-300">Use existing unassigned copies from collection</span>
                                        </label>
                                        <label className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={deckOptions.addToCollection}
                                                onChange={(e) => setDeckOptions(prev => ({ ...prev, addToCollection: e.target.checked }))}
                                                className="rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-gray-300">Add missing cards to collection automatically</span>
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-700 bg-gray-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!fileData || loading}
                        className={`px-6 py-2 rounded-lg font-bold text-white transition-all shadow-lg ${loading
                            ? 'bg-indigo-800 cursor-wait'
                            : replaceMode === 'replace' && importType === 'cards'
                                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                            }`}
                    >
                        {loading ? 'Importing...' : 'Start Import'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImportDataModal;
