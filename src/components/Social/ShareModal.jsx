import React, { useState, useEffect } from 'react';
import { communityService } from '../../services/communityService';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const ShareModal = ({ isOpen, onClose, deck, onUpdateDeck }) => {
    const { addToast } = useToast();
    const { currentUser } = useAuth();
    const [isPublic, setIsPublic] = useState(deck?.is_public || false);
    const [shareSlug, setShareSlug] = useState(deck?.shareSlug || '');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [permissions, setPermissions] = useState([]);
    const [permissionsLoading, setPermissionsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && deck) {
            setIsPublic(deck.is_public);
            setShareSlug(deck.shareSlug || '');
            fetchPermissions();
        }
    }, [isOpen, deck]);

    const fetchPermissions = async () => {
        if (!deck?.id) return;
        setPermissionsLoading(true);
        try {
            const perms = await communityService.fetchPermissions(deck.id);
            setPermissions(perms || []);
        } catch (error) {
            console.error("Failed to fetch permissions", error);
        } finally {
            setPermissionsLoading(false);
        }
    };

    const handleTogglePublic = async () => {
        setLoading(true);
        try {
            const newValue = !isPublic;
            // Generate a slug if one doesn't exist and we're making it public
            let newSlug = shareSlug;
            if (newValue && !newSlug) {
                const randomStr = Math.random().toString(36).substring(2, 8);
                newSlug = `${deck.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomStr}`;
            }

            await communityService.updateDeckPublicStatus(deck.id, newValue, newSlug);
            setIsPublic(newValue);
            setShareSlug(newSlug);

            if (onUpdateDeck) {
                onUpdateDeck({ is_public: newValue, shareSlug: newSlug });
            }

            addToast(`Binder is now ${newValue ? 'Public' : 'Private'}`, 'success');
        } catch (error) {
            console.error(error);
            addToast('Failed to update status', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        try {
            // This assumes sendRequest handles deck-specific invites or generic friend requests
            // For Binders Phase 2, we might want specific "Grant Permission" logic.
            // As per communityService.js, sendRequest is for relationships (friend requests).
            // grantPermission is for specific access.
            // We need a way to resolved email -> userId to use grantPermission, OR send an invite.
            // For now, let's assume we send a 'binder_invite' request type if supported, otherwise just friend request.
            // But per plan, we want to Share Binder.
            // Let's implement a direct permission grant if we can resolve user, otherwise it requires a lookup.

            // NOTE: Since we don't have a reliable email->uid lookup exposed in communityService yet without backend changes,
            // we will simulate this or use a hypothetical method.
            // Assuming we ask user to copy link if public.

            addToast('Direct invites via email coming in next update. Please use the public link.', 'info');

        } catch (error) {
            addToast('Failed to send invite', 'error');
        } finally {
            setLoading(false);
            setEmail('');
        }
    };

    const copyLink = () => {
        const url = `${window.location.origin}/share/${shareSlug}`;
        navigator.clipboard.writeText(url);
        addToast('Link copied to clipboard!', 'success');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden relative">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">🌍</span>
                        Share "{deck?.name}"
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Public Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700">
                        <div>
                            <div className="font-bold text-white">Public Link access</div>
                            <div className="text-xs text-gray-400">Anyone with the link can view cards</div>
                        </div>
                        <button
                            onClick={handleTogglePublic}
                            disabled={loading}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${isPublic ? 'bg-indigo-600' : 'bg-gray-600'}`}
                        >
                            <span className={`${isPublic ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>

                    {/* Link Display */}
                    {isPublic && (
                        <div className="animate-fade-in">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Public Link</label>
                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={`${window.location.origin}/share/${shareSlug}`}
                                    className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <button
                                    onClick={copyLink}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}

                    {!isPublic && (
                        <div className="p-4 bg-yellow-900/10 border border-yellow-500/20 rounded-xl text-yellow-200 text-sm flex gap-3">
                            <div className="text-xl">🔒</div>
                            <div>
                                This binder is currently <strong>Private</strong>. Only you can see it.
                            </div>
                        </div>
                    )}

                    {/* Direct Invites - Future Phase */}
                    {/* 
                    <div className="opacity-50">
                        <div className="flex items-center justify-between mb-4">
                             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Shared With</h3>
                             <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-500 border border-gray-700">COMING SOON</span>
                        </div>
                        ... list of permissions ...
                    </div>
                    */}

                </div>
            </div>
        </div>
    );
};

export default ShareModal;
