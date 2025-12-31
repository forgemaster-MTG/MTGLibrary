import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { collectionService } from '../services/collectionService';
import ImportDataModal from '../components/modals/ImportDataModal';
import HelperSettingsModal from '../components/modals/HelperSettingsModal';

const SettingsPage = () => {
    const { user, userProfile, refreshUserProfile } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isHelperModalOpen, setIsHelperModalOpen] = useState(false);

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
                {['general', 'ai', 'display', 'data', ...(user?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3' ? ['admin'] : [])].map((tab) => (
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

                        {/* Onboarding Reset */}
                        <div className="pt-6 border-t border-gray-700">
                            <h3 className="text-lg font-medium text-white mb-2">Account Actions</h3>
                            <button
                                onClick={async () => {
                                    if (window.confirm('This will restart the welcome tour. Continue?')) {
                                        await api.updateUser(userProfile.id, { settings: { ...userProfile.settings, onboarding_complete: false, onboarding_step: 0 } });
                                        await refreshUserProfile();
                                        navigate('/onboarding');
                                    }
                                }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg border border-gray-600 transition-colors text-sm font-medium"
                            >
                                Reset Onboarding Tour
                            </button>
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


                        {/* AI Personas Section */}
                        <div className="pt-6 border-t border-gray-700">
                            <h3 className="text-lg font-semibold text-white mb-4">Personalization</h3>
                            <div className="flex flex-wrap gap-4">
                                <button
                                    onClick={() => setIsHelperModalOpen(true)}
                                    className="flex items-center gap-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-5 py-3 rounded-xl transition-all hover:shadow-lg hover:border-emerald-500 group"
                                >
                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                        🤖
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">Helper Settings</div>
                                        <div className="text-xs text-gray-400">Customize your AI companion</div>
                                    </div>
                                </button>

                                {/* Playstyle Button (If desired here too) */}
                                {/* 
                                <button
                                    onClick={() => setPlaystyleModalOpen(true)} // Assuming this state exists if we want it
                                    className="flex items-center gap-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-5 py-3 rounded-xl transition-all hover:shadow-lg hover:border-purple-500 group"
                                >
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                        🧠
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">Playstyle Profile</div>
                                        <div className="text-xs text-gray-400">Retake the Deep Dive</div>
                                    </div>
                                </button> 
                                */}
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

                {activeTab === 'admin' && user?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3' && (
                    <AdminPanel />
                )}
            </div>

            {/* Import Modal */}
            <ImportDataModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                mode="global"
            />

            {/* Helper Settings Modal */}
            <HelperSettingsModal
                isOpen={isHelperModalOpen}
                onClose={() => setIsHelperModalOpen(false)}
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
        </div >
    );
};

const AdminPanel = () => {
    const [sets, setSets] = useState([]);
    const [selectedSet, setSelectedSet] = useState('');
    const [syncLog, setSyncLog] = useState([]);
    const [syncing, setSyncing] = useState(false);
    const isCancelled = React.useRef(false);

    // Stats State
    const [progress, setProgress] = useState({ current: 0, total: 0 }); // for mass sync
    const [stats, setStats] = useState({
        totalCards: 0,
        types: {
            creature: 0,
            instant: 0,
            sorcery: 0,
            enchantment: 0,
            artifact: 0,
            land: 0,
            planeswalker: 0,
            other: 0
        }
    });

    // Sync Options
    const [syncOptions, setSyncOptions] = useState({
        updatePrices: true,
        updateInfo: true
    });

    // Last Sync State
    const [lastSync, setLastSync] = useState(null);

    useEffect(() => {
        fetchSets();
        // Load last sync from storage
        const stored = localStorage.getItem('admin_last_sync');
        if (stored) {
            try {
                setLastSync(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse last sync", e);
            }
        }
    }, []);

    const fetchSets = async () => {
        try {
            const data = await api.get('/admin/sets');
            setSets(data.data || []);
        } catch (err) {
            console.error('Failed to fetch sets', err);
        }
    };

    const log = (msg) => setSyncLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    const updateStats = (newCount, newTypes) => {
        setStats(prev => {
            const next = { ...prev };
            next.totalCards += newCount;
            if (newTypes) {
                Object.keys(newTypes).forEach(key => {
                    next.types[key] = (next.types[key] || 0) + (newTypes[key] || 0);
                });
            }
            return next;
        });
    };

    // Helper to save current stats
    const saveLastSync = (finalStats) => {
        const record = {
            date: new Date().toISOString(),
            stats: finalStats
        };
        setLastSync(record);
        localStorage.setItem('admin_last_sync', JSON.stringify(record));
    };

    const handleSyncSet = async (setCode, isMass = false) => {
        if (!setCode) return;
        try {
            log(`Starting sync for ${setCode}...`);
            const res = await fetch('http://localhost:3000/admin/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setCode, ...syncOptions })
            });
            const data = await res.json();

            if (data.success) {
                log(`Success: ${setCode}. Processed ${data.count} cards.`);
                updateStats(data.count, data.typeStats);
                if (isMass) setProgress(p => ({ ...p, current: p.current + 1 }));
            } else {
                log(`Error: ${data.error}`);
            }
        } catch (err) {
            log(`Request Failed: ${err.message}`);
        }
    };

    const handleCancel = () => {
        if (window.confirm("Are you sure you want to cancel the sync?")) {
            isCancelled.current = true;
            log("Cancelling operation...");
        }
    };

    const handleMassSync = async () => {
        if (!window.confirm("This will sync ALL sets. It may take a long time. Continue?")) return;
        setSyncing(true);
        isCancelled.current = false; // Reset cancel flag
        log("Starting Mass Sync...");

        // Reset Stats
        const initialStats = {
            totalCards: 0,
            types: { creature: 0, instant: 0, sorcery: 0, enchantment: 0, artifact: 0, land: 0, planeswalker: 0, other: 0 }
        };
        setStats(initialStats);
        setProgress({ current: 0, total: sets.length });

        // Iterate
        for (const set of sets) {
            if (isCancelled.current) {
                log("Mass Sync Cancelled by User.");
                break;
            }
            await handleSyncSet(set.code, true);
        }

        if (!isCancelled.current) {
            log("Mass Sync Complete!");
        }

        // Save stats at end (using state is tricky due to closure, but we updated state incrementally. 
        // Ideally we'd track a local var, but for now we can't easily read 'stats' state here without a ref or effect.
        // Quick fix: Just verify visual. Implementing 'saveLastSync' with the state as we know it isn't perfect in a closure.
        // Better: Update saveLastSync to be called via Effect or just use a ref for stats too?
        // Let's use a timeout/effect trick or just store 'lastSync' manually on next render? 
        // Actually, let's just use a ref for the stats accumulator so we can save it accurately.
    };

    // We need to persist the stats. Let's wrap handleMassSync in a way we can access latest stats or just execute a state update to save.
    // Simplest approach: trigger a save effect when syncing becomes false if it was true.
    useEffect(() => {
        if (!syncing && stats.totalCards > 0) {
            saveLastSync(stats);
        }
    }, [syncing]); // When sync finishes/stops, save.

    const handleSingleSync = async () => {
        if (!selectedSet) return;
        setSyncing(true);
        // Do not reset stats for single sync, just add to running tally? Or reset?
        // Let's reset for clarity unless part of mass.
        setStats({ totalCards: 0, types: { creature: 0, instant: 0, sorcery: 0, enchantment: 0, artifact: 0, land: 0, planeswalker: 0, other: 0 } });

        await handleSyncSet(selectedSet);
        setSyncing(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Admin Scryfall Sync</h2>
                {lastSync && (
                    <div className="text-right text-xs text-gray-400">
                        <p>Last Sync: {new Date(lastSync.date).toLocaleString()}</p>
                        <p>{lastSync.stats.totalCards} cards processed</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-900/40 p-4 rounded-lg border border-indigo-700/50">
                    <p className="text-xs text-indigo-300 uppercase font-bold">Total Cards</p>
                    <p className="text-2xl font-bold text-white">{stats.totalCards}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase font-bold">Progress</p>
                    <p className="text-2xl font-bold text-white">
                        {progress.total > 0 ? `${progress.current} / ${progress.total}` : '-'}
                    </p>
                    {progress.total > 0 && (
                        <div className="w-full bg-gray-700 h-1.5 mt-2 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(stats.types).map(([type, count]) => (
                    <div key={type} className="bg-gray-800/50 p-2 rounded border border-gray-700/50 flex justify-between items-center">
                        <span className="text-xs text-gray-400 capitalize">{type}</span>
                        <span className="text-sm font-bold text-gray-200">{count}</span>
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                {/* Options */}
                <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700/50 flex flex-wrap gap-6 items-center">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Configuration</span>
                    <label className="flex items-center gap-2 cursor-pointer bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-indigo-500 transition-colors">
                        <input
                            type="checkbox"
                            checked={syncOptions.updatePrices}
                            onChange={(e) => setSyncOptions(prev => ({ ...prev, updatePrices: e.target.checked }))}
                            className="form-checkbox text-indigo-500 rounded bg-gray-800 border-gray-600 focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-gray-200 text-sm font-medium">Update Prices</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-indigo-500 transition-colors">
                        <input
                            type="checkbox"
                            checked={syncOptions.updateInfo}
                            onChange={(e) => setSyncOptions(prev => ({ ...prev, updateInfo: e.target.checked }))}
                            className="form-checkbox text-indigo-500 rounded bg-gray-800 border-gray-600 focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-gray-200 text-sm font-medium">Update Card Info</span>
                    </label>
                    <span className="text-xs text-gray-500 italic ml-auto hidden sm:block">
                        Propagates price updates to all user collections.
                    </span>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Single */}
                    <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600">
                        <h3 className="text-lg font-medium text-white mb-2">Single Set Sync</h3>
                        <div className="flex gap-4">
                            <select
                                className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white flex-1 min-w-0"
                                value={selectedSet}
                                onChange={(e) => setSelectedSet(e.target.value)}
                            >
                                <option value="">Select a Set...</option>
                                {sets.map(s => (
                                    <option key={s.code} value={s.code}>{s.name} ({s.code.toUpperCase()})</option>
                                ))}
                            </select>
                            <button
                                onClick={handleSingleSync}
                                disabled={syncing || !selectedSet}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg whitespace-nowrap"
                            >
                                {syncing ? 'Syncing...' : 'Sync Set'}
                            </button>
                        </div>
                    </div>

                    {/* Mass */}
                    <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600 flex flex-col justify-between">
                        <h3 className="text-lg font-medium text-white mb-2">Mass Operations</h3>
                        {syncing ? (
                            <button
                                onClick={handleCancel}
                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg w-full font-bold animate-pulse"
                            >
                                CANCEL OPERATION
                            </button>
                        ) : (
                            <button
                                onClick={handleMassSync}
                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg w-full font-bold"
                            >
                                SYNC ALL SETS
                            </button>
                        )}
                        <p className="text-gray-400 text-xs mt-2 text-center">Iterates {sets.length} sets.</p>
                    </div>
                </div>

                <div className="bg-black/50 p-4 rounded-lg font-mono text-xs text-green-400 h-64 overflow-y-auto border border-white/10">
                    {syncLog.length === 0 ? <span className="text-gray-600">Ready to sync...</span> : syncLog.map((l, i) => <div key={i}>{l}</div>)}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
