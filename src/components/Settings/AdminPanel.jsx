import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { GeminiService } from '../../services/gemini';
import RichTextEditor from '../common/RichTextEditor';
import { format } from 'date-fns';
import { TIERS } from '../../config/tiers';
import SubscriptionOverrideModal from './SubscriptionOverrideModal';

// Simple Modal Component
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', creating }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 border border-indigo-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl transform transition-all animate-fade-in relative">
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-300 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={creating}
                        className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={creating}
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg disabled:opacity-50 flex items-center gap-2"
                    >
                        {creating && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminPanel = () => {
    const { userProfile } = useAuth();
    const [activeSection, setActiveSection] = useState('sync'); // 'sync', 'permissions', 'epics', 'release'

    // Sync State
    const [sets, setSets] = useState([]);
    const [selectedSet, setSelectedSet] = useState('');
    const [syncLog, setSyncLog] = useState([]);
    const [syncing, setSyncing] = useState(false);
    const isCancelled = React.useRef(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [stats, setStats] = useState({
        totalCards: 0,
        types: { creature: 0, instant: 0, sorcery: 0, enchantment: 0, artifact: 0, land: 0, planeswalker: 0, other: 0 }
    });
    const [syncOptions, setSyncOptions] = useState({ updatePrices: true, updateInfo: true });
    const [lastSync, setLastSync] = useState(null);

    // Permissions State
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    useEffect(() => {
        fetchSets();
        const stored = localStorage.getItem('admin_last_sync');
        if (stored) {
            try { setLastSync(JSON.parse(stored)); } catch (e) { console.error(e); }
        }
    }, []);

    // Fetch Users when switching to permissions tab
    useEffect(() => {
        if (activeSection === 'permissions') {
            fetchUsers();
        }
    }, [activeSection]);

    const fetchSets = async () => {
        try {
            const data = await api.get('/api/admin/sets');
            setSets(data.data || []);
        } catch (err) { console.error(err); }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const data = await api.getUsers();
            // Sort: Admins first, then ID
            data.sort((a, b) => (b.settings?.isAdmin ? 1 : 0) - (a.settings?.isAdmin ? 1 : 0) || a.id - b.id);
            setUsers(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Sync Logic (Preserved)
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

    // Permission Logic
    const togglePermission = async (user, permission) => {
        try {
            const currentPermissions = user.settings?.permissions || [];
            const hasPermission = currentPermissions.includes(permission);
            let newPermissions;
            if (hasPermission) {
                newPermissions = currentPermissions.filter(p => p !== permission);
            } else {
                newPermissions = [...currentPermissions, permission];
            }

            // Optimistic Update
            setUsers(users.map(u => u.id === user.id ? { ...u, settings: { ...u.settings, permissions: newPermissions } } : u));

            await api.updateUserPermissions(user.id, newPermissions, user.settings?.isAdmin);
        } catch (err) {
            alert('Failed to update permission');
            fetchUsers(); // Revert
        }
    };

    const toggleAdmin = async (user) => {
        if (!window.confirm(`Are you sure you want to toggle ADMIN status for ${user.username}?`)) return;
        try {
            const newStatus = !user.settings?.isAdmin;

            // Optimistic
            setUsers(users.map(u => u.id === user.id ? { ...u, settings: { ...u.settings, isAdmin: newStatus } } : u));

            await api.updateUserPermissions(user.id, user.settings?.permissions, newStatus);
        } catch (err) {
            alert('Failed to update admin status');
            fetchUsers();
        }
    };

    // Subscription Override State
    const [showSubModal, setShowSubModal] = useState(false);
    const [selectedUserForSub, setSelectedUserForSub] = useState(null);

    const handleOpenSubModal = (user) => {
        setSelectedUserForSub(user);
        setShowSubModal(true);
    };

    const handleConfirmSubOverride = async (newTier) => {
        if (!selectedUserForSub) return;
        try {
            // Determine effective tier (newTier if setting, 'free' if removing default)
            // Note: In a real app we might want to "restore" their Stripe status, but for now reverting to free is safest.
            const effectiveTier = newTier || 'free';

            // Optimistic Update
            setUsers(users.map(u => u.id === selectedUserForSub.id ? {
                ...u,
                override_tier: newTier,
                subscription_tier: effectiveTier
            } : u));

            const payload = {
                user_override_tier: newTier,
                subscription_status: newTier ? 'active' : 'canceled' // or free
            };

            // Should we update the actual subscription_tier column? Yes, to enforce limits.
            payload.subscription_tier = effectiveTier;

            await api.updateUserPermissions(selectedUserForSub.id, selectedUserForSub.settings?.permissions, selectedUserForSub.settings?.isAdmin, payload);

            setShowSubModal(false);
            setSelectedUserForSub(null);
        } catch (err) {
            alert(err.message || 'Failed to update subscription');
            fetchUsers();
        }
    };



    // Epic State
    const [epics, setEpics] = useState([]);
    const [newEpic, setNewEpic] = useState({ title: '', description: '', status: 'open' });
    const [editingEpic, setEditingEpic] = useState(null);
    const [loadingEpics, setLoadingEpics] = useState(false);

    // Release Notes State
    const [reportPeriod, setReportPeriod] = useState({
        start: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [reportTickets, setReportTickets] = useState([]);
    const [fetchingReport, setFetchingReport] = useState(false);
    const [generatedNotes, setGeneratedNotes] = useState('');
    const [generatingNotes, setGeneratingNotes] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [releaseVersion, setReleaseVersion] = useState('');
    const [showPublishModal, setShowPublishModal] = useState(false);

    // Fetch Epics when switching to epics tab
    useEffect(() => {
        if (activeSection === 'epics') {
            fetchEpics();
        }
    }, [activeSection]);

    const fetchEpics = async () => {
        setLoadingEpics(true);
        try {
            const data = await api.getEpics();
            setEpics(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingEpics(false);
        }
    };

    const handleCreateEpic = async (e) => {
        e.preventDefault();
        try {
            await api.createEpic(newEpic);
            setNewEpic({ title: '', description: '', status: 'open' });
            fetchEpics();
            alert('Epic created successfully!');
        } catch (err) {
            alert('Failed to create epic: ' + err.message);
        }
    };

    const handleUpdateEpic = async (e) => {
        e.preventDefault();
        if (!editingEpic) return;
        try {
            await api.updateEpic(editingEpic.id, editingEpic);
            setEditingEpic(null);
            fetchEpics();
            alert('Epic updated successfully!');
        } catch (err) {
            alert('Failed to update epic: ' + err.message);
        }
    };

    const handleDeleteEpic = async (id) => {
        if (!window.confirm('Delete this epic? This will NOT delete associated tickets but will unlink them.')) return;
        try {
            await api.deleteEpic(id);
            fetchEpics();
        } catch (err) {
            alert('Failed to delete epic: ' + err.message);
        }
    };

    const getStatusBadge = (status) => {
        const colors = {
            open: 'bg-green-500/20 text-green-400 border-green-500/30',
            planned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            completed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            complete_pending: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
            complete_scheduled: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
            complete_blocked: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            wont_fix: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        };
        const labels = {
            open: 'Open',
            planned: 'Planned',
            in_progress: 'In Progress',
            completed: 'Completed',
            complete_pending: 'Pend. Release',
            complete_scheduled: 'Rel. Sched.',
            complete_blocked: 'Blocked',
            wont_fix: "Won't Fix"
        };
        return (
            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider border ${colors[status] || colors.open}`}>
                {labels[status] || status}
            </span>
        );
    };

    // Release Notes Logic
    const handleFetchReport = async () => {
        setFetchingReport(true);
        try {
            const data = await api.getTicketReport({
                startDate: reportPeriod.start,
                endDate: reportPeriod.end,
                excludeReleased: true,
                status: '' // Fetch all activity
            });
            setReportTickets(data);
        } catch (err) {
            alert('Failed to fetch report: ' + err.message);
        } finally {
            setFetchingReport(false);
        }
    };

    const handleGenerateNotes = async () => {
        if (!userProfile?.settings?.geminiApiKey) {
            alert('Missing Gemini API Key. Please add it in Settings > AI.');
            return;
        }
        setGeneratingNotes(true);
        try {
            const notes = await GeminiService.generateReleaseNotes(
                userProfile.settings.geminiApiKey,
                reportTickets
            );
            setGeneratedNotes(notes);
            // Auto-suggest version? e.g. v1.0.X
            setReleaseVersion(`v${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}`);
        } catch (err) {
            alert('Failed to generate release notes: ' + err.message);
        } finally {
            setGeneratingNotes(false);
        }
    };

    const handlePublishClick = () => {
        if (!releaseVersion) return alert('Please enter a version number (e.g. v1.2.0)');
        if (!generatedNotes) return alert('No notes generated');
        setShowPublishModal(true);
    };

    const handleConfirmPublish = async () => {
        setPublishing(true);
        try {
            // Calculate stats
            const stats = {
                features: reportTickets.filter(t => t.type === 'feature').length,
                bugs: reportTickets.filter(t => t.type === 'bug').length,
                total: reportTickets.length
            };

            await api.publishRelease({
                version: releaseVersion,
                notes: generatedNotes,
                ticketIds: reportTickets.map(t => t.id),
                typeStats: stats
            });

            // Success feedback
            setShowPublishModal(false);
            setGeneratedNotes('');
            setReportTickets([]);
            alert('Release Published Successfully!'); // Still use alert for success or could use toast
        } catch (err) {
            alert('Failed to publish: ' + err.message);
            setShowPublishModal(false); // Close on error so they can retry
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Modal */}
            <ConfirmModal
                isOpen={showPublishModal}
                onClose={() => setShowPublishModal(false)}
                onConfirm={handleConfirmPublish}
                title={`Publish Release ${releaseVersion}?`}
                message={`This will move ${reportTickets.length} tickets to the "Released" status and they will no longer appear on the active board. Are you sure?`}
                confirmText={publishing ? "Publishing..." : "Confirm Publish"}
                creating={publishing}
            />

            <SubscriptionOverrideModal
                isOpen={showSubModal}
                onClose={() => setShowSubModal(false)}
                onConfirm={handleConfirmSubOverride}
                user={selectedUserForSub}
            />

            <div className="flex border-b border-gray-700 mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveSection('sync')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${activeSection === 'sync' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                    DB Sync & Tools
                </button>
                <button
                    onClick={() => setActiveSection('permissions')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${activeSection === 'permissions' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                    User Permissions
                </button>
                <button
                    onClick={() => setActiveSection('epics')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${activeSection === 'epics' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                    Epics / Projects
                </button>
                <button
                    onClick={() => setActiveSection('release')}
                    className={`px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${activeSection === 'release' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                    Release Notes
                </button>
            </div>

            {activeSection === 'sync' && (
                <div className="space-y-6">
                    {/* ... Existing Sync UI ... */}
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
            )}

            {activeSection === 'permissions' && (
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-white">User Permissions Manager</h2>
                    {loadingUsers ? <p className="text-gray-400">Loading users...</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-700 text-gray-400 text-sm uppercase">
                                        <th className="py-3 px-4">User</th>
                                        <th className="py-3 px-4">Email</th>
                                        <th className="py-3 px-4">Subscription</th>
                                        <th className="py-3 px-4 text-center">Admin</th>
                                        <th className="py-3 px-4 text-center">Ticket Mgr</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-800">
                                    {users.map(u => {
                                        const isTicketMgr = u.settings?.permissions?.includes('manage_tickets');
                                        const isAdmin = u.settings?.isAdmin;
                                        return (
                                            <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                                                <td className="py-3 px-4 font-medium text-white">
                                                    {u.username || 'No Username'}
                                                    {u.id === 1 && <span className="ml-2 text-[10px] bg-yellow-500 text-black px-1 rounded">ROOT</span>}
                                                </td>
                                                <td className="py-3 px-4 text-gray-400">{u.email}</td>

                                                {/* Subscription Column */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs px-2 py-0.5 rounded border ${u.override_tier ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                                                            {(u.override_tier || u.subscription_tier || 'free').replace('tier_', 'Tier ')}
                                                        </span>
                                                        <button
                                                            onClick={() => handleOpenSubModal(u)}
                                                            className="text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
                                                        >
                                                            Manage
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Admin Column */}
                                                <td className="py-3 px-4 text-center">
                                                    <button onClick={() => toggleAdmin(u)} className={`w-8 h-4 rounded-full transition-colors relative ${isAdmin ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                                                        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isAdmin ? 'translate-x-4' : 'translate-x-0'}`} />
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button onClick={() => togglePermission(u, 'manage_tickets')} className={`w-8 h-4 rounded-full transition-colors relative ${isTicketMgr ? 'bg-green-600' : 'bg-gray-600'}`}>
                                                        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isTicketMgr ? 'translate-x-4' : 'translate-x-0'}`} />
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4 text-right text-xs text-gray-500">
                                                    ID: {u.id}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeSection === 'epics' && (
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-white">Manage Projects (Epics)</h2>

                    {/* Create / Edit Form */}
                    <div className={`bg-gray-800/50 p-6 rounded-xl border ${editingEpic ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'border-white/10'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-white">{editingEpic ? 'Edit Project' : 'Create New Project'}</h3>
                            {editingEpic && (
                                <button onClick={() => setEditingEpic(null)} className="text-xs text-gray-400 hover:text-white underline">
                                    Cancel Edit
                                </button>
                            )}
                        </div>
                        <form onSubmit={editingEpic ? handleUpdateEpic : handleCreateEpic} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    value={editingEpic ? editingEpic.title : newEpic.title}
                                    onChange={e => editingEpic ? setEditingEpic({ ...editingEpic, title: e.target.value }) : setNewEpic({ ...newEpic, title: e.target.value })}
                                    placeholder="e.g. Q1 Mobile App"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                                <div className="h-48">
                                    <RichTextEditor
                                        value={editingEpic ? editingEpic.description : newEpic.description}
                                        onChange={val => editingEpic ? setEditingEpic({ ...editingEpic, description: val }) : setNewEpic({ ...newEpic, description: val })}
                                        placeholder="Detailed epic goal..."
                                        type="Epic"
                                        height="h-40"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                                <select
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    value={editingEpic ? editingEpic.status : newEpic.status}
                                    onChange={e => editingEpic ? setEditingEpic({ ...editingEpic, status: e.target.value }) : setNewEpic({ ...newEpic, status: e.target.value })}
                                >
                                    <option value="open">Open</option>
                                    <option value="planned">Planned</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="complete_pending">Complete - Pending Release</option>
                                    <option value="complete_scheduled">Complete - Release Scheduled</option>
                                    <option value="complete_blocked">Complete - Waiting on Epic</option>
                                    <option value="wont_fix">Won't Fix</option>
                                    <option value="active" className="text-gray-500">Active (Legacy)</option>
                                    <option value="archived" className="text-gray-500">Archived (Legacy)</option>
                                </select>
                            </div>
                            <div className="flex justify-end pt-4 gap-2">
                                <button
                                    type="submit"
                                    className={`px-6 py-2 font-bold rounded-lg shadow-lg transition-all text-white ${editingEpic ? 'bg-green-600 hover:bg-green-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                >
                                    {editingEpic ? 'Save Changes' : 'Create Epic'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* List */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-white">Existing Projects</h3>
                        {loadingEpics ? <div className="text-gray-500">Loading...</div> : (
                            <div className="space-y-2">
                                {epics.map(epic => (
                                    <div key={epic.id} className={`bg-gray-800 p-4 rounded-xl border flex justify-between items-center group transition-all ${editingEpic?.id === epic.id ? 'border-indigo-500 ring-1 ring-indigo-500 bg-gray-800/80' : 'border-white/5 hover:border-white/10'}`}>
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h4 className="font-bold text-white truncate">{epic.title}</h4>
                                                {getStatusBadge(epic.status)}
                                            </div>
                                            <div
                                                className="text-sm text-gray-400 prose prose-invert prose-sm max-w-none line-clamp-1"
                                                dangerouslySetInnerHTML={{ __html: epic.description || '' }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right hidden sm:block">
                                                <span className="text-xs text-gray-500 block">ID: {epic.id}</span>
                                                <span className="text-xs text-indigo-400 block">{epic.ticket_count || 0} tickets</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingEpic(epic);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEpic(epic.id)}
                                                    className="p-2 text-gray-400 hover:text-red-400 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {epics.length === 0 && <div className="text-gray-500 italic">No projects found.</div>}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeSection === 'release' && (
                <div className="space-y-6 animate-fade-in">
                    <h2 className="text-xl font-semibold text-white">AI Release Notes Generator</h2>

                    <div className="bg-gray-800/50 p-6 rounded-xl border border-white/10 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    value={reportPeriod.start}
                                    onChange={e => setReportPeriod({ ...reportPeriod, start: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                                <input
                                    type="date"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    value={reportPeriod.end}
                                    onChange={e => setReportPeriod({ ...reportPeriod, end: e.target.value })}
                                />
                            </div>
                            <button
                                onClick={handleFetchReport}
                                disabled={fetchingReport}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all disabled:opacity-50"
                            >
                                {fetchingReport ? 'Fetching...' : 'Fetch Active Tickets'}
                            </button>
                        </div>

                        {reportTickets.length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium text-white italic">Tickets Found ({reportTickets.length})</h3>
                                    <button
                                        onClick={handleGenerateNotes}
                                        disabled={generatingNotes}
                                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50"
                                    >
                                        ✨ {generatingNotes ? 'Generating...' : 'Generate AI Release Notes'}
                                    </button>
                                </div>
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                    {reportTickets.map(t => (
                                        <div key={t.id} className="bg-black/30 p-3 rounded-lg border border-white/5 flex gap-4 items-center">
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-center ${t.type === 'bug' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                    {t.type}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-center ${t.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                                    {t.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{t.title}</p>
                                                <div className="flex gap-2">
                                                    {t.epic_title && <p className="text-[10px] text-gray-400">Project: {t.epic_title}</p>}
                                                    {t.type === 'bug' && t.created_by_username && (
                                                        <p className="text-[10px] text-indigo-400">By: {t.created_by_username}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                                {format(new Date(t.updated_at), 'MMM d')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}



                        {generatedNotes && (
                            <div className="space-y-4 pt-6 border-t border-indigo-500/30">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-medium text-indigo-400 font-black uppercase tracking-widest">Release Notes Preview</h3>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="text"
                                            placeholder="v1.0.0"
                                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-white text-sm"
                                            value={releaseVersion}
                                            onChange={e => setReleaseVersion(e.target.value)}
                                        />
                                        <button
                                            onClick={handlePublishClick}
                                            disabled={publishing}
                                            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm shadow-lg disabled:opacity-50"
                                        >
                                            🚀 Publish Release
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(generatedNotes);
                                                alert('Copied to clipboard!');
                                            }}
                                            className="text-xs text-indigo-400 hover:text-white transition-colors"
                                        >
                                            Copy HTML
                                        </button>
                                    </div>
                                </div>
                                <div
                                    className="bg-gray-900 border border-indigo-500/20 p-6 rounded-xl prose prose-invert max-w-none shadow-2xl"
                                    dangerouslySetInnerHTML={{ __html: generatedNotes }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
};

export default AdminPanel;
