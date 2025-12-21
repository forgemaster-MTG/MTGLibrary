import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { collectionService } from '../services/collectionService';
import ImportDataModal from '../components/modals/ImportDataModal';

const SettingsPage = () => {
    const { user, userProfile, refreshUserProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Form State
    const [geminiKey, setGeminiKey] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [gridSize, setGridSize] = useState('md');

    useEffect(() => {
        if (userProfile?.settings) {
            // Populate state from userProfile.settings
            if (userProfile.settings.geminiApiKey) setGeminiKey(userProfile.settings.geminiApiKey); // Note: key might be masked in real app, assuming stored plain for now per plan
            if (userProfile.settings.viewMode) setViewMode(userProfile.settings.viewMode);
            if (userProfile.settings.gridSize) setGridSize(userProfile.settings.gridSize);
        }
    }, [userProfile]);

    const handleSave = async () => {
        if (!userProfile?.id) {
            alert('User profile not ready. Please try again.');
            return;
        }
        setSaving(true);
        try {
            const currentSettings = userProfile?.settings || {};
            const newSettings = {
                ...currentSettings,
                geminiApiKey: geminiKey,
                viewMode,
                gridSize
            };

            await api.updateUser(userProfile.id, { settings: newSettings });
            await refreshUserProfile(); // Reload profile to confirm
            alert('Settings saved!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Error saving settings: ' + (error.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handleExportCollection = async () => {
        try {
            const cards = await api.get('/collection/export');

            if (!cards || cards.length === 0) {
                alert('No cards to export.');
                return;
            }

            const dataStr = JSON.stringify({ cards, exported_at: new Date() }, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `mtg_collection_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export collection.');
        }
    };

    if (!user) return <div className="p-8 text-center text-gray-500">Please log in to view settings.</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                Settings
            </h1>

            {/* Tabs */}
            <div className="flex border-b border-gray-700">
                {['general', 'ai', 'display', 'data'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === tab
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg min-h-[400px]">
                {/* ... existing tabs ... */}
                {activeTab === 'general' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-semibold text-white">Account Information</h2>
                        <div className="space-y-1">
                            <label className="text-sm text-gray-400 block">Email</label>
                            <div className="bg-gray-900 p-3 rounded-lg text-gray-200">{user.email}</div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm text-gray-400 block">User ID</label>
                            <div className="bg-gray-900 p-3 rounded-lg text-gray-200 font-mono text-xs">{user.uid}</div>
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-start">
                            <h2 className="text-xl font-semibold text-white">AI Integrations</h2>
                            <span className="bg-indigo-900/50 text-indigo-300 text-xs px-2 py-1 rounded border border-indigo-700/50">Gemini</span>
                        </div>

                        <div className="space-y-4">
                            <p className="text-gray-400 text-sm">
                                To enable the AI Assistant and Deck Suggestions, you need a Google Gemini API Key.
                                Keys are stored securely in your user profile.
                            </p>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Gemini API Key</label>
                                <input
                                    type="password"
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    placeholder="Enter AI Key..."
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                                <div className="text-xs text-gray-500 flex justify-between">
                                    <span>Never share your API key.</span>
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline">
                                        Get a key from Google AI Studio &rarr;
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'display' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-semibold text-white">Display Preferences</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-3">Default View </label>
                                <div className="flex gap-4">
                                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                                        <input type="radio" name="viewMode" value="grid" checked={viewMode === 'grid'} onChange={() => setViewMode('grid')} className="text-indigo-500 focus:ring-indigo-500" />
                                        <span className="text-gray-200">Grid View</span>
                                    </label>
                                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${viewMode === 'table' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                                        <input type="radio" name="viewMode" value="table" checked={viewMode === 'table'} onChange={() => setViewMode('table')} className="text-indigo-500 focus:ring-indigo-500" />
                                        <span className="text-gray-200">Table View</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-3">Grid Size</label>
                                <select
                                    value={gridSize}
                                    onChange={(e) => setGridSize(e.target.value)}
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
                                >
                                    <option value="sm">Small</option>
                                    <option value="md">Medium</option>
                                    <option value="lg">Large</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-semibold text-white">Data Management</h2>
                        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 mb-6">
                            <h3 className="text-yellow-500 font-bold mb-1 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                Important Note
                            </h3>
                            <p className="text-yellow-200/80 text-sm">
                                Backups include your collection data. Deck exports can be done from individual deck pages.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors">
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

                            <div className="border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors">
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
                    </div>
                )}
            </div>

            {/* Import Modal */}
            <ImportDataModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                mode="global"
            />

            {/* Actions */}
            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
};

export default SettingsPage;
