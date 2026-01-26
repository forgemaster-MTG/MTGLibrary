import React, { useState } from 'react';
import { api } from '../../services/api';
import ImportDataModal from '../../components/modals/ImportDataModal';
import DeleteConfirmationModal from '../../components/modals/DeleteConfirmationModal';

const DataSettings = () => {
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const handleExportCollection = async () => {
        try {
            const result = await api.get('/api/collection/export');
            let cards = [];
            let decks = [];

            if (Array.isArray(result)) {
                cards = result;
            } else if (result && typeof result === 'object') {
                cards = result.cards || [];
                decks = result.decks || [];
            }

            if (cards.length === 0 && decks.length === 0) {
                alert('No data to export.');
                return;
            }

            const dataStr = JSON.stringify({ cards, decks, exported_at: new Date() }, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `mtg_library_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export library.');
        }
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-6">
                Data Management
            </h1>

            <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg space-y-6">
                <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
                    <h3 className="text-yellow-500 font-bold mb-1 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        Important Note
                    </h3>
                    <p className="text-yellow-200/80 text-sm">
                        Backups include your collection data. Deck exports can also be done from individual deck pages.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="border border-gray-700 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-700/30 transition-colors">
                        <div>
                            <h3 className="text-white font-medium">Export Collection</h3>
                            <p className="text-gray-400 text-sm">Download a JSON backup of your entire card collection.</p>
                        </div>
                        <button
                            onClick={handleExportCollection}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            Export JSON
                        </button>
                    </div>

                    <div className="border border-gray-700 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-700/30 transition-colors">
                        <div>
                            <h3 className="text-white font-medium">Import Data</h3>
                            <p className="text-gray-400 text-sm">Restore from a backup or import cards. Supports Merge and Replace.</p>
                        </div>
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-gray-600"
                        >
                            Import...
                        </button>
                    </div>
                </div>

                {/* Collapsible Danger Zone */}
                <div className="pt-6 border-t border-gray-700">
                    <details className="group border border-red-500/20 rounded-xl bg-red-500/5 open:bg-red-500/10 transition-colors">
                        <summary className="flex items-center justify-between p-4 cursor-pointer select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-red-500">⚠️</span>
                                <h3 className="text-lg font-bold text-red-500 uppercase tracking-wide">Danger Zone</h3>
                            </div>
                            <div className="text-red-500 transform transition-transform group-open:rotate-180">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </summary>

                        <div className="p-4 pt-0 border-t border-red-500/10 mt-2 space-y-4">
                            <div className="p-4 border-b border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-bold text-white">Clear Wishlist</h4>
                                    <p className="text-sm text-gray-400">Permanently delete all items from your wishlist.</p>
                                </div>
                                <button
                                    onClick={() => { setDeleteTarget('wishlist'); setDeleteModalOpen(true); }}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-bold transition-colors"
                                >
                                    Clear Wishlist
                                </button>
                            </div>

                            <div className="p-4 border-b border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-bold text-white">Delete All Decks</h4>
                                    <p className="text-sm text-gray-400">Delete all your decks. Cards will remain in your collection.</p>
                                </div>
                                <button
                                    onClick={() => { setDeleteTarget('decks'); setDeleteModalOpen(true); }}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-bold transition-colors"
                                >
                                    Delete Decks
                                </button>
                            </div>

                            <div className="p-4 border-b border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-bold text-white">Delete Collection</h4>
                                    <p className="text-sm text-gray-400">Delete all cards. This will empty your decks.</p>
                                </div>
                                <button
                                    onClick={() => { setDeleteTarget('collection'); setDeleteModalOpen(true); }}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-bold transition-colors"
                                >
                                    Delete Collection
                                </button>
                            </div>

                            <div className="p-4 bg-red-900/20 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-bold text-white">Delete Everything</h4>
                                    <p className="text-sm text-gray-400">Wipe your entire library: decks, cards, and wishlist.</p>
                                </div>
                                <button
                                    onClick={() => { setDeleteTarget('all'); setDeleteModalOpen(true); }}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-red-900/20"
                                >
                                    Delete Everything
                                </button>
                            </div>
                        </div>
                    </details>
                </div>
            </section>

            <ImportDataModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} mode="global" />
            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                targetName={deleteTarget ? deleteTarget.toUpperCase() : ''}
                title={deleteTarget === 'all' ? 'Delete Everything?' : deleteTarget === 'decks' ? 'Delete All Decks?' : deleteTarget === 'collection' ? 'Delete Collection?' : 'Clear Wishlist?'}
                message={deleteTarget === 'all' ? 'This will permanently delete ALL data associated with your account. This cannot be undone.' : deleteTarget === 'decks' ? 'This will delete all your deck lists.' : deleteTarget === 'collection' ? 'This will delete all cards in your collection.' : 'This will remove all cards from your wishlist.'}
                onConfirm={async () => {
                    setDeleteLoading(true);
                    try {
                        await api.delete('/api/users/me/data', { target: deleteTarget });
                        window.location.reload();
                    } catch (err) {
                        console.error(err);
                        alert("Failed to delete data.");
                    } finally {
                        setDeleteLoading(false);
                        setDeleteModalOpen(false);
                    }
                }}
            />
        </div>
    );
};

export default DataSettings;
