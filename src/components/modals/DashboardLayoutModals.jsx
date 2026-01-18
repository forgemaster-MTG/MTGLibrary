import React, { useState, useEffect } from 'react';

export const LayoutImportModal = ({ isOpen, onClose, onImport }) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setName('');
            setCode('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!name.trim()) return setError('Please enter a layout name');
        if (!code.trim()) return setError('Please paste the layout code');

        try {
            // Basic validation that it's base64 json
            if (!code.startsWith('ey')) throw new Error();
            onImport(name, code);
            onClose();
        } catch (e) {
            setError('Invalid layout code format');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Import Layout</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Layout Name</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="My Awesome Layout"
                            className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Layout Code</label>
                        <textarea
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder="Paste the base64 code here..."
                            className="w-full h-32 bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-xs placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                        />
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors">Cancel</button>
                        <button onClick={handleSubmit} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20">Import</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const LayoutShareModal = ({ isOpen, onClose, layoutCode, layoutName }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(layoutCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white">Share Layout</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>

                <div className="space-y-4">
                    <p className="text-sm text-gray-300">Copy the code below to share <strong>"{layoutName}"</strong> with others.</p>

                    <div className="relative">
                        <textarea
                            readOnly
                            value={layoutCode}
                            className="w-full h-32 bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-indigo-300 font-mono text-xs focus:border-indigo-500 outline-none resize-none"
                            onClick={(e) => e.target.select()}
                        />
                    </div>

                    <button
                        onClick={handleCopy}
                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${copied ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                    >
                        {copied ? (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                Copy Code
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const LayoutSaveModal = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) { setName(''); setError(''); }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Save Layout</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Layout Name</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Commander Focus"
                            className="w-full bg-black/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            autoFocus
                            onKeyDown={e => {
                                if (e.key === 'Enter' && name.trim()) {
                                    onSave(name);
                                    onClose();
                                }
                            }}
                        />
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors">Cancel</button>
                        <button
                            onClick={() => {
                                if (!name.trim()) return setError('Please enter a name');
                                onSave(name);
                                onClose();
                            }}
                            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
