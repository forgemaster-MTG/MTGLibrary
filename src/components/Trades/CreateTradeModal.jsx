import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { api } from '../../services/api'; // Use generic api for user search if needed
import { tradeService } from '../../services/TradeService';
import { communityService } from '../../services/communityService';
import { useAuth } from '../../contexts/AuthContext';

const CreateTradeModal = ({ isOpen, onClose, onCreated, preselectedPartnerId = null }) => {
    const { userProfile } = useAuth();
    const [step, setStep] = useState(1); // 1: Select User, 2: Initial Offer (Optional), 3: Confirm
    const [friends, setFriends] = useState([]);
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedFriend(null);
            setNotes('');

            const init = async () => {
                const friendList = await loadFriends();

                if (preselectedPartnerId) {
                    // Check if in friends list
                    const found = friendList.find(f => String(f.id) === String(preselectedPartnerId));
                    if (found) {
                        setSelectedFriend(found);
                    } else {
                        // Not a friend? Try to fetch public info or just use ID
                        try {
                            const publicProfile = await api.get(`/api/users/public/${preselectedPartnerId}`);
                            setSelectedFriend(publicProfile);
                        } catch (err) {
                            console.warn("Could not fetch partner profile, using ID");
                            setSelectedFriend({ id: preselectedPartnerId, username: `User #${preselectedPartnerId} (Unknown)` });
                        }
                    }
                }
            };
            init();
        }
    }, [isOpen, preselectedPartnerId]);

    const loadFriends = async () => {
        try {
            const rels = await communityService.fetchRelationships();
            const accepted = rels.filter(r => r.status === 'accepted').map(r => r.friend);
            setFriends(accepted);
            return accepted;
        } catch (err) {
            console.error(err);
            return [];
        }
    };

    const handleCreate = async () => {
        if (!selectedFriend) return;
        setLoading(true);
        try {
            await tradeService.createTrade({
                receiver_id: selectedFriend.id,
                notes,
                items: [] // Start empty, add items in detail view for better UX
            });
            onCreated();
            onClose();
        } catch (err) {
            alert('Failed to create trade: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-xl">
                    <Dialog.Title className="text-xl font-bold text-white mb-4">Start New Trade</Dialog.Title>

                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-gray-400 text-sm">Select a trade partner from your friends list.</p>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                {friends.length === 0 ? (
                                    <div className="text-gray-500 text-center py-4">No friends found. Add some friends first!</div>
                                ) : (
                                    friends.map(friend => (
                                        <button
                                            key={friend.id}
                                            onClick={() => setSelectedFriend(friend)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${selectedFriend?.id === friend.id ? 'bg-primary-900/30 border-primary-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'}`}
                                        >
                                            <span className="font-bold">{friend.username}</span>
                                            {selectedFriend?.id === friend.id && <span className="text-primary-400">Selected</span>}
                                        </button>
                                    ))
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-800">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Initial Note (Optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary-500 outline-none resize-none h-24"
                                    placeholder="Hey, interested in trading?"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!selectedFriend || loading}
                                    className="px-6 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg shadow-primary-500/20"
                                >
                                    {loading ? 'Creating...' : 'Start Trade'}
                                </button>
                            </div>
                        </div>
                    )}
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default CreateTradeModal;
