import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { proxyService } from '../../services/ProxyService';
import { useToast } from '../../contexts/ToastContext';

const PrintSettingsModal = ({ isOpen, onClose, cards, deckName }) => {
    const { addToast } = useToast();
    const [paperSize, setPaperSize] = useState('letter');
    const [cutLines, setCutLines] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);

    if (!isOpen) return null;

    const handlePrint = async () => {
        setIsGenerating(true);
        setProgress(0);
        try {
            const doc = await proxyService.generatePDF(cards, { paperSize, cutLines }, (current, total) => {
                setProgress(Math.round((current / total) * 100));
            });
            doc.save(`${deckName}_Proxies.pdf`);
            addToast('PDF ready for download!', 'success');
            onClose();
        } catch (error) {
            console.error(error);
            addToast('Failed to generate PDF', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={isGenerating ? () => { } : onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl transition-all text-left align-middle">
                                {/* Header */}
                                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                                    <Dialog.Title as="h2" className="text-xl font-bold text-white flex items-center gap-2">
                                        <span className="text-2xl">🖨️</span>
                                        Print Proxies
                                    </Dialog.Title>
                                    <button onClick={onClose} disabled={isGenerating} className="text-gray-500 hover:text-white transition-colors">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                <div className="p-6 space-y-6">
                                    <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg text-sm text-blue-200">
                                        Generates a checklist or visual proxies for playtesting. <br />
                                        <strong>{cards.length} cards</strong> selected.
                                    </div>

                                    {/* Paper Size */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Paper Size</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setPaperSize('letter')}
                                                className={`p-3 rounded-lg border text-sm font-bold transition-all ${paperSize === 'letter' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'}`}
                                            >
                                                Letter (8.5 x 11)
                                            </button>
                                            <button
                                                onClick={() => setPaperSize('a4')}
                                                className={`p-3 rounded-lg border text-sm font-bold transition-all ${paperSize === 'a4' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'}`}
                                            >
                                                A4 (210 x 297mm)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Options */}
                                    <div>
                                        <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={cutLines}
                                                onChange={(e) => setCutLines(e.target.checked)}
                                                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-gray-300 font-medium">Show Cut Lines</span>
                                        </label>
                                    </div>

                                    {/* Progress Bar */}
                                    {isGenerating && (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs text-indigo-300 font-bold uppercase">
                                                <span>Generating PDF...</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <button
                                        onClick={handlePrint}
                                        disabled={isGenerating}
                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {isGenerating ? 'Processing...' : 'Download PDF'}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default PrintSettingsModal;
