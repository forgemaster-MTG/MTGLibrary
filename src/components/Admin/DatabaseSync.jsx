import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
// Assuming format is needed or we can import from date-fns if present in codebase

const DatabaseSync = () => {
    // Sync State
    const [sets, setSets] = useState([]);
    const [selectedSet, setSelectedSet] = useState('');
    const [syncLog, setSyncLog] = useState([]);
    const [syncing, setSyncing] = useState(false);
    const isCancelled = useRef(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [stats, setStats] = useState({
        totalCards: 0,
        types: { creature: 0, instant: 0, sorcery: 0, enchantment: 0, artifact: 0, land: 0, planeswalker: 0, other: 0 }
    });
    const [syncOptions, setSyncOptions] = useState({ updatePrices: true, updateInfo: true });
    const [lastSync, setLastSync] = useState(null);

    useEffect(() => {
        fetchSets();
        const stored = localStorage.getItem('admin_last_sync');
        if (stored) {
            try { setLastSync(JSON.parse(stored)); } catch (e) { console.error(e); }
        }
    }, []);

    const fetchSets = async () => {
        try {
            const data = await api.get('/api/admin/sets');
            setSets(data.data || []);
        } catch (err) { console.error(err); }
    };

    const log = (msg) => setSyncLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    const updateStats = (newCount, newTypes) => {
        setStats(prev => {
            const next = { ...prev };
            next.totalCards += newCount;
            if (newTypes) Object.keys(newTypes).forEach(key => next.types[key] = (next.types[key] || 0) + (newTypes[key] || 0));
            return next;
        });
    };

    const saveLastSync = (finalStats) => {
        const record = { date: new Date().toISOString(), stats: finalStats };
        setLastSync(record);
        localStorage.setItem('admin_last_sync', JSON.stringify(record));
    };

    const handleSyncSet = async (setCode, isMass = false) => {
        if (!setCode) return;
        try {
            log(`Starting sync for ${setCode}...`);
            const res = await fetch('/api/admin/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setCode, ...syncOptions })
            });
            const data = await res.json();
            if (data.success) {
                log(`Success: ${setCode}. Processed ${data.count} cards.`);
                updateStats(data.count, data.typeStats);
                if (isMass) setProgress(p => ({ ...p, current: p.current + 1 }));
            } else { log(`Error: ${data.error}`); }
        } catch (err) { log(`Request Failed: ${err.message}`); }
    };

    const handleCancel = () => { if (window.confirm("Cancel sync?")) { isCancelled.current = true; log("Cancelling..."); } };

    const handleMassSync = async () => {
        if (!window.confirm("Sync ALL sets?")) return;
        setSyncing(true);
        isCancelled.current = false;
        log("Starting Mass Sync...");
        setStats({ totalCards: 0, types: { creature: 0, instant: 0, sorcery: 0, enchantment: 0, artifact: 0, land: 0, planeswalker: 0, other: 0 } });
        setProgress({ current: 0, total: sets.length });
        for (const set of sets) {
            if (isCancelled.current) break;
            await handleSyncSet(set.code, true);
        }
        log("Mass Sync Complete!");
        saveLastSync(stats); // Simple save at end
        setSyncing(false);
    };

    const handleSingleSync = async () => {
        if (!selectedSet) return;
        setSyncing(true);
        setStats({ totalCards: 0, types: { creature: 0, instant: 0, sorcery: 0, enchantment: 0, artifact: 0, land: 0, planeswalker: 0, other: 0 } });
        await handleSyncSet(selectedSet);
        setSyncing(false);
    };

    const handlePreconUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !window.confirm(`Upload ${file.name}?`)) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/admin/precons/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) alert(`Uploaded ${data.name}`); else alert(`Error: ${data.error}`);
        } catch (err) { alert('Upload failed'); }
        e.target.value = null;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Scryfall Sync</h2>
                {lastSync && (
                    <div className="text-right text-xs text-gray-400">
                        <p>Last: {new Date(lastSync.date).toLocaleString()}</p>
                        <p>{lastSync.stats.totalCards} cards</p>
                    </div>
                )}
            </div>

            {/* Precon Upload Section */}
            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-white mb-2">Upload Precon JSON</h3>
                <p className="text-xs text-purple-300 mb-3">Upload a JSON file from MTGJSON or similar format to import preconstructed decks.</p>
                <input type="file" accept=".json" onChange={handlePreconUpload} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-500" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-900/40 p-4 rounded-lg border border-indigo-700/50">
                    <p className="text-xs text-indigo-300 uppercase font-bold">Total Cards</p>
                    <p className="text-2xl font-bold text-white">{stats.totalCards}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase font-bold">Progress</p>
                    <p className="text-2xl font-bold text-white">{progress.total > 0 ? `${progress.current} / ${progress.total}` : '-'}</p>
                    {progress.total > 0 && <div className="w-full bg-gray-700 h-1.5 mt-2 rounded-full overflow-hidden"><div className="bg-green-500 h-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div></div>}
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700/50 flex flex-wrap gap-6 items-center">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={syncOptions.updatePrices} onChange={(e) => setSyncOptions(prev => ({ ...prev, updatePrices: e.target.checked }))} className="form-checkbox bg-gray-800 border-gray-600 text-indigo-500" /><span className="text-gray-200 text-sm">Update Prices</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={syncOptions.updateInfo} onChange={(e) => setSyncOptions(prev => ({ ...prev, updateInfo: e.target.checked }))} className="form-checkbox bg-gray-800 border-gray-600 text-indigo-500" /><span className="text-gray-200 text-sm">Update Card Info</span></label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600">
                        <h3 className="text-lg font-medium text-white mb-2">Single Set</h3>
                        <div className="flex gap-4">
                            <select className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white flex-1 min-w-0 max-w-full" value={selectedSet} onChange={(e) => setSelectedSet(e.target.value)}>
                                <option value="">Select Set...</option>
                                {sets.map(s => <option key={s.code} value={s.code} className="truncate">{s.name} ({s.code.toUpperCase()})</option>)}
                            </select>
                            <button onClick={handleSingleSync} disabled={syncing || !selectedSet} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg">{syncing ? '...' : 'Sync'}</button>
                        </div>
                    </div>
                    <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600">
                        <h3 className="text-lg font-medium text-white mb-2">Mass Sync</h3>
                        {syncing ? <button onClick={handleCancel} className="bg-red-600 text-white px-6 py-3 rounded-lg w-full font-bold animate-pulse">CANCEL</button> : <button onClick={handleMassSync} className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg w-full font-bold">SYNC ALL</button>}
                    </div>
                </div>
                <div className="bg-black/50 p-4 rounded-lg font-mono text-xs text-green-400 h-64 overflow-y-auto border border-white/10">{syncLog.map((l, i) => <div key={i}>{l}</div>)}</div>
            </div>
        </div>
    );
};

export default DatabaseSync;
