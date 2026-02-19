import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useCollection } from '../../hooks/useCollection';

const BulkCollectionImportModal = ({ isOpen, onClose }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const { addToCollection, refreshCollection } = useCollection();

    // State
    const [rawText, setRawText] = useState('');
    const [parsedCards, setParsedCards] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [step, setStep] = useState('input'); // input | preview | success
    const [bulkTags, setBulkTags] = useState([]);
    const [currentTag, setCurrentTag] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResults, setImportResults] = useState([]);

    const fileInputRef = useRef(null);

    // --- Parsing Logic ---

    // Unified Parsing Logic
    const parseLine = (line) => {
        const clean = line.trim();
        if (!clean) return null;

        // Split by comma or tab
        const parts = clean.split(/[,\t]/).map(p => p.trim());
        if (parts.length < 1) return null;

        const name = parts[0];
        const set = parts[1] || null;
        const cn = parts[2] || null;
        const tag = parts[3] || null;

        return {
            count: 1,
            name,
            set,
            collector_number: cn,
            tag,
            mode: 'unified'
        };
    };

    const handleParse = async () => {
        if (!rawText.trim()) return;
        setIsProcessing(true);

        try {
            const lines = rawText.split('\n');
            const parsed = lines.map(parseLine).filter(Boolean);

            // Resolution Logic
            // We need to fetch Scryfall data. 
            // If Set & CN are provided -> precise fetch.
            // If only Name -> search.

            // Queue up checks
            const checked = await Promise.all(parsed.map(async (p) => {
                try {
                    let url = '';
                    if (p.set && p.collector_number) {
                        url = `https://api.scryfall.com/cards/${p.set.toLowerCase()}/${p.collector_number}`;
                    } else {
                        // Fuzzy search name if set is likely just a code or name
                        let query = p.name;
                        if (p.set) query += ` set:${p.set}`;
                        url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}`;
                    }

                    const resp = await fetch(url);
                    if (resp.ok) {
                        const data = await resp.json();
                        return {
                            ...p,
                            valid: true,
                            scryfallId: data.id,
                            data: data,
                            image: data.image_uris?.small || data.card_faces?.[0]?.image_uris?.small
                        };
                    } else {
                        // Fallback: if Set/CN failed, try just name
                        if (p.set && p.collector_number) {
                            const resp2 = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(p.name)}`);
                            if (resp2.ok) {
                                const data2 = await resp2.json();
                                return {
                                    ...p,
                                    valid: true,
                                    scryfallId: data2.id,
                                    data: data2,
                                    image: data2.image_uris?.small || data2.card_faces?.[0]?.image_uris?.small,
                                    warning: 'Exact match failed, found by name.'
                                };
                            }
                        }
                        return { ...p, valid: false };
                    }
                } catch (e) {
                    return { ...p, valid: false };
                }
            }));

            setParsedCards(checked);
            setStep('preview');
        } catch (err) {
            addToast('Failed to parse cards', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- File Handling ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            setRawText(evt.target.result);
        };
        reader.readAsText(file);
    };

    // --- Import Execution ---
    const handleBulkImport = async () => {
        setImporting(true);
        const validItems = parsedCards.filter(c => c.valid);

        try {
            const payload = validItems.map(item => {
                // Combine bulkTags with item-specific tag
                const itemTags = [...bulkTags];
                if (item.tag && !itemTags.includes(item.tag)) {
                    itemTags.push(item.tag);
                }

                return {
                    name: item.data.name,
                    scryfall_id: item.scryfallId,
                    set_code: item.data.set,
                    collector_number: item.data.collector_number,
                    image_uri: item.data.image_uris?.normal || item.data.card_faces?.[0]?.image_uris?.normal,
                    count: item.count,
                    data: item.data,
                    tags: JSON.stringify(itemTags)
                };
            });

            const token = await currentUser.getIdToken();
            const response = await fetch('http://localhost:3000/api/collection/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cards: payload, mode: 'merge' })
            });

            if (!response.ok) throw new Error('Import failed');

            setImportResults(payload);
            setStep('success');
            refreshCollection(); // Trigger background refresh
            addToast(`Successfully imported ${validItems.length} cards!`, 'success');

        } catch (err) {
            console.error(err);
            addToast('Import failed. Check console.', 'error');
        } finally {
            setImporting(false);
        }
    };

    // --- Tag Logic ---
    const addTag = (e) => {
        if (e.key === 'Enter' && currentTag.trim()) {
            if (!bulkTags.includes(currentTag.trim())) {
                setBulkTags([...bulkTags, currentTag.trim()]);
            }
            setCurrentTag('');
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/10">

                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white">
                            {step === 'success' ? 'Import Complete' : 'Bulk Import'}
                        </h2>
                        <p className="text-gray-400">
                            {step === 'success' ? `Successfully added ${importResults.length} cards to your collection.` : 'Import cards from CSV or text list.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {step === 'input' && (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl text-blue-200 text-sm">
                                <p className="font-bold mb-2">Supported Formats:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="font-bold text-xs uppercase text-blue-400 mb-1">CSV (Recommended)</div>
                                        <code className="block bg-black/30 p-2 rounded text-xs opacity-80">
                                            Name, Set, CN, Tag<br />
                                            Sol Ring, CMD, 45, Mana Rock<br />
                                            Black Lotus, LEA, 1, Power 9
                                        </code>
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs uppercase text-blue-400 mb-1">Text List</div>
                                        <code className="block bg-black/30 p-2 rounded text-xs opacity-80">
                                            Name, Set, CN, Tag<br />
                                            Sol Ring, CMD, 45, Mana Rock<br />
                                            Command Tower, CMD, , Base
                                        </code>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => fileInputRef.current.click()}
                                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm font-bold text-white flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    Upload CSV / Text File
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".csv,.txt"
                                    className="hidden"
                                />
                            </div>

                            <textarea
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                placeholder="Paste your list here..."
                                className="w-full h-80 bg-gray-800/50 border border-gray-700 text-gray-200 p-4 rounded-xl font-mono focus:ring-2 focus:ring-primary-500 outline-none resize-none text-sm"
                            />
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6">
                            {/* Tag Input */}
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Apply Tags to Batch</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {bulkTags.map(tag => (
                                        <span key={tag} className="bg-primary-600 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                                            {tag}
                                            <button onClick={() => setBulkTags(bulkTags.filter(t => t !== tag))} className="hover:text-red-300">×</button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        placeholder="Type tag & Enter..."
                                        value={currentTag}
                                        onChange={(e) => setCurrentTag(e.target.value)}
                                        onKeyDown={addTag}
                                        className="bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 text-sm min-w-[120px]"
                                    />
                                </div>
                            </div>

                            {/* Preview List */}
                            <div className="bg-black/20 rounded-xl overflow-hidden border border-gray-800">
                                <table className="w-full text-left text-sm text-gray-400">
                                    <thead className="bg-gray-800/50 text-gray-500 font-bold">
                                        <tr>
                                            <th className="p-3">Card</th>
                                            <th className="p-3">Set</th>
                                            <th className="p-3 text-center">Qty</th>
                                            <th className="p-3">Matched Tag</th>
                                            <th className="p-3 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {parsedCards.map((p, i) => (
                                            <tr key={i} className={p.valid ? '' : 'bg-red-900/10'}>
                                                <td className="p-3 flex items-center gap-3">
                                                    {p.image ? (
                                                        <img src={p.image} className="w-8 h-8 rounded object-cover" alt="" />
                                                    ) : (
                                                        <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-xs">?</div>
                                                    )}
                                                    <div>
                                                        <div className={p.valid ? 'text-white font-bold' : 'text-red-400 line-through'}>{p.name}</div>
                                                        {p.warning && <div className="text-[10px] text-yellow-500">{p.warning}</div>}
                                                    </div>
                                                </td>
                                                <td className="p-3">{p.data?.set_name || p.set || '-'}</td>
                                                <td className="p-3 text-center font-mono">{p.count}</td>
                                                <td className="p-3">
                                                    {p.tag && <span className="text-xs bg-gray-700 px-1 rounded text-gray-300">{p.tag}</span>}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {p.valid ? (
                                                        <span className="text-green-400">Ready</span>
                                                    ) : (
                                                        <span className="text-red-500">Not Found</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="animate-fade-in">
                            <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl text-center mb-6">
                                <div className="text-5xl mb-2">🎉</div>
                                <h3 className="text-xl font-bold text-white mb-1">Import Successful!</h3>
                                <p className="text-green-200 text-sm">Your new cards have been added to the collection.</p>
                            </div>

                            <div className="bg-black/20 rounded-xl overflow-hidden border border-gray-800 max-h-[50vh] overflow-y-auto">
                                <table className="w-full text-left text-sm text-gray-400">
                                    <thead className="bg-gray-800/50 text-gray-500 font-bold sticky top-0 bg-gray-900 z-10">
                                        <tr>
                                            <th className="p-3">Card</th>
                                            <th className="p-3">Set</th>
                                            <th className="p-3 text-center">Qty</th>
                                            <th className="p-3">Applied Tags</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {importResults.map((item, i) => (
                                            <tr key={i}>
                                                <td className="p-3 flex items-center gap-3">
                                                    <img src={item.image_uri} className="w-8 h-8 rounded object-cover" alt="" />
                                                    <span className="text-white font-bold">{item.name}</span>
                                                </td>
                                                <td className="p-3">{item.set_code?.toUpperCase()}</td>
                                                <td className="p-3 text-center font-mono">{item.count}</td>
                                                <td className="p-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {JSON.parse(item.tags).map(t => (
                                                            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-primary-500/20 text-primary-300 border border-primary-500/30">
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-800 flex justify-between bg-gray-900/50 rounded-b-2xl">
                    {step === 'input' ? (
                        <>
                            <button onClick={onClose} className="px-6 py-3 font-bold text-gray-400 hover:text-white">Cancel</button>
                            <button
                                onClick={handleParse}
                                disabled={isProcessing || !rawText.trim()}
                                className="bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Review Cards
                                    </>
                                ) : (
                                    'Review Cards'
                                )}
                            </button>
                        </>
                    ) : step === 'preview' ? (
                        <>
                            <button onClick={() => setStep('input')} className="px-6 py-3 font-bold text-gray-400 hover:text-white">Back to Edit</button>
                            <button
                                onClick={handleBulkImport}
                                disabled={importing || parsedCards.filter(c => c.valid).length === 0}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
                            >
                                {importing ? 'Importing...' : `Import ${parsedCards.filter(c => c.valid).length} Cards`}
                            </button>
                        </>
                    ) : (
                        /* Success Step */
                        <>
                            <div />
                            <button
                                onClick={onClose}
                                className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg"
                            >
                                Done
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>,
        document.body
    );
};

export default BulkCollectionImportModal;
