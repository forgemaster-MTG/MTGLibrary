import React, { useState, useEffect } from 'react';
import { communityService } from '../../services/communityService';
import { useAuth } from '../../contexts/AuthContext';
import QRCode from 'react-qr-code';

const ShareModal = ({ isOpen, onClose, deck, onUpdateDeck }) => {
    const { user } = useAuth();
    const [permissions, setPermissions] = useState([]);
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPublic, setIsPublic] = useState(false);
    const [slug, setSlug] = useState('');
    const [copied, setCopied] = useState(false);

    // Form inputs
    const [selectedFriend, setSelectedFriend] = useState('');
    const [selectedLevel, setSelectedLevel] = useState('viewer');
    const [addLoading, setAddLoading] = useState(false);

    useEffect(() => {
        if (isOpen && deck) {
            loadData();
            setIsPublic(deck.is_public || false);
            setSlug(deck.share_slug || generateSlug(deck.name));
        }
    }, [isOpen, deck]);

    const generateSlug = (name) => {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // Load Permissions for this deck
            const perms = await communityService.fetchPermissions(deck.id);
            setPermissions(perms);

            // Load Friends (Pods) to populate dropdown
            const relationships = await communityService.fetchRelationships();
            const acceptedFriends = relationships
                .filter(r => r.status === 'accepted')
                .map(r => r.friend);
            setFriends(acceptedFriends);
        } catch (err) {
            console.error("Failed to load share data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async (e) => {
        e.preventDefault();
        if (!selectedFriend) return;
        setAddLoading(true);
        try {
            await communityService.grantPermission(selectedFriend, selectedLevel, deck.id);
            await loadData();
            setSelectedFriend('');
        } catch (err) {
            alert(`Failed to share: ${err.message}`);
        } finally {
            setAddLoading(false);
        }
    };

    const handleRevoke = async (id) => {
        try {
            await communityService.revokePermission(id);
            await loadData();
        } catch (err) {
            alert('Failed to revoke access.');
        }
    };

    const togglePublic = async () => {
        const newPublic = !isPublic;
        // Ensure slug exists if going public
        const activeSlug = slug || generateSlug(deck.name);

        try {
            await communityService.updateDeckPublicStatus(deck.id, newPublic, activeSlug);
            setIsPublic(newPublic);
            setSlug(activeSlug);
            // Notify parent
            onUpdateDeck({ ...deck, is_public: newPublic, share_slug: activeSlug });
        } catch (err) {
            alert('Failed to update public status.');
        }
    };

    const copyLink = () => {
        // Assume hosted URL or local dev URL
        const baseUrl = window.location.origin;
        // Route should handle /public/decks/:slug view or check community endpoints
        // Plan: /public/decks/:slug -> page to render ReadOnlyDeck
        // For now, let's assume route /share/:slug
        navigator.clipboard.writeText(`${baseUrl}/share/${slug}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-gray-900 border border-primary-500/20 rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-fade-in-up">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <h2 className="text-xl font-bold text-white mb-1">Share Deck</h2>
                <p className="text-sm text-gray-400 mb-6 truncate">{deck?.name}</p>

                {/* Public Link Section */}
                <div className="bg-primary-900/10 border border-primary-500/20 rounded-xl p-4 mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isPublic ? 'bg-green-500' : 'bg-gray-500'}`} />
                            <span className="font-bold text-gray-200">Public Link</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={isPublic} onChange={togglePublic} />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                        </label>
                    </div>

                    {isPublic && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={`${window.location.origin}/share/${slug}`}
                                    className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 select-all"
                                />
                                <button
                                    onClick={copyLink}
                                    className="px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>

                            {/* QR Code */}
                            <div className="flex justify-center p-4 bg-white rounded-xl w-fit mx-auto shadow-lg">
                                <QRCode
                                    value={`${window.location.origin}/share/${slug}`}
                                    size={128}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 128 128`}
                                />
                            </div>
                            <p className="text-center text-[10px] text-gray-400">Scan to view on mobile</p>
                        </div>
                    )}
                    <p className="text-[10px] text-gray-500 mt-2">
                        {isPublic ? "Anyone with this link can view this deck." : "Only people you explicitly add below can access this deck."}
                    </p>
                </div>

                {/* Specific Shares */}
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Add People</h3>

                <form onSubmit={handleShare} className="flex gap-2 mb-6">
                    <select
                        value={selectedFriend}
                        onChange={(e) => setSelectedFriend(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                        required
                    >
                        <option value="">Select a friend...</option>
                        {friends.map(f => (
                            <option key={f.id} value={f.id}>{f.username}</option>
                        ))}
                    </select>
                    <select
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                    >
                        <option value="viewer">Viewer</option>
                        <option value="contributor">Contributor</option>
                        <option value="editor">Editor</option>
                    </select>
                    <button
                        type="submit"
                        disabled={addLoading || !selectedFriend}
                        className="bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                    >
                        Add
                    </button>
                </form>

                {/* Access List */}
                <div className="space-y-4 max-h-[200px] overflow-y-auto">
                    {permissions.length === 0 ? (
                        <p className="text-center text-gray-500 text-xs italic py-4">No specific people have access.</p>
                    ) : (
                        permissions.map(perm => (
                            <div key={perm.id} className="flex justify-between items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary-900/50 flex items-center justify-center text-primary-300 text-xs font-bold">
                                        {perm.grantee_username?.[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-200">{perm.grantee_username}</div>
                                        <div className="text-xs text-gray-500 capitalize">{perm.permission_level}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRevoke(perm.id)}
                                    className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors"
                                >
                                    Remove
                                </button>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
};

export default ShareModal;
