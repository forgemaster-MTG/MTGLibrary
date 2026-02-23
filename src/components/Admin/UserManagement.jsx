import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { getTierConfig } from '../../config/tiers';
import SubscriptionOverrideModal from '../Settings/SubscriptionOverrideModal';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [quickFilter, setQuickFilter] = useState('all');
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

    const filteredUsers = [...users].filter(u => {
        const matchesSearch =
            u.username?.toLowerCase().includes(filter.toLowerCase()) ||
            u.email?.toLowerCase().includes(filter.toLowerCase()) ||
            String(u.id).includes(filter);

        if (!matchesSearch) return false;

        if (quickFilter === 'all') return true;
        if (quickFilter === 'feedback') return u.marketing_opt_in;

        const now = new Date();
        const createdDate = u.created_at ? new Date(u.created_at) : null;
        const activeDate = u.last_active_at ? new Date(u.last_active_at) : null;

        const isToday = (date) => date && date.toDateString() === now.toDateString();
        const isThisWeek = (date) => {
            if (!date) return false;
            const diff = now - date;
            return diff < 7 * 24 * 60 * 60 * 1000;
        };

        if (quickFilter === 'joined_today') return isToday(createdDate);
        if (quickFilter === 'joined_week') return isThisWeek(createdDate);
        if (quickFilter === 'active_today') return isToday(activeDate);
        if (quickFilter === 'active_week') return isThisWeek(activeDate);

        return true;
    });

    const sortedUsers = filteredUsers.sort((a, b) => {
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

    const handleResetCredits = async (user) => {
        if (!window.confirm(`Force reset monthly credits for ${user.username} to their tier limit?`)) return;
        try {
            const res = await api.resetUserCredits(user.id);
            if (res.success) {
                alert(`Credits reset successfully!`);
                fetchUsers(); // Refresh list to see new values
            }
        } catch (err) { alert(`Error: ${err.message}`); }
    };

    return (
        <div className="p-0 md:p-2 lg:p-4 min-h-screen bg-gray-950 text-gray-100 w-full">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 bg-black/20 p-6 rounded-2xl border border-white/5">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
                        User Management
                        <span className="text-primary-500 text-sm bg-primary-500/10 px-2 py-0.5 rounded-md border border-primary-500/20 uppercase tracking-widest">{users.length}</span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Manage users, permissions, and subscription overrides.</p>
                </div>
                <div className="flex w-full md:w-auto gap-3 items-center">
                    {/* Simplified Quick Filter Chips */}
                    <div className="hidden lg:flex items-center gap-1.5 p-1 bg-gray-900/50 border border-gray-800 rounded-xl mr-2">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'joined_today', label: 'New Today' },
                            { id: 'joined_week', label: 'New Week' },
                            { id: 'active_today', label: 'Active Today' },
                            { id: 'feedback', label: 'Feedback' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setQuickFilter(f.id)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${quickFilter === f.id ? 'bg-primary-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Search..."
                            className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm w-full md:w-64 focus:outline-none focus:border-primary-500 transition-all font-medium pl-10"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                        <svg className="w-4 h-4 absolute left-4 top-3 text-gray-500 group-focus-within:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <button onClick={fetchUsers} className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 hover:border-gray-700 transition-all text-gray-400 hover:text-white shadow-lg active:scale-95">
                        <svg className={`w-5 h-5 ${loading ? 'animate-spin text-primary-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            {/* Sub-Filters / Advanced Selection */}
            <div className="flex flex-wrap gap-2 mb-6 lg:hidden">
                {[
                    { id: 'all', label: 'All Users' },
                    { id: 'joined_today', label: 'Joined Today' },
                    { id: 'joined_week', label: 'Joined Week' },
                    { id: 'active_today', label: 'Active Today' },
                    { id: 'active_week', label: 'Active Week' },
                    { id: 'feedback', label: 'Feedback' },
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => setQuickFilter(f.id)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${quickFilter === f.id ? 'bg-primary-600/20 text-primary-400 border border-primary-500/50' : 'bg-gray-900 text-gray-500 border border-gray-800'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex-1 w-full lg:min-w-0">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                            <tr className="bg-gray-900/80 text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-800">
                                <th className="py-5 px-6 cursor-pointer hover:text-white w-16" onClick={() => handleSort('id')}>ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-5 px-4 cursor-pointer hover:text-white w-1/4" onClick={() => handleSort('username')}>User {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-5 px-4 cursor-pointer hover:text-white text-center w-24" onClick={() => handleSort('tier')}>Tier {sortConfig.key === 'tier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-5 px-4 text-center w-32">AI Credits</th>
                                <th className="py-5 px-4 cursor-pointer hover:text-white text-center w-24" onClick={() => handleSort('card_count')}>Cards {sortConfig.key === 'card_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-5 px-4 cursor-pointer hover:text-white text-center w-24" onClick={() => handleSort('deck_count')}>Decks {sortConfig.key === 'deck_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-5 px-4 cursor-pointer hover:text-white text-center w-28" onClick={() => handleSort('created_at')}>Joined {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-5 px-4 cursor-pointer hover:text-white text-center w-28" onClick={() => handleSort('last_active_at')}>Active {sortConfig.key === 'last_active_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-5 px-4 text-center cursor-pointer hover:text-white w-16" onClick={() => handleSort('marketing_opt_in')}>FB {sortConfig.key === 'marketing_opt_in' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                <th className="py-5 px-4 text-center w-24">Status</th>
                                <th className="py-5 px-6 text-right w-48">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/30">
                            {sortedUsers.map((u, idx) => {
                                return (
                                    <tr key={u.id} className={`${idx % 2 === 0 ? 'bg-black/10' : 'bg-transparent'} hover:bg-white/5 transition-colors group border-b border-gray-800/10`}>
                                        <td className="py-2 px-6 font-mono text-[11px] text-gray-500 tracking-tighter">#{u.id}</td>
                                        <td className="py-2 px-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-[14px] tracking-tight group-hover:text-primary-400 transition-colors cursor-default">{u.username || 'Anonymous'}</span>
                                                <span className="text-gray-400 text-[11px] truncate max-w-[200px]">{u.email}</span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-4 text-center">
                                            <button
                                                onClick={() => { setSelectedUserForSub(u); setShowSubModal(true); }}
                                                className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border transition-all ${u.override_tier ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-gray-800/50 text-gray-500 border-gray-700 hover:text-white hover:border-white/20'}`}
                                            >
                                                {u.override_tier || u.subscription_tier || 'free'}
                                            </button>
                                        </td>
                                        <td className="py-2 px-4">
                                            {(() => {
                                                const effectiveTier = u.override_tier || u.subscription_tier || 'free';
                                                const isTrial = u.subscription_status === 'trial';
                                                const config = getTierConfig(effectiveTier, u.settings?.permissions, { isTrial });
                                                const monthlyLimit = config.limits.aiCredits;
                                                const formatK = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n;

                                                return (
                                                    <div className="flex flex-col items-center">
                                                        <div className="flex items-center gap-1" title="Monthly Tokens">
                                                            <span className="font-mono text-white text-[12px] font-bold">
                                                                {formatK(u.ai_credits_used || 0)}
                                                            </span>
                                                            <span className="text-gray-600 text-[10px]">/</span>
                                                            <span className="font-mono text-gray-500 text-[12px]">
                                                                {formatK(monthlyLimit)}
                                                            </span>
                                                        </div>
                                                        {u.credits_topup > 0 && (
                                                            <span className="text-[10px] text-yellow-500/80 font-bold tracking-tighter mt-0.5">
                                                                +{formatK(u.credits_topup)} Top
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="py-2 px-4 text-center font-mono text-[12px] text-primary-300 font-bold">{u.card_count || 0}</td>
                                        <td className="py-2 px-4 text-center font-mono text-[12px] text-purple-300 font-bold">{u.deck_count || 0}</td>
                                        <td className="py-2 px-4 text-center font-mono text-[11px] text-gray-400 whitespace-nowrap">
                                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="py-2 px-4 text-center font-mono text-[11px] text-gray-200 font-bold whitespace-nowrap">
                                            {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td className="py-2 px-4 text-center">
                                            {u.marketing_opt_in ? (
                                                <button
                                                    onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${u.email}&cc=support@mtg-forge.com&su=Feedback Request - MTG Forge`, '_blank')}
                                                    className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-green-500/20 text-green-400 border border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.3)] hover:scale-110 active:scale-95 transition-all"
                                                    title={`Contact ${u.username} for Feedback`}
                                                >
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                                </button>
                                            ) : (
                                                <span className="text-gray-800 text-[10px]">—</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* Interactive Toggles */}
                                                <button
                                                    onClick={() => toggleAdmin(u)}
                                                    title="Admin Status"
                                                    className={`w-7 h-3.5 rounded-full transition-colors relative ${u.settings?.isAdmin ? 'bg-primary-600 shadow-[0_0_8px_rgba(99,102,241,0.4)]' : 'bg-gray-800 border border-gray-700'}`}
                                                >
                                                    <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${u.settings?.isAdmin ? 'translate-x-3.5' : 'translate-x-0'}`} />
                                                </button>

                                                <button
                                                    onClick={() => togglePermission(u, 'manage_tickets')}
                                                    title="Staff / Ticket Mgr"
                                                    className={`w-7 h-3.5 rounded-full transition-colors relative ${u.settings?.permissions?.includes('manage_tickets') ? 'bg-green-600 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-800 border border-gray-700'}`}
                                                >
                                                    <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${u.settings?.permissions?.includes('manage_tickets') ? 'translate-x-3.5' : 'translate-x-0'}`} />
                                                </button>

                                                <button
                                                    onClick={() => togglePermission(u, 'bypass_tier_limits')}
                                                    title="Bypass Features"
                                                    className={`w-7 h-3.5 rounded-full transition-colors relative ${u.settings?.permissions?.includes('bypass_tier_limits') ? 'bg-pink-600 shadow-[0_0_8px_rgba(236,72,153,0.4)]' : 'bg-gray-800 border border-gray-700'}`}
                                                >
                                                    <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${u.settings?.permissions?.includes('bypass_tier_limits') ? 'translate-x-3.5' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-2 px-6 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => { localStorage.setItem('impersonate_user_id', u.id); window.location.href = '/dashboard'; }} className="text-[10px] font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400 p-1.5 transition-colors" title="View as User">View</button>
                                                <button onClick={() => handleSyncUser(u)} disabled={syncingUser === u.id} className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 hover:text-cyan-400 p-1.5 transition-colors disabled:opacity-50" title="Sync Firestore">Sync</button>
                                                <button onClick={() => handleDeleteUser(u)} className="text-gray-600 hover:text-red-500 p-1.5 transition-colors" title="Delete User">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 0 00-1-1h-4a1 0 00-1 1v3M4 7h16" /></svg>
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
                                        <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center text-lg border border-primary-500/20">
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
                                        <p className="text-primary-400 text-xs font-bold">{u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : 'Never'}</p>
                                    </div>
                                    <div className="space-y-1 border-t border-gray-800/50 pt-2">
                                        <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">Collection</p>
                                        <p className="text-white text-xs font-mono">{u.card_count || 0} Cards • {u.deck_count || 0} Decks</p>
                                    </div>
                                    <div className="space-y-1 border-t border-gray-800/50 pt-2 text-right">
                                        <div className="flex items-center gap-1.5 opacity-60">
                                            <div title="Admin" className={`w-1.5 h-1.5 rounded-full ${u.settings?.isAdmin ? 'bg-primary-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-gray-800'}`}></div>
                                            <div title="Staff" className={`w-1.5 h-1.5 rounded-full ${u.settings?.permissions?.includes('manage_tickets') ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-800'}`}></div>
                                            <div title="Bypass" className={`w-1.5 h-1.5 rounded-full ${u.settings?.permissions?.includes('bypass_tier_limits') ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'bg-gray-800'}`}></div>
                                            <div title="Feedback Opt-in" className={`w-1.5 h-1.5 rounded-full ${u.marketing_opt_in ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'bg-gray-800'}`}></div>
                                        </div>
                                        <p className="text-[8px] text-gray-600 uppercase font-black mt-1">Status</p>
                                    </div>

                                    {u.marketing_opt_in && (
                                        <button
                                            onClick={() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${u.email}&cc=support@mtg-forge.com&su=Feedback Request - MTG Forge`, '_blank')}
                                            className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 py-2 px-3 rounded-xl mt-3 text-green-400 group active:scale-95 transition-all"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Connect Feedback</span>
                                        </button>
                                    )}
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
                                        onClick={() => handleResetCredits(u)}
                                        className="flex-1 min-w-[80px] bg-primary-600/10 hover:bg-primary-600/20 text-primary-500 border border-primary-600/30 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(u)}
                                        className="bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/30 p-2.5 rounded-xl transition-all"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 0 00-1-1h-4a1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button onClick={() => toggleAdmin(u)} className={`text-[9px] uppercase font-black px-3 py-1.5 rounded-lg border transition-all ${u.settings?.isAdmin ? 'bg-primary-500/20 text-primary-400 border-primary-500/40' : 'bg-gray-800 text-gray-600 border-gray-700'}`}>Admin</button>
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
