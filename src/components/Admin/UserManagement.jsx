import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import SubscriptionOverrideModal from '../Settings/SubscriptionOverrideModal';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

    // Sync Action State
    const [syncingUser, setSyncingUser] = useState(null);

    // Sub Override State
    const [showSubModal, setShowSubModal] = useState(false);
    const [selectedUserForSub, setSelectedUserForSub] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const sortedUsers = [...users]
        .filter(u =>
            u.username?.toLowerCase().includes(filter.toLowerCase()) ||
            u.email?.toLowerCase().includes(filter.toLowerCase()) ||
            String(u.id).includes(filter)
        )
        .sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            // Handle nested or special keys
            if (sortConfig.key === 'tier') aVal = a.override_tier || a.subscription_tier || 'free';
            if (sortConfig.key === 'tier') bVal = b.override_tier || b.subscription_tier || 'free';

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    const toggleAdmin = async (user) => {
        if (!window.confirm(`Toggle ADMIN for ${user.username}?`)) return;
        try {
            const newStatus = !user.settings?.isAdmin;
            setUsers(users.map(u => u.id === user.id ? { ...u, settings: { ...u.settings, isAdmin: newStatus } } : u));
            await api.updateUserPermissions(user.id, user.settings?.permissions, newStatus);
        } catch (err) { alert('Failed'); fetchUsers(); }
    };

    const togglePermission = async (user, permission) => {
        try {
            const current = user.settings?.permissions || [];
            const newPerms = current.includes(permission) ? current.filter(p => p !== permission) : [...current, permission];
            setUsers(users.map(u => u.id === user.id ? { ...u, settings: { ...u.settings, permissions: newPerms } } : u));
            await api.updateUserPermissions(user.id, newPerms, user.settings?.isAdmin);
        } catch (err) { alert('Failed'); fetchUsers(); }
    };

    const handleSyncUser = async (user) => {
        if (!window.confirm(`Force push card collection for ${user.username}? Overwrites Firestore data.`)) return;
        setSyncingUser(user.id);
        try {
            const res = await fetch('/api/admin/sync-user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id })
            });
            const data = await res.json();
            if (data.success) alert(`Sync Complete! Upserted: ${data.stats.upserted}`);
            else alert(`Failed: ${data.error}`);
        } catch (err) { alert(`Error: ${err.message}`); } finally { setSyncingUser(null); }
    };

    const handleConfirmSubOverride = async (newTier) => {
        if (!selectedUserForSub) return;
        try {
            const effectiveTier = newTier || 'free';
            setUsers(users.map(u => u.id === selectedUserForSub.id ? { ...u, override_tier: newTier, subscription_tier: effectiveTier } : u));
            const payload = { user_override_tier: newTier, subscription_status: newTier ? 'active' : 'canceled', subscription_tier: effectiveTier };
            await api.updateUserPermissions(selectedUserForSub.id, selectedUserForSub.settings?.permissions, selectedUserForSub.settings?.isAdmin, payload);
            setShowSubModal(false); setSelectedUserForSub(null);
        } catch (err) { alert(err.message); fetchUsers(); }
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Are you sure you want to DELETE user "${user.username}"? This cannot be undone.`)) return;
        if (!window.confirm(`Double Check: DELETING "${user.username}" (${user.email}). Confirm?`)) return;

        try {
            await api.delete(`/api/users/${user.id}`);
            setUsers(users.filter(u => u.id !== user.id));
            alert('User deleted.');
        } catch (err) {
            console.error(err);
            alert('Failed to delete user: ' + err.message);
        }
    };

    return (
        <div className="space-y-4">
            <SubscriptionOverrideModal isOpen={showSubModal} onClose={() => setShowSubModal(false)} onConfirm={handleConfirmSubOverride} user={selectedUserForSub} />

            <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700">
                <input
                    type="text"
                    placeholder="Search users..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white w-64 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="text-sm text-gray-400">
                    Showing {sortedUsers.length} / {users.length} users
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-700 bg-gray-900/50">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-800 text-gray-400 text-xs uppercase font-bold text-center">
                            <th className="py-3 px-4 text-left cursor-pointer hover:text-white" onClick={() => handleSort('id')}>ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 text-left cursor-pointer hover:text-white" onClick={() => handleSort('username')}>User {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('tier')}>Sub {sortConfig.key === 'tier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('card_count')}>Cards {sortConfig.key === 'card_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('deck_count')}>Decks {sortConfig.key === 'deck_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('last_login')}>Last Active {sortConfig.key === 'last_login' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                            <th className="py-3 px-4">Permissions</th>
                            <th className="py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-800">
                        {loading ? <tr><td colSpan="8" className="p-8 text-center text-gray-500">Loading...</td></tr> : sortedUsers.map(u => {
                            const isTicketMgr = u.settings?.permissions?.includes('manage_tickets');
                            return (
                                <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="py-3 px-4 text-gray-500 text-xs text-center">{u.id}</td>
                                    <td className="py-3 px-4">
                                        <div className="font-bold text-white max-w-[150px] truncate" title={u.username}>{u.username || 'No Name'}</div>
                                        <div className="text-xs text-gray-500 max-w-[150px] truncate" title={u.email}>{u.email}</div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <button onClick={() => { setSelectedUserForSub(u); setShowSubModal(true); }} className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${u.override_tier ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' : 'bg-gray-800 text-gray-400 border-gray-600'}`}>
                                            {(u.override_tier || u.subscription_tier || 'free').replace('tier_', 'Tier ')}
                                        </button>
                                    </td>
                                    <td className="py-3 px-4 text-center font-mono text-indigo-300">{u.card_count || 0}</td>
                                    <td className="py-3 px-4 text-center font-mono text-purple-300">{u.deck_count || 0}</td>
                                    <td className="py-3 px-4 text-center text-xs text-gray-500">
                                        {u.last_login ? new Date(u.last_login).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => toggleAdmin(u)} title="Toggle Admin" className={`w-3 h-3 rounded-full ${u.settings?.isAdmin ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-gray-700'}`}></button>
                                            <button onClick={() => togglePermission(u, 'manage_tickets')} title="Toggle Ticket Mgr" className={`w-3 h-3 rounded-full ${isTicketMgr ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-700'}`}></button>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleSyncUser(u)}
                                                disabled={syncingUser === u.id}
                                                className="text-[10px] bg-cyan-900/30 hover:bg-cyan-800 text-cyan-400 border border-cyan-700/50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                            >
                                                {syncingUser === u.id ? 'Syncing...' : 'Push FS'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(u)}
                                                className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                                                title="Delete User"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 0 00-1-1h-4a1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : sortedUsers.map(u => {
                    const isTicketMgr = u.settings?.permissions?.includes('manage_tickets');
                    return (
                        <div key={u.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-white text-lg">{u.username || 'No Name'}</div>
                                    <div className="text-xs text-gray-500">{u.email}</div>
                                </div>
                                <div className="text-xs font-mono text-gray-500">#{u.id}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-900/50 p-3 rounded-lg">
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">Cards</p>
                                    <p className="font-mono text-indigo-400">{u.card_count || 0}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">Decks</p>
                                    <p className="font-mono text-purple-400">{u.deck_count || 0}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">Sub</p>
                                    <button onClick={() => { setSelectedUserForSub(u); setShowSubModal(true); }} className="text-xs text-gray-300 underline">
                                        {(u.override_tier || u.subscription_tier || 'free').replace('tier_', 'Tier ')}
                                    </button>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">Active</p>
                                    <p className="text-gray-300">{u.last_login ? new Date(u.last_login).toLocaleDateString() : '-'}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                                <div className="flex gap-3">
                                    <button onClick={() => toggleAdmin(u)} className={`text-xs px-2 py-1 rounded ${u.settings?.isAdmin ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-700 text-gray-400'}`}>Admin</button>
                                    <button onClick={() => togglePermission(u, 'manage_tickets')} className={`text-xs px-2 py-1 rounded ${isTicketMgr ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>Ticket Mgr</button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleSyncUser(u)}
                                        disabled={syncingUser === u.id}
                                        className="p-2 bg-cyan-900/30 text-cyan-400 rounded hover:bg-cyan-800"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(u)}
                                        className="p-2 bg-red-900/30 text-red-500 rounded hover:bg-red-800"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 0 00-1-1h-4a1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default UserManagement;
