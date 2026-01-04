import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { communityService } from '../../services/communityService';
import { useToast } from '../../contexts/ToastContext';
import { Disclosure } from '@headlessui/react';
import { ChevronUpIcon } from '@heroicons/react/24/solid';

import AccessControlGuideModal from './AccessControlGuideModal';

const ConnectionPermissionsModal = ({ isOpen, onClose, connection }) => {
    const { addToast } = useToast();
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [granting, setGranting] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);

    // Fetch existing permissions for this user
    useEffect(() => {
        if (isOpen && connection) {
            const load = async () => {
                setLoading(true);
                try {
                    // Fetch all permissions I've granted
                    const allPerms = await communityService.fetchPermissions();
                    // Filter for this specific grantee
                    const userPerms = (Array.isArray(allPerms) ? allPerms : []).filter(p => p.grantee_id === connection.friend.id);
                    setPermissions(userPerms);
                } catch (err) {
                    console.error(err);
                    addToast('Failed to load permissions', 'error');
                } finally {
                    setLoading(false);
                }
            };
            load();
        }
    }, [isOpen, connection]);

    const handleGrant = async (level) => {
        setGranting(true);
        try {
            await communityService.grantPermission(connection.friend.id, level, null); // Global scope (null deckId)
            addToast(`Global ${level} access granted`, 'success');

            // Reload
            const allPerms = await communityService.fetchPermissions();
            const userPerms = (Array.isArray(allPerms) ? allPerms : []).filter(p => p.grantee_id === connection.friend.id);
            setPermissions(userPerms);
        } catch (err) {
            console.error(err);
            addToast('Failed to update permission', 'error');
        } finally {
            setGranting(false);
        }
    };

    const handleRevoke = async (id) => {
        try {
            await communityService.revokePermission(id);
            addToast('Permission revoked', 'info');
            setPermissions(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error(err);
            addToast('Failed to revoke permission', 'error');
        }
    };

    if (!isOpen || !connection) return null;

    // Check if global permission exists
    const globalPerm = permissions.find(p => p.target_deck_id === null);

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" onClick={onClose} />
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-8 border-b border-white/5 bg-gradient-to-r from-gray-900 to-gray-950 flex justify-between items-start">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-3xl shadow-lg ring-4 ring-gray-900">
                            {connection.friend.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight">{connection.friend.username}</h2>
                            <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs mt-1">Manage Permissions</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">

                    {/* Explanation Section (Accordion) */}
                    <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl overflow-hidden">
                        <Disclosure>
                            {({ open }) => (
                                <>
                                    <Disclosure.Button className="flex justify-between w-full px-4 py-3 text-sm font-bold text-indigo-300 hover:text-indigo-200 transition-colors uppercase tracking-wider text-left">
                                        <span>What does Linking Accounts do?</span>
                                        <ChevronUpIcon
                                            className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-indigo-400`}
                                        />
                                    </Disclosure.Button>
                                    <Disclosure.Panel className="px-4 pb-4 text-sm text-indigo-200/80 leading-relaxed space-y-2">
                                        <p>Linking accounts allows you to share your Magic: The Gathering experience with trusted friends.</p>
                                        <ul className="list-disc pl-5 space-y-1 mt-2">
                                            <li><strong className="text-white">Sharing Decks:</strong> Friends can view your private decks to offer advice or clone them.</li>
                                            <li><strong className="text-white">Shared Collection:</strong> Combine your card pools visually to build decks together.</li>
                                            <li><strong className="text-white">Deck Editing:</strong> If granted <strong>Editor</strong> access, friends can actively tweak your deck lists (add/remove cards).</li>
                                        </ul>
                                        <p className="mt-2 text-xs italic opacity-70">Note: Friends can NEVER delete your decks or account, regardless of permission level.</p>
                                        <div className="pt-2 mt-2 border-t border-indigo-500/20">
                                            <a href="#" className="flex items-center gap-2 text-indigo-400 hover:text-white font-bold transition-colors" onClick={(e) => { e.preventDefault(); setIsGuideOpen(true); }}>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                                Read the Full Setup Guide
                                            </a>
                                        </div>
                                    </Disclosure.Panel>
                                </>
                            )}
                        </Disclosure>
                    </div>

                    {/* Global Access Level */}
                    <div>
                        <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Global Access Level</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Viewer Option */}
                            <button
                                onClick={() => handleGrant('viewer')}
                                disabled={granting}
                                className={`relative group p-5 rounded-2xl border-2 text-left transition-all duration-300 hover:shadow-xl ${globalPerm?.permission_level === 'viewer'
                                    ? 'bg-indigo-600/10 border-indigo-500 shadow-indigo-900/20'
                                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-500 hover:bg-gray-800'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-lg font-black ${globalPerm?.permission_level === 'viewer' ? 'text-indigo-400' : 'text-white'}`}>Viewer</span>
                                    {globalPerm?.permission_level === 'viewer' && <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Active</span>}
                                </div>
                                <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                                    Read-only access. Can view your <strong>private decks</strong>, <strong>binders</strong>, and <strong>collection</strong>. Cannot make changes.
                                </p>
                            </button>

                            {/* Editor Option */}
                            <button
                                onClick={() => handleGrant('editor')}
                                disabled={granting}
                                className={`relative group p-5 rounded-2xl border-2 text-left transition-all duration-300 hover:shadow-xl ${globalPerm?.permission_level === 'editor'
                                    ? 'bg-purple-600/10 border-purple-500 shadow-purple-900/20'
                                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-500 hover:bg-gray-800'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-lg font-black ${globalPerm?.permission_level === 'editor' ? 'text-purple-400' : 'text-white'}`}>Editor</span>
                                    {globalPerm?.permission_level === 'editor' && <span className="bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Active</span>}
                                </div>
                                <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                                    Full collaboration. Can <strong>edit your decks</strong>, add cards to your <strong>collection</strong>, and view everything.
                                </p>
                            </button>
                        </div>

                        {globalPerm && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={() => handleRevoke(globalPerm.id)}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Revoke All Access
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Separator */}
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

                    {/* Specific Deck Access (List) */}
                    <div>
                        <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Specific Deck Overrides</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar bg-gray-950/30 rounded-xl border border-white/5 p-2">
                            {permissions.filter(p => p.target_deck_id).length > 0 ? (
                                permissions.filter(p => p.target_deck_id).map(p => (
                                    <div key={p.id} className="flex justify-between items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center text-gray-500">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-gray-200 block">Deck #{p.target_deck_id.slice(0, 8)}...</span>
                                                <span className="text-xs text-gray-500 uppercase tracking-wider">{p.permission_level} Access</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRevoke(p.id)}
                                            className="text-gray-500 hover:text-red-400 p-2 hover:bg-white/5 rounded-lg transition-colors"
                                            title="Revoke Permission"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-gray-500">
                                    <p className="text-xs italic">No specific deck permissions granted.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                <div className="p-6 bg-gray-950 border-t border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white text-gray-900 hover:bg-gray-200 rounded-xl transition-colors font-bold text-sm shadow-xl"
                    >
                        Done
                    </button>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}} />

            {/* Nested Guide Modal */}
            <AccessControlGuideModal
                isOpen={isGuideOpen}
                onClose={() => setIsGuideOpen(false)}
            />
        </div>,
        document.body
    );
};

export default ConnectionPermissionsModal;
