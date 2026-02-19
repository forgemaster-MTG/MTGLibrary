import React, { useState } from 'react';
import { jsPDF } from 'jspdf';

const ExportDeckModal = ({ isOpen, onClose, deck, cards }) => {
    const [format, setFormat] = useState('text'); // text, csv, pdf, json
    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen) return null;

    const getFilename = (ext) => {
        return `${deck.name.replace(/[^a-z0-9]/yi, '_')}_export.${ext}`;
    };

    const downloadFile = (content, type, filename) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            switch (format) {
                case 'json':
                    exportJSON();
                    break;
                case 'csv':
                    exportCSV();
                    break;
                case 'text':
                    exportText();
                    break;
                case 'pdf':
                    exportPDF();
                    break;
                default:
                    break;
            }
            onClose();
        } catch (err) {
            console.error("Export failed", err);
            // Optionally could add error state/toast here, but we pass success usually
        } finally {
            setIsExporting(false);
        }
    };

    const exportJSON = () => {
        const data = {
            deck: {
                name: deck.name,
                commander: deck.commander,
                commander_partner: deck.commander_partner,
                format: deck.format,
                created_at: deck.created_at
            },
            cards: cards,
            exported_at: new Date().toISOString()
        };
        downloadFile(JSON.stringify(data, null, 2), "application/json", getFilename('json'));
    };

    const exportCSV = () => {
        // "output all the data about the cards"
        if (!cards || cards.length === 0) return;

        // Collect all unique keys from cards to make headers
        // But let's prioritize important ones and flatten a bit
        const headers = [
            'count', 'name', 'scryfall_id', 'set_code', 'collector_number', 'finish',
            'mana_cost', 'type_line', 'oracle_text', 'power', 'toughness', 'rarity',
            'image_uri', 'is_commander', 'is_wishlist'
        ];

        const csvRows = [headers.join(',')];

        cards.forEach(card => {
            const row = headers.map(header => {
                let val = '';
                if (header === 'count') val = card.countInDeck || card.count || 1;
                else if (header === 'is_commander') val = (card.id === deck.commander?.id || card.id === deck.commander_partner?.id) ? 'true' : 'false';
                else if (header === 'is_wishlist') val = card.is_wishlist ? 'true' : 'false';
                else if (card[header] !== undefined) val = card[header];
                else if (card.data && card.data[header] !== undefined) val = card.data[header];

                // Escape quotes and handle commas
                const stringVal = String(val === null || val === undefined ? '' : val);
                if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
                    return `"${stringVal.replace(/"/g, '""')}"`;
                }
                return stringVal;
            });
            csvRows.push(row.join(','));
        });

        downloadFile(csvRows.join('\n'), "text/csv;charset=utf-8;", getFilename('csv'));
    };

    const generateSimpleList = () => {
        // "card name, set code, collector number, print finish, and count"
        const lines = [];

        // Header
        lines.push(`Deck: ${deck.name}`);
        if (deck.commander) lines.push(`Commander: ${deck.commander.name}`);
        if (deck.commander_partner) lines.push(`Partner: ${deck.commander_partner.name}`);
        lines.push('');
        lines.push('Count | Name | Set | CN | Finish');
        lines.push('----------------------------------------');

        cards.forEach(card => {
            const count = card.countInDeck || 1;
            const name = card.name;
            const set = (card.set_code || card.data?.set || '???').toUpperCase();
            const cn = card.collector_number || card.data?.collector_number || '0';
            const finish = card.finish || 'nonfoil';

            lines.push(`${count} | ${name} | ${set} | #${cn} | ${finish}`);
        });

        return lines;
    };

    const exportText = () => {
        const lines = generateSimpleList();
        downloadFile(lines.join('\n'), "text/plain", getFilename('txt'));
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        const lines = generateSimpleList();

        // Simple text dump
        let y = 10;
        const pageHeight = doc.internal.pageSize.height;
        const lineHeight = 7;

        doc.setFontSize(16);
        doc.text(lines[0], 10, y); // Title
        y += 10;

        doc.setFontSize(10);
        doc.setFont("courier", "normal"); // Monospaced for alignment

        for (let i = 1; i < lines.length; i++) {
            if (y > pageHeight - 10) {
                doc.addPage();
                y = 10;
            }
            doc.text(lines[i], 10, y);
            y += 5;
        }

        doc.save(getFilename('pdf'));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export Deck
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Format</label>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'text', label: 'Text File (.txt)', desc: 'Simple list with count, name, set, collector number, and finish.' },
                                { id: 'csv', label: 'CSV (.csv)', desc: 'Spreadsheet compatible. Includes all card data.' },
                                { id: 'pdf', label: 'PDF Document (.pdf)', desc: 'Printable list format.' },
                                { id: 'json', label: 'JSON Data (.json)', desc: 'Full raw data backup for restoring later.' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setFormat(opt.id)}
                                    className={`flex items-start gap-4 p-3 rounded-xl border text-left transition-all ${format === opt.id
                                            ? 'bg-primary-600/20 border-primary-500 text-white'
                                            : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${format === opt.id ? 'border-primary-400' : 'border-gray-600'}`}>
                                        {format === opt.id && <div className="w-2 h-2 rounded-full bg-primary-400" />}
                                    </div>
                                    <div>
                                        <div className={`font-bold text-sm ${format === opt.id ? 'text-primary-300' : 'text-gray-300'}`}>{opt.label}</div>
                                        <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-950/50 border-t border-white/5 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary-900/40 transition-all flex items-center gap-2"
                    >
                        {isExporting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <span>Download</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportDeckModal;
