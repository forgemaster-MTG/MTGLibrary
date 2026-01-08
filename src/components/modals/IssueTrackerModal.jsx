import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import RichTextEditor from '../common/RichTextEditor';

const TicketItem = ({ ticket, isAdmin, currentUserId, onEdit, onDelete, onVote, getTypeBadge, getStatusBadge }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [publicNotes, setPublicNotes] = useState([]);

    useEffect(() => {
        // If expanded and has notes, fetch them for public view
        if (isExpanded && ticket.note_count > 0 && publicNotes.length === 0) {
            api.getTicketNotes(ticket.id).then(setPublicNotes).catch(console.error);
        }
    }, [isExpanded, ticket.note_count, ticket.id]);

    return (
        <div className="bg-gray-800/40 border border-white/5 rounded-lg p-4 hover:bg-gray-800/60 transition-colors group">
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                        {getTypeBadge(ticket.type)}
                        <h4
                            className="text-white font-medium hover:text-indigo-300 cursor-pointer truncate"
                            onClick={() => (isAdmin || (ticket.created_by === currentUserId && ticket.status === 'open')) && onEdit(ticket)}
                        >
                            {ticket.title}
                        </h4>
                        {getStatusBadge(ticket.status)}
                        {ticket.epic_title && <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 whitespace-nowrap">{ticket.epic_title}</span>}
                    </div>

                    <div
                        className={`text-sm text-gray-400 prose prose-invert prose-sm max-w-none w-full break-words [&>p]:mb-0 [&>ul]:list-none [&>ul]:pl-0 ${isExpanded ? '' : 'line-clamp-2'}`}
                        dangerouslySetInnerHTML={{ __html: ticket.description || '' }}
                    />

                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 hover:underline focus:outline-none"
                    >
                        {isExpanded ? 'Show less' : 'Read more...'}
                    </button>

                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span>b/{ticket.created_by_username || 'Unknown'}</span>
                        {ticket.assigned_to && <span className="text-indigo-400">Assigned: {ticket.assigned_to_username}</span>}
                        {ticket.due_date && <span>Due: {format(new Date(ticket.due_date), 'MMM d')}</span>}
                        {ticket.estimated_release_date && <span className="text-orange-400">Est. Release: {format(new Date(ticket.estimated_release_date), 'MMM d')}</span>}
                        {ticket.date_released && <span className="text-green-400">Released: {format(new Date(ticket.date_released), 'MMM d')}</span>}
                        {ticket.note_count > 0 && (
                            <span className="flex items-center gap-1 text-gray-400 bg-gray-700/50 px-1.5 py-0.5 rounded">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                                {ticket.note_count} {ticket.note_count === 1 ? 'Note' : 'Notes'}
                                {ticket.last_note_at && <span className="opacity-70 ml-1">• {format(new Date(ticket.last_note_at), 'MMM d, h:mm a')}</span>}
                            </span>
                        )}
                        {(isAdmin || (ticket.created_by === currentUserId && ticket.status === 'open')) && (
                            <div className="flex gap-3">
                                <button onClick={() => onEdit(ticket)} className="hover:text-white transition-colors">
                                    Edit {isAdmin && ticket.created_by !== currentUserId ? '(Admin)' : ''}
                                </button>
                                <button
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to delete this ticket?')) {
                                            onDelete(ticket.id);
                                        }
                                    }}
                                    className="text-gray-500 hover:text-red-400 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Public Notes Display (Expanded Only) */}
                    {isExpanded && publicNotes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                            <h5 className="text-xs font-bold text-gray-500 uppercase">Latest Notes</h5>
                            {publicNotes.map(note => (
                                <div key={note.id} className="bg-gray-900/30 p-2 rounded text-xs border border-white/5">
                                    <div className="flex justify-between text-gray-500 mb-0.5">
                                        <span className="font-bold text-indigo-400">{note.username}</span>
                                        <span>{format(new Date(note.created_at), 'MMM d, h:mm a')}</span>
                                    </div>
                                    <p className="text-gray-300 mb-0">{note.note}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-center gap-1 pl-4 border-l border-white/5 shrink-0">
                    <button onClick={() => onVote(ticket.id)} className="text-gray-400 hover:text-indigo-400">
                        ▲
                    </button>
                    <span className="font-mono text-sm font-bold text-white">{ticket.votes}</span>
                </div>
            </div>
        </div>
    );
};

const IssueTrackerModal = ({ isOpen, onClose }) => {
    const { user, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('issues'); // 'issues', 'projects', 'new_ticket'
    const [tickets, setTickets] = useState([]);
    const [epics, setEpics] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filter states
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // New Ticket Form
    const [newTicket, setNewTicket] = useState({ title: '', description: '', type: 'bug', epic_id: '' });

    // Admin: Edit Ticket State
    const [editingTicket, setEditingTicket] = useState(null);
    const [assignees, setAssignees] = useState([]);
    const [ticketNotes, setTicketNotes] = useState([]);
    const [newNote, setNewNote] = useState('');

    const isRoot = user?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
    // Use userProfile for DB-based permissions as 'user' object from Auth often lacks 'settings' until refresh
    const isAdmin = isRoot || userProfile?.settings?.isAdmin || userProfile?.settings?.permissions?.includes('manage_tickets');

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, activeTab]);

    useEffect(() => {
        if (isAdmin && isOpen) {
            const loadAssignees = async () => {
                try {
                    const data = await api.getAssignees();
                    setAssignees(data);
                } catch (e) { console.error(e); }
            };
            loadAssignees();
        }
    }, [isAdmin, isOpen]);

    useEffect(() => {
        if (editingTicket) {
            const loadNotes = async () => {
                try {
                    const notes = await api.getTicketNotes(editingTicket.id);
                    setTicketNotes(notes);
                } catch (e) { console.error(e); }
            };
            loadNotes();
        } else {
            setTicketNotes([]);
            setNewNote('');
        }
    }, [editingTicket]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'issues') {
                const params = {};
                if (statusFilter) params.status = statusFilter;
                if (typeFilter) params.type = typeFilter;
                const data = await api.getTickets(params);
                setTickets(data);
            } else if (activeTab === 'projects' || activeTab === 'new_ticket') {
                const data = await api.getEpics();
                setEpics(data);
                if (activeTab === 'new_ticket') {
                    // Pre-load tickets too if needed, but maybe strict separation is better
                }
            }
        } catch (err) {
            console.error('Failed to load data', err);
        } finally {
            setLoading(false);
        }
    };

    // Explicit refresh helper
    const refreshTickets = async () => {
        const params = {};
        if (statusFilter) params.status = statusFilter;
        if (typeFilter) params.type = typeFilter;
        const data = await api.getTickets(params);
        setTickets(data);
    }

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        try {
            await api.createTicket(newTicket);
            setNewTicket({ title: '', description: '', type: 'bug', epic_id: '' });
            setActiveTab('issues');
            // Refresh logic handled by useEffect dependency or manual call
            fetchData();
        } catch (err) {
            alert('Failed to create ticket: ' + err.message);
        }
    };

    const handleVote = async (id) => {
        try {
            await api.voteTicket(id);
            // Optimistic update
            setTickets(tickets.map(t => t.id === id ? { ...t, votes: (t.votes || 0) + 1 } : t));
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteTicket = async (id) => {
        try {
            await api.deleteTicket(id);
            setTickets(tickets.filter(t => t.id !== id));
        } catch (err) {
            console.error('Delete error:', err);
            alert('Failed to delete ticket: ' + err.message);
        }
    };

    const handleUpdateTicket = async (e) => {
        e.preventDefault();
        if (!editingTicket) return;
        try {
            await api.updateTicket(editingTicket.id, editingTicket);
            setEditingTicket(null);
            fetchData();
        } catch (err) {
            alert('Update failed: ' + err.message);
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) return;
        try {
            const added = await api.addTicketNote(editingTicket.id, newNote);
            setTicketNotes([...ticketNotes, added]);
            setNewNote('');
        } catch (err) {
            alert('Failed to add note: ' + err.message);
        }
    };

    // Render Helpers
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
            complete_pending: 'Complete - Pending Release',
            complete_scheduled: 'Complete - Release Scheduled',
            complete_blocked: 'Complete - Waiting on Epic',
            wont_fix: "Won't Fix"
        };

        return (
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${colors[status] || colors.open} uppercase tracking-wider whitespace-nowrap`}>
                {labels[status] || (status || 'open').replace(/_/g, ' ')}
            </span>
        );
    };

    const getTypeBadge = (type) => {
        return type === 'bug'
            ? <span className="text-red-400 font-mono text-xs">[BUG]</span>
            : <span className="text-cyan-400 font-mono text-xs">[FEAT]</span>;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

                <div className="relative z-50 inline-block align-bottom bg-gray-900 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full border border-white/10">

                    {/* Header */}
                    <div className="bg-gray-800/50 px-6 py-4 border-b border-white/5 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-indigo-500">⚡</span> System Status & Feedback
                        </h3>
                        <div className="flex items-center gap-4">
                            <a href="https://discord.gg/p4ybr8h6QV" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" /></svg>
                                Join Discord
                            </a>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="bg-gray-800/30 px-6 border-b border-white/5 flex gap-6 overflow-x-auto">
                        {['issues', 'projects', 'new_ticket'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                                    ? 'border-indigo-500 text-white'
                                    : 'border-transparent text-gray-400 hover:text-gray-300'
                                    }`}
                            >
                                {tab === 'issues' && 'Board & Issues'}
                                {tab === 'projects' && 'Projects (Epics)'}
                                {tab === 'new_ticket' && 'Review / Submit Issue'}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-6 min-h-[400px] max-h-[70vh] overflow-y-auto bg-gray-900">

                        {/* ISSUES TAB */}
                        {activeTab === 'issues' && (
                            <div className="space-y-6">
                                <div className="flex gap-4 mb-4">
                                    <select
                                        className="bg-gray-800 border border-white/10 rounded px-3 py-1 text-sm text-gray-300"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="open">Open</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="planned">Planned</option>
                                        <option value="completed">Completed</option>
                                        <option value="complete_pending">Pending Release</option>
                                        <option value="complete_scheduled">Release Scheduled</option>
                                        <option value="complete_blocked">Waiting on Epic</option>
                                        <option value="wont_fix">Won't Fix</option>
                                    </select>
                                    <select
                                        className="bg-gray-800 border border-white/10 rounded px-3 py-1 text-sm text-gray-300"
                                        value={typeFilter}
                                        onChange={(e) => setTypeFilter(e.target.value)}
                                    >
                                        <option value="">All Types</option>
                                        <option value="bug">Bugs</option>
                                        <option value="feature">Features</option>
                                    </select>
                                    <button onClick={fetchData} className="text-xs text-indigo-400 hover:text-indigo-300 underline">Refresh</button>
                                </div>

                                {loading ? (
                                    <div className="text-center py-12 text-gray-500">Loading issues...</div>
                                ) : tickets.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-xl">
                                        No tickets found. <button onClick={() => setActiveTab('new_ticket')} className="text-indigo-400 hover:underline">Create one?</button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {tickets.map(ticket => (
                                            <TicketItem
                                                key={ticket.id}
                                                ticket={ticket}
                                                isAdmin={isAdmin}
                                                currentUserId={userProfile?.id}
                                                onEdit={setEditingTicket}
                                                onDelete={handleDeleteTicket}
                                                onVote={handleVote}
                                                getTypeBadge={getTypeBadge}
                                                getStatusBadge={getStatusBadge}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PROJECTS TAB */}
                        {activeTab === 'projects' && (
                            <div className="space-y-6">
                                <p className="text-gray-400 text-sm">Large scale projects and goals for the platform.</p>
                                {/* Simple List for now */}
                                {epics.map(epic => (
                                    <div key={epic.id} className="bg-gray-800 p-4 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-lg font-bold text-white">{epic.title}</h4>
                                            <span className={`text-xs px-2 py-1 rounded bg-gray-700 text-gray-300`}>{epic.status}</span>
                                        </div>
                                        <div
                                            className="text-gray-400 text-sm mt-2 prose prose-invert prose-sm max-w-none w-full break-words [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4"
                                            dangerouslySetInnerHTML={{ __html: epic.description || '' }}
                                        />
                                        <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                                            {epic.ticket_count || 0} Tickets linked
                                        </div>
                                    </div>
                                ))}
                                {epics.length === 0 && <div className="text-gray-500 text-center py-8">No active projects. Admins can create them via API for now.</div>}
                            </div>
                        )}

                        {/* NEW TICKET TAB */}
                        {activeTab === 'new_ticket' && (
                            <div className="max-w-2xl mx-auto">
                                <form onSubmit={handleCreateTicket} className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Issue Type</label>
                                        <div className="flex gap-4">
                                            <label className={`flex-1 cursor-pointer p-4 rounded-xl border ${newTicket.type === 'bug' ? 'bg-red-500/10 border-red-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                                                <input type="radio" className="hidden" value="bug" checked={newTicket.type === 'bug'} onChange={e => setNewTicket({ ...newTicket, type: e.target.value })} />
                                                <div className="font-bold mb-1">Bug Report</div>
                                                <div className="text-xs opacity-70">Something is broken</div>
                                            </label>
                                            <label className={`flex-1 cursor-pointer p-4 rounded-xl border ${newTicket.type === 'feature' ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                                                <input type="radio" className="hidden" value="feature" checked={newTicket.type === 'feature'} onChange={e => setNewTicket({ ...newTicket, type: e.target.value })} />
                                                <div className="font-bold mb-1">Feature Request</div>
                                                <div className="text-xs opacity-70">New idea or improvement</div>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            placeholder="Short summary of the issue..."
                                            value={newTicket.title}
                                            onChange={e => setNewTicket({ ...newTicket, title: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                                        <div className="h-64">
                                            <RichTextEditor
                                                value={newTicket.description}
                                                onChange={val => setNewTicket({ ...newTicket, description: val })}
                                                placeholder="Detailed description, steps to reproduce, or link to screenshots..."
                                                type="Ticket"
                                                height="h-56"
                                            />
                                        </div>
                                    </div>

                                    {epics.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Project (Optional)</label>
                                            <select
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                                value={newTicket.epic_id}
                                                onChange={e => setNewTicket({ ...newTicket, epic_id: e.target.value })}
                                            >
                                                <option value="">- None -</option>
                                                {epics.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-4">
                                        <button
                                            type="submit"
                                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all"
                                        >
                                            Submit Issue
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {editingTicket && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                    <div className="bg-gray-900 rounded-2xl max-w-3xl w-full p-8 border border-white/10 shadow-3xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">
                                {isAdmin ? 'Edit Ticket (Admin)' : 'Edit Your Ticket'}
                            </h3>
                            <button onClick={() => setEditingTicket(null)} className="text-gray-500 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleUpdateTicket} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Issue Type</label>
                                    <select
                                        className="w-full bg-gray-800 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 transition-colors"
                                        value={editingTicket.type}
                                        onChange={e => setEditingTicket({ ...editingTicket, type: e.target.value })}
                                    >
                                        <option value="bug">Bug Report</option>
                                        <option value="feature">Feature Request</option>
                                    </select>
                                </div>
                                {isAdmin && (
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Status</label>
                                        <select
                                            className="w-full bg-gray-800 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 transition-colors"
                                            value={editingTicket.status}
                                            onChange={e => setEditingTicket({ ...editingTicket, status: e.target.value })}
                                        >
                                            <option value="open">Open</option>
                                            <option value="planned">Planned</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="complete_pending">Complete - Pending Release</option>
                                            <option value="complete_scheduled">Complete - Release Scheduled</option>
                                            <option value="complete_blocked">Complete - Waiting on Epic</option>
                                            <option value="wont_fix">Won't Fix</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Title</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-800 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 transition-colors"
                                    value={editingTicket.title}
                                    onChange={e => setEditingTicket({ ...editingTicket, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Description</label>
                                <div className="h-64">
                                    <RichTextEditor
                                        value={editingTicket.description}
                                        onChange={val => setEditingTicket({ ...editingTicket, description: val })}
                                        placeholder="Update description..."
                                        type="Ticket"
                                        height="h-56"
                                    />
                                </div>
                            </div>

                            {isAdmin && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Project (Epic)</label>
                                            <select
                                                className="w-full bg-gray-800 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 transition-colors"
                                                value={editingTicket.epic_id || ''}
                                                onChange={e => setEditingTicket({ ...editingTicket, epic_id: e.target.value || null })}
                                            >
                                                <option value="">None</option>
                                                {epics.map(ep => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Assignee</label>
                                            <select
                                                className="w-full bg-gray-800 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 transition-colors"
                                                value={editingTicket.assigned_to || ''}
                                                onChange={e => setEditingTicket({ ...editingTicket, assigned_to: e.target.value || null })}
                                            >
                                                <option value="">- Unassigned -</option>
                                                {assignees.map(u => (
                                                    <option key={u.id} value={u.id}>{u.username}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Due Date</label>
                                            <input
                                                type="date"
                                                className="w-full bg-gray-800 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 transition-colors"
                                                value={editingTicket.due_date ? format(new Date(editingTicket.due_date), 'yyyy-MM-dd') : ''}
                                                onChange={e => setEditingTicket({ ...editingTicket, due_date: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Est. Completion</label>
                                            <input
                                                type="date"
                                                className="w-full bg-gray-800 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 transition-colors"
                                                value={editingTicket.est_completion_date ? format(new Date(editingTicket.est_completion_date), 'yyyy-MM-dd') : ''}
                                                onChange={e => setEditingTicket({ ...editingTicket, est_completion_date: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Est. Release</label>
                                            <input
                                                type="date"
                                                className="w-full bg-gray-800 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 transition-colors"
                                                value={editingTicket.estimated_release_date ? format(new Date(editingTicket.estimated_release_date), 'yyyy-MM-dd') : ''}
                                                onChange={e => setEditingTicket({ ...editingTicket, estimated_release_date: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Date Released</label>
                                            <input
                                                type="date"
                                                className="w-full bg-gray-800 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 transition-colors"
                                                value={editingTicket.date_released ? format(new Date(editingTicket.date_released), 'yyyy-MM-dd') : ''}
                                                onChange={e => setEditingTicket({ ...editingTicket, date_released: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Internal Notes Section */}
                            <div className="border-t border-white/10 pt-6 mt-6">
                                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Internal Notes</h4>
                                <div className="space-y-3 max-h-48 overflow-y-auto mb-4 custom-scrollbar">
                                    {ticketNotes.length === 0 && <p className="text-xs text-gray-600 italic">No notes yet.</p>}
                                    {ticketNotes.map(note => (
                                        <div key={note.id} className="bg-gray-800/50 p-3 rounded-xl border border-white/5">
                                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                <span className="font-bold text-indigo-400 uppercase tracking-widest">{note.username}</span>
                                                <span>{format(new Date(note.created_at), 'MMM d, h:mm a')}</span>
                                            </div>
                                            <p className="text-sm text-gray-300">{note.note}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 bg-gray-800 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 transition-colors"
                                        placeholder="Add a note..."
                                        value={newNote}
                                        onChange={e => setNewNote(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddNote(e))}
                                    />
                                    <button type="button" onClick={handleAddNote} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all">Add</button>
                                </div>
                            </div>
                            <div className="flex justify-end gap-4 pt-6">
                                <button type="button" onClick={() => setEditingTicket(null)} className="px-6 py-3 text-gray-500 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IssueTrackerModal;
