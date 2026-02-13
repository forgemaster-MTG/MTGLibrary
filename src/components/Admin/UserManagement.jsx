import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { getTierConfig } from '../../config/tiers';
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
            if (sortConfig.key === 'tier') {
                aVal = a.override_tier || a.subscription_tier || 'free';
                bVal = b.override_tier || b.subscription_tier || 'free';
            }

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

            // Calculate new AI Credits based on Tier
            const tierConfig = getTierConfig(effectiveTier);
            const aiCredits = tierConfig.limits.aiCredits;

            setUsers(users.map(u => u.id === selectedUserForSub.id ? { ...u, override_tier: newTier, subscription_tier: effectiveTier } : u));

            const payload = {
                user_override_tier: newTier,
                subscription_status: newTier ? 'active' : 'canceled',
                subscription_tier: effectiveTier,
                ai_credits: aiCredits
            };

            await api.updateUserPermissions(selectedUserForSub.id, selectedUserForSub.settings?.permissions, selectedUserForSub.settings?.isAdmin, payload);
            setShowSubModal(false); setSelectedUserForSub(null);
        } catch (err) { alert(err.message); fetchUsers(); }
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Are you sure you want to PERMANENTLY delete user ${user.username}? This cannot be undone.`)) return;
        try {
            await api.deleteUser(user.id);
            setUsers(users.filter(u => u.id !== user.id));
        } catch (err) { alert(err.message); }
    };

    return (
        <div className="p-4 md:p-8 min-h-screen bg-gray-950 text-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        User Management
                        {loading && <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Manage users, permissions, and subscription overrides.</p>
                </div>
                <div className="flex w-full md:w-auto gap-2">
                    <input
                        type="text"
                        placeholder="Filter by name / email / ID..."
                        className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-sm w-full md:w-80 focus:outline-none focus:border-indigo-500 transition-all font-medium"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    <button onClick={fetchUsers} className="p-2 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-900/80 text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-800">
                                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('id')}>ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('username')}>User {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('tier')}>Tier {sortConfig.key === 'tier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-3 px-4 text-center">Monthly / Top-Up</th>
                                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('card_count')}>Cards {sortConfig.key === 'card_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('deck_count')}>Decks {sortConfig.key === 'deck_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-3 px-4 cursor-pointer hover:text-white text-center" onClick={() => handleSort('created_at')}>Joined {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-3 px-4 cursor-pointer hover:text-white text-center" onClick={() => handleSort('last_active_at')}>Last Active {sortConfig.key === 'last_active_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-3 px-4 text-center">Permissions</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/30">
                            {sortedUsers.map((u, idx) => {
                                return (
                                    <tr key={u.id} className={`${idx % 2 === 0 ? 'bg-black/10' : 'bg-transparent'} hover:bg-white/5 transition-colors group`}>
                                        <td className="py-3 px-4 font-mono text-xs text-gray-500 tracking-tighter">#{u.id}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-sm tracking-tight">{u.username || 'Anonymous'}</span>
                                                <span className="text-gray-500 text-[10px] truncate max-w-[150px]">{u.email}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <button
                                                onClick={() => { setSelectedUserForSub(u); setShowSubModal(true); }}
                                                className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border transition-all ${u.override_tier ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-gray-800/50 text-gray-500 border-gray-700 hover:text-white hover:border-white/20'}`}
                                            >
                                                {u.override_tier || u.subscription_tier || 'free'}
                                                {u.override_tier && <span className="ml-1 text-[8px] text-purple-600">★</span>}
                                            </button>
                                        </td>
                                        <td className="py-3 px-4">
                                            {(() => {
                                                const effectiveTier = u.override_tier || u.subscription_tier || 'free';
                                                const isTrial = u.subscription_status === 'trial';
                                                const config = getTierConfig(
                                                    effectiveTier,
                                                    u.settings?.permissions,
                                                    { isTrial }
                                                );
                                                const monthlyLimit = config.limits.aiCredits;
                                                const formatK = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n;

                                                return (
                                                    <div className="flex flex-col items-center">
                                                        <div className="flex items-center gap-1" title="Monthly Tokens (Used / Limit)">
                                                            <span className="font-mono text-white text-xs font-bold leading-none">
                                                                {formatK(u.ai_credits_used || 0)}
                                                            </span>
                                                            <span className="text-gray-600 text-[10px]">/</span>
                                                            <span className="font-mono text-gray-500 text-xs">
                                                                {formatK(monthlyLimit)}
                                                            </span>
                                                        </div>
                                                        {u.credits_topup > 0 && (
                                                            <div className="flex items-center gap-1 mt-1" title="Top-Up Balance Remaining">
                                                                <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter">Top:</span>
                                                                <span className="font-mono text-yellow-500 text-xs">
                                                                    {formatK(u.credits_topup)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="py-3 px-4 text-center font-mono text-indigo-300">{u.card_count || 0}</td>
                                        <td className="py-3 px-4 text-center font-mono text-purple-300">{u.deck_count || 0}</td>
                                        <td className="py-3 px-4 text-center text-[10px] text-gray-500">
                                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs text-indigo-400 font-medium">
                                            {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => toggleAdmin(u)} title="Toggle Admin" className={`w-2.5 h-2.5 rounded-full ${u.settings?.isAdmin ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-gray-700'}`}></button>
                                                <button onClick={() => togglePermission(u, 'manage_tickets')} title="Toggle Ticket Mgr" className={`w-2.5 h-2.5 rounded-full ${u.settings?.permissions?.includes('manage_tickets') ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-700'}`}></button>
                                                <button onClick={() => togglePermission(u, 'bypass_tier_limits')} title="Toggle Feature Override" className={`w-2.5 h-2.5 rounded-full ${u.settings?.permissions?.includes('bypass_tier_limits') ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'bg-gray-700'}`}></button>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2 outline-none text-right">
                                                <button onClick={() => { localStorage.setItem('impersonate_user_id', u.id); window.location.href = '/dashboard'; }} className="text-[10px] bg-amber-900/30 hover:bg-amber-800 text-amber-400 border border-amber-700/50 px-2 py-1 rounded transition-colors">View</button>
                                                <button onClick={() => handleSyncUser(u)} disabled={syncingUser === u.id} className="text-[10px] bg-cyan-900/30 hover:bg-cyan-800 text-cyan-400 border border-cyan-700/50 px-2 py-1 rounded transition-colors disabled:opacity-50">Push FS</button>
                                                <button onClick={() => handleDeleteUser(u)} className="text-red-500 hover:text-red-400 p-1" title="Delete User">
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

                <div className="md:hidden space-y-4 p-4">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading Users...</div>
                    ) : sortedUsers.map(u => {
                        const isTicketMgr = u.settings?.permissions?.includes('manage_tickets');
                        const isBypass = u.settings?.permissions?.includes('bypass_tier_limits');
                        return (
                            <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-lg">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3">
                                        <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-lg border border-indigo-500/20">
                                            👤
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-base tracking-tight leading-tight">{u.username || 'Anonymous'}</div>
                                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">#{u.id} • {u.email || 'No Email'}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedUserForSub(u); setShowSubModal(true); }}
                                        className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${u.override_tier ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                                    >
                                        {u.override_tier || u.subscription_tier || 'free'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-black/40 p-4 rounded-xl border border-gray-800/50">
                                    <div className="space-y-1">
                                        <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Joined</p>
                                        <p className="text-gray-300 text-xs font-medium">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Last Seen</p>
                                        <p className="text-indigo-400 text-xs font-bold">{u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : 'Never'}</p>
                                    </div>
                                    <div className="space-y-1 border-t border-gray-800/50 pt-2">
                                        <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Collection</p>
                                        <p className="text-white text-xs font-mono">{u.card_count || 0} Cards • {u.deck_count || 0} Decks</p>
                                    </div>
                                    <div className="space-y-1 border-t border-gray-800/50 pt-2 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <div title="Admin" className={`w-2 h-2 rounded-full ${u.settings?.isAdmin ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-gray-800'}`}></div>
                                            <div title="Staff" className={`w-2 h-2 rounded-full ${isTicketMgr ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-800'}`}></div>
                                            <div title="Bypass" className={`w-2 h-2 rounded-full ${isBypass ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'bg-gray-800'}`}></div>
                                        </div>
                                        <p className="text-[9px] text-gray-600 uppercase font-bold mt-1">Status Flags</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                        onClick={() => { localStorage.setItem('impersonate_user_id', u.id); window.location.href = '/dashboard'; }}
                                        className="flex-1 min-w-[80px] bg-amber-600/10 hover:bg-amber-600/20 text-amber-500 border border-amber-600/30 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                                    >
                                        View
                                    </button>
                                    <button
                                        onClick={() => handleSyncUser(u)}
                                        disabled={syncingUser === u.id}
                                        className="flex-1 min-w-[80px] bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-500 border border-cyan-600/30 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                                    >
                                        {syncingUser === u.id ? 'Syncing...' : 'Push FS'}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(u)}
                                        className="bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/30 p-2.5 rounded-xl transition-all"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 0 00-1-1h-4a1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button onClick={() => toggleAdmin(u)} className={`text-[9px] uppercase font-black px-3 py-1.5 rounded-lg border transition-all ${u.settings?.isAdmin ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' : 'bg-gray-800 text-gray-600 border-gray-700'}`}>Admin</button>
                                    <button onClick={() => togglePermission(u, 'manage_tickets')} className={`text-[9px] uppercase font-black px-3 py-1.5 rounded-lg border transition-all ${isTicketMgr ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-gray-800 text-gray-600 border-gray-700'}`}>Staff</button>
                                    <button onClick={() => togglePermission(u, 'bypass_tier_limits')} className={`text-[9px] uppercase font-black px-3 py-1.5 rounded-lg border transition-all ${isBypass ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'bg-gray-800 text-gray-600 border-gray-700'}`}>Bypass</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <SubscriptionOverrideModal
                isOpen={showSubModal}
                user={selectedUserForSub}
                onClose={() => { setShowSubModal(false); setSelectedUserForSub(null); }}
                onConfirm={handleConfirmSubOverride}
            />
        </div>
    );
};

export default UserManagement;
