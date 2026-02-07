import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tradeService } from '../services/TradeService';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import AddTradeItemModal from '../components/Trades/AddTradeItemModal';
import ConfirmationModal from '../components/modals/ConfirmationModal';

const TradeDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [trade, setTrade] = useState(null);
    const [messages, setMessages] = useState([]);
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState({});
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [modalSource, setModalSource] = useState(null); // 'my' or 'partner'
    const [confirmation, setConfirmation] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    // Auto-scroll chat
    const chatEndRef = useRef(null);

    useEffect(() => {
        if (!userProfile?.id) return;
        fetchTrade();
    }, [id, userProfile]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchTrade = async () => {
        try {
            const data = await tradeService.getTradeDetails(id);
            setTrade(data.trade);
            setItems(data.items);
            setMessages(data.messages);
            const userMap = {};
            data.users.forEach(u => userMap[u.id] = u);
            setUsers(userMap);
        } catch (err) {
            console.error(err);
            alert('Failed to load trade details');
        } finally {
            setLoading(false);
        }
    };

    const openConfirmation = ({ title, message, onConfirm, isDangerous = false, confirmLabel = 'Confirm' }) => {
        setConfirmation({ isOpen: true, title, message, onConfirm, isDangerous, confirmLabel });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        try {
            await tradeService.sendMessage(id, newMessage);
            setNewMessage('');
            fetchTrade(); // Refresh to see message
        } catch (err) { alert('Failed to send'); }
    };

    const handleToggleAccept = async () => {
        const executeToggle = async () => {
            try {
                await tradeService.toggleAccept(id);
                fetchTrade();
            } catch (err) { alert(err.message); }
        };

        // Check for value mismatch if I am about to accept
        const myTotal = calculateTotal(myItems);
        const partnerTotal = calculateTotal(partnerItems);
        const diff = Math.abs(myTotal - partnerTotal);
        const maxTotal = Math.max(myTotal, partnerTotal);

        // Warning if moving from not-accepted to accepted
        const isMyAccepted = myId === trade.initiator_id ? trade.initiator_accepted : trade.receiver_accepted;

        if (!isMyAccepted && maxTotal > 0 && diff > (maxTotal * 0.10)) {
            openConfirmation({
                title: 'Value Mismatch Warning!',
                message: `Your Offer: $${myTotal.toFixed(2)}\nTheir Offer: $${partnerTotal.toFixed(2)}\nDifference: $${diff.toFixed(2)}\n\nAre you sure you want to accept?`,
                onConfirm: executeToggle,
                confirmLabel: 'Accept Anyway',
                isDangerous: true
            });
            return;
        }

        executeToggle();
    };

    const handleCompleteTrade = async () => {
        openConfirmation({
            title: 'Complete Trade',
            message: 'Finalize this trade? Items will be transferred immediately.',
            confirmLabel: 'Complete Trade',
            onConfirm: async () => {
                try {
                    await tradeService.completeTrade(id);
                    fetchTrade();
                } catch (err) { alert(err.message); }
            }
        });
    };

    const handleDeleteTrade = async () => {
        openConfirmation({
            title: 'Delete Trade',
            message: 'Are you sure you want to PERMANENTLY delete this trade? This cannot be undone.',
            confirmLabel: 'Delete Forever',
            isDangerous: true,
            onConfirm: async () => {
                try {
                    await tradeService.deleteTrade(id);
                    navigate('/trades'); // Redirect to trades list
                } catch (err) { alert(err.message); }
            }
        });
    };

    const handleStatusUpdate = async (status) => {
        openConfirmation({
            title: `${status.charAt(0).toUpperCase() + status.slice(1)} Trade`,
            message: `Are you sure you want to ${status} this trade?`,
            confirmLabel: status.charAt(0).toUpperCase() + status.slice(1),
            isDangerous: status === 'cancelled' || status === 'rejected',
            onConfirm: async () => {
                try {
                    await tradeService.updateStatus(id, status);
                    fetchTrade();
                } catch (err) { alert(err.message); }
            }
        });
    };

    const calculateTotal = (items) => items.reduce((sum, item) => sum + (Number(item.details?.prices?.usd) || 0) * (item.quantity || 1), 0);

    if (loading) return <div className="text-center py-20 animate-pulse text-indigo-400">Loading Negotiation...</div>;
    if (!trade) return <div className="text-center py-20">Trade not found.</div>;

    const myId = userProfile.id;
    const partnerId = trade.initiator_id === myId ? trade.receiver_id : trade.initiator_id;
    const partner = users[partnerId] || { username: 'Unknown' };

    const myItems = items.filter(i => i.user_id === myId);
    const partnerItems = items.filter(i => i.user_id === partnerId);

    const isPending = trade.status === 'pending';

    const handleAddItems = async (items) => {
        try {
            await tradeService.addItems(id, items);
            fetchTrade();
        } catch (err) {
            alert('Failed to add items: ' + err.message);
        }
    };

    // ... existing ...

    const isInitiator = trade.initiator_id === myId;
    const myAccepted = isInitiator ? trade.initiator_accepted : trade.receiver_accepted;
    const partnerAccepted = isInitiator ? trade.receiver_accepted : trade.initiator_accepted;

    const myTotal = calculateTotal(myItems);
    const partnerTotal = calculateTotal(partnerItems);
    const diff = myTotal - partnerTotal;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 h-[calc(100vh-80px)] flex flex-col">
            <AddTradeItemModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddItems}
                existingItems={new Set(items.filter(i => i.item_type === 'card' && i.user_id === (modalSource || myId)).map(i => i.item_id))}
                sourceUserId={modalSource || myId}
            />

            <ConfirmationModal
                isOpen={confirmation.isOpen}
                onClose={() => setConfirmation({ ...confirmation, isOpen: false })}
                onConfirm={() => {
                    if (confirmation.onConfirm) confirmation.onConfirm();
                    setConfirmation({ ...confirmation, isOpen: false });
                }}
                title={confirmation.title}
                message={<span className="whitespace-pre-line block">{confirmation.message}</span>}
                confirmLabel={confirmation.confirmLabel}
                isDangerous={confirmation.isDangerous}
            />

            {/* Header / Value Summary */}
            <div className="mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/trades')} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                Trade with {partner.username}
                                <span className={`text-xs px-2 py-0.5 rounded-full uppercase ${trade.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                    trade.status === 'accepted' ? 'bg-blue-500/20 text-blue-500' :
                                        trade.status === 'cancelled' ? 'bg-red-500/20 text-red-500' :
                                            'bg-yellow-500/20 text-yellow-500'
                                    }`}>{trade.status}</span>
                            </h1>
                            <div className="text-xs text-gray-400 font-mono">ID: #{trade.id} • {new Date(trade.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>

                {/* Value Bar */}
                <div className="grid grid-cols-3 gap-4 text-center bg-gray-900/50 p-3 rounded-lg">
                    <div>
                        <div className="text-xs text-gray-400 uppercase">Your Value</div>
                        <div className="text-xl font-bold text-indigo-400">${myTotal.toFixed(2)}</div>
                    </div>
                    <div className="flex flex-col justify-center items-center border-x border-gray-700/50">
                        <div className="text-xs text-gray-400 uppercase">Difference</div>
                        <div className={`text-lg font-bold ${Math.abs(diff) < 1 ? 'text-gray-400' : diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase">{partner.username}'s Value</div>
                        <div className="text-xl font-bold text-purple-400">${partnerTotal.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">

                {/* Left: My Offer */}
                <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden bg-gray-900 border border-gray-700 rounded-xl">
                    <div className={`p-4 border-b border-gray-700 flex justify-between items-center ${myAccepted ? 'bg-indigo-900/20' : ''}`}>
                        <h2 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                            Your Offer
                            {myAccepted && <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                        </h2>
                        {isPending && !items.some(i => i.item_type === 'deck') && (
                            <button
                                onClick={() => { setModalSource(null); setIsAddModalOpen(true); }}
                                className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded text-white"
                            >
                                + Add Items
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {myItems.length === 0 ? (
                            <div className="text-gray-500 text-center py-8 text-sm italic">No items offered yet.</div>
                        ) : (
                            myItems.map(item => (
                                <div key={item.id} className="bg-gray-800 p-3 rounded flex justify-between items-center group">
                                    <div>
                                        <div className="font-bold">{item.details?.name || 'Unknown Item'}</div>
                                        <div className="text-xs text-gray-400 flex gap-2">
                                            <span>{item.item_type}</span>
                                            {item.details?.set_code && <span>• {item.details.set_code.toUpperCase()}</span>}
                                            {item.details?.prices?.usd && <span className="text-green-400">• ${item.details.prices.usd}</span>}
                                        </div>
                                    </div>
                                    {isPending && (
                                        <button
                                            onClick={() => tradeService.removeItem(id, item.id).then(fetchTrade)}
                                            className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Center: Barter Controls */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* Chat Area (Compressed) */}
                    <div className="flex-1 bg-gray-900 border border-gray-700 rounded-xl flex flex-col overflow-hidden min-h-[300px]">
                        <div className="p-3 border-b border-gray-800 font-bold text-white text-sm">Negotiation</div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.user_id === myId ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[90%] rounded-lg p-2 text-xs ${msg.user_id === myId
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-800 text-gray-200'
                                        }`}>
                                        <div className="font-bold text-[10px] opacity-50 mb-0.5">{msg.username}</div>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <form onSubmit={handleSendMessage} className="p-2 border-t border-gray-800 bg-gray-800/50 flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Message..."
                                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            <button type="submit" className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </form>
                    </div>

                    {/* Action Panel */}
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col gap-3 shadow-xl">
                        {trade.status === 'completed' ? (
                            <div className="text-center py-4">
                                <div className="text-green-500 font-bold text-xl mb-2">Trade Completed</div>
                                <div className="text-sm text-gray-400">Items have been transferred.</div>
                            </div>
                        ) : trade.status === 'accepted' ? (
                            <div className="text-center">
                                <div className="text-blue-400 font-bold mb-4 animate-pulse">Agreed! Waiting for finalization.</div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={handleCompleteTrade}
                                        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-500/20 text-lg"
                                    >
                                        Complete Trade
                                    </button>
                                    <button
                                        onClick={handleToggleAccept}
                                        className="text-sm text-gray-400 hover:text-white underline"
                                    >
                                        Revoke Acceptance (Edit Items)
                                    </button>
                                </div>
                            </div>
                        ) : trade.status === 'pending' ? (
                            <>
                                <div className="flex justify-between items-center px-4 py-2 bg-gray-900 rounded-lg">
                                    <span className="text-sm text-gray-400">Your Status</span>
                                    <span className={`font-bold ${myAccepted ? 'text-green-500' : 'text-yellow-500'}`}>
                                        {myAccepted ? 'READY' : 'NOT READY'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center px-4 py-2 bg-gray-900 rounded-lg">
                                    <span className="text-sm text-gray-400">{partner.username}'s Status</span>
                                    <span className={`font-bold ${partnerAccepted ? 'text-green-500' : 'text-yellow-500'}`}>
                                        {partnerAccepted ? 'READY' : 'NOT READY'}
                                    </span>
                                </div>

                                <button
                                    onClick={handleToggleAccept}
                                    className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${myAccepted
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20'
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                        }`}
                                >
                                    {myAccepted ? 'Cancel Readiness' : 'Accept Trade'}
                                </button>

                                <div className="flex justify-center mt-2">
                                    <button
                                        onClick={() => handleStatusUpdate('cancelled')}
                                        className="text-xs text-red-500 hover:underline"
                                    >
                                        Cancel Trade Entirely
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-red-500 font-bold">Trade {trade.status}</div>
                        )}

                        {/* Delete Option */}
                        {((isInitiator && trade.status !== 'accepted') ||
                            (!isInitiator && ['cancelled', 'rejected', 'completed'].includes(trade.status))) && (
                                <div className="border-t border-gray-700 pt-3 mt-2 text-center">
                                    <button
                                        onClick={handleDeleteTrade}
                                        className="text-xs text-red-500 hover:text-red-400 hover:underline flex items-center justify-center gap-1 mx-auto"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Delete Trade
                                    </button>
                                </div>
                            )}
                    </div>
                </div>

                {/* Right: Their Offer */}
                <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden bg-gray-900 border border-gray-700 rounded-xl">
                    <div className={`p-4 border-b border-gray-700 flex justify-between items-center ${partnerAccepted ? 'bg-purple-900/20' : ''}`}>
                        <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                            {partner.username} Offers
                            {partnerAccepted && <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                        </h2>
                        {isPending && (
                            <button
                                onClick={() => { setModalSource(partnerId); setIsAddModalOpen(true); }}
                                className="text-xs bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-white"
                            >
                                + Browse Collection
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {partnerItems.length === 0 ? (
                            <div className="text-gray-500 text-center py-8 text-sm italic">No items offered yet.</div>
                        ) : (
                            partnerItems.map(item => (
                                <div key={item.id} className="bg-gray-800 p-3 rounded flex justify-between items-center">
                                    <div>
                                        <div className="font-bold">{item.details?.name || 'Unknown Item'}</div>
                                        <div className="text-xs text-gray-400 flex gap-2">
                                            <span>{item.item_type}</span>
                                            {item.details?.set_code && <span>• {item.details.set_code.toUpperCase()}</span>}
                                            {item.details?.prices?.usd && <span className="text-purple-400">• ${item.details.prices.usd}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TradeDetail;
