import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { collectionService } from '../services/collectionService';
import ImportDataModal from '../components/modals/ImportDataModal';
import HelperSettingsModal from '../components/modals/HelperSettingsModal';
import OrganizationWizardModal from '../components/modals/OrganizationWizardModal';
import DeleteConfirmationModal from '../components/modals/DeleteConfirmationModal';
import CommunitySettingsTab from '../components/community/CommunitySettingsTab';
import AdminPanel from '../components/Settings/AdminPanel';
import Membership from '../components/Settings/Membership';

const SettingsPage = () => {
    const { user, userProfile, refreshUserProfile, resetPassword, sendVerification, updateProfileFields } = useAuth();
    const { tab } = useParams();
    const navigate = useNavigate();
    const activeTab = tab || 'account'; // Default to account tab
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isHelperModalOpen, setIsHelperModalOpen] = useState(false);
    const [isOrgWizardOpen, setIsOrgWizardOpen] = useState(false);

    // Deletion State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null); // 'decks', 'collection', 'wishlist', 'all'
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Form State
    const [geminiKey, setGeminiKey] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [gridSize, setGridSize] = useState('md');
    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);

    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        if (userProfile?.settings) {
            // Populate state from userProfile.settings
            if (userProfile.settings.geminiApiKey) setGeminiKey(userProfile.settings.geminiApiKey);
            if (userProfile.settings.viewMode) setViewMode(userProfile.settings.viewMode);
            if (userProfile.settings.gridSize) setGridSize(userProfile.settings.gridSize);
        }
        if (userProfile) {
            setUsername(userProfile.username || '');
            setFirstName(userProfile.first_name || '');
            setLastName(userProfile.last_name || '');
        }

        // Handle Subscription Return
        const success = searchParams.get('success');
        if (success === 'true') {
            const sync = async () => {
                try {
                    await api.post('/api/payments/sync-subscription');
                    await refreshUserProfile();
                    // Clear param
                    setSearchParams({});
                    alert('Subscription updated successfully!');
                } catch (e) {
                    console.error("Sync failed", e);
                }
            };
            sync();
        }
    }, [userProfile, searchParams, setSearchParams, refreshUserProfile]);

    const handleSave = async () => {
        if (!userProfile?.id) {
            alert('User profile not ready. Please try again.');
            return;
        }
        setSaving(true);
        try {
            const currentSettings = userProfile?.settings || {};
            const newSettings = {
                ...currentSettings,
                geminiApiKey: geminiKey,
                viewMode,
                gridSize
            };

            await api.updateUser(userProfile.id, { settings: newSettings });
            await refreshUserProfile(); // Reload profile to confirm
            alert('Settings saved!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Error saving settings: ' + (error.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateProfile = async () => {
        setSaving(true);
        try {
            await updateProfileFields({
                username,
                first_name: firstName,
                last_name: lastName
            });
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert('Error updating profile: ' + (error.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        setResetLoading(true);
        try {
            await resetPassword(user.email);
            alert('Password reset email sent!');
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setResetLoading(false);
        }
    };

    const handleVerifyEmail = async () => {
        setVerifyLoading(true);
        try {
            await sendVerification();
            alert('Verification email sent!');
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleExportCollection = async () => {
        try {
            const cards = await api.get('/api/collection/export');

            if (!cards || cards.length === 0) {
                alert('No cards to export.');
                return;
            }

            const dataStr = JSON.stringify({ cards, exported_at: new Date() }, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `mtg_collection_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export collection.');
        }
    };

    if (!user) return <div className="p-8 text-center text-gray-500">Please log in to view settings.</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                Settings
            </h1>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 overflow-x-auto">
                {['account', 'membership', 'general', 'community', 'ai', 'display', 'data', ...((user?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3' || userProfile?.settings?.isAdmin) ? ['admin'] : [])].map((t) => (
                    <button
                        key={t}
                        onClick={() => navigate(`/settings/${t}`)}
                        className={`px-6 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === t
                            ? 'border-indigo-500 text-indigo-400'
                            : 'border-transparent text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg min-h-[400px]">
                {activeTab === 'account' && (
                    <div className="space-y-8 animate-fade-in">
                        <section className="space-y-4">
                            <h2 className="text-xl font-semibold text-white">Profile Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm text-gray-400 block">First Name</label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-gray-400 block">Last Name</label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm text-gray-400 block">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username..."
                                    className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex justify-start">
                                <button
                                    onClick={handleUpdateProfile}
                                    disabled={saving}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    Update Profile
                                </button>
                            </div>
                        </section>

                        <section className="pt-6 border-t border-gray-700 space-y-4">
                            <h2 className="text-xl font-semibold text-white">Security & Account</h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                    <div>
                                        <p className="font-medium text-gray-200">Email Address</p>
                                        <p className="text-sm text-gray-400">{user.email}</p>
                                        {!user.emailVerified && (
                                            <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-full border border-yellow-500/30 mt-1 inline-block">
                                                Unverified
                                            </span>
                                        )}
                                        {user.emailVerified && (
                                            <span className="text-[10px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded-full border border-green-500/30 mt-1 inline-block">
                                                Verified
                                            </span>
                                        )}
                                    </div>
                                    {!user.emailVerified && (
                                        <button
                                            onClick={handleVerifyEmail}
                                            disabled={verifyLoading}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                                        >
                                            {verifyLoading ? 'Sending...' : 'Send Verification'}
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                    <div>
                                        <p className="font-medium text-gray-200">Password</p>
                                        <p className="text-sm text-gray-400">Change your account password</p>
                                    </div>
                                    <button
                                        onClick={handlePasswordReset}
                                        disabled={resetLoading}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium disabled:opacity-50"
                                    >
                                        {resetLoading ? 'Sending...' : 'Reset Password'}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'general' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-semibold text-white">App Preferences</h2>
                        {/* Onboarding Reset */}
                        <div className="pt-2">
                            <h3 className="text-sm font-medium text-gray-400 mb-2">Guided Experience</h3>
                            <button
                                onClick={async () => {
                                    if (window.confirm('This will restart the welcome tour. Continue?')) {
                                        await api.updateUser(userProfile.id, { settings: { ...userProfile.settings, onboarding_complete: false, onboarding_step: 0 } });
                                        await refreshUserProfile();
                                        navigate('/onboarding');
                                    }
                                }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg border border-gray-600 transition-colors text-sm font-medium"
                            >
                                Reset Onboarding Tour
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-start">
                            <h2 className="text-xl font-semibold text-white">AI Integrations</h2>
                            <span className="bg-indigo-900/50 text-indigo-300 text-xs px-2 py-1 rounded border border-indigo-700/50">Gemini</span>
                        </div>

                        <div className="space-y-4">
                            <p className="text-gray-400 text-sm">
                                To enable the AI Assistant and Deck Suggestions, you need a Google Gemini API Key.
                                Keys are stored securely in your user profile.
                            </p>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Gemini API Key</label>
                                <input
                                    type="password"
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    placeholder="Enter AI Key..."
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                                <div className="text-xs text-gray-500 flex justify-between">
                                    <span>Never share your API key.</span>
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline">
                                        Get a key from Google AI Studio &rarr;
                                    </a>
                                </div>
                            </div>
                        </div>


                        {/* AI Personas Section */}
                        <div className="pt-6 border-t border-gray-700">
                            <h3 className="text-lg font-semibold text-white mb-4">Personalization</h3>
                            <div className="flex flex-wrap gap-4">
                                <button
                                    onClick={() => setIsHelperModalOpen(true)}
                                    className="flex items-center gap-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-5 py-3 rounded-xl transition-all hover:shadow-lg hover:border-emerald-500 group"
                                >
                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                        🤖
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">Helper Settings</div>
                                        <div className="text-xs text-gray-400">Customize your AI companion</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'display' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-semibold text-white">Display Preferences</h2>

                        {/* Organization Profile */}
                        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 md:p-6 mb-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Organization Profile</h3>
                                    <p className="text-sm text-gray-400 mb-4">
                                        Current Mode: <span className="text-indigo-400 font-bold capitalize">{userProfile?.settings?.organization?.mode || 'Default'}</span>
                                    </p>
                                    <p className="text-xs text-gray-500 max-w-lg mb-4">
                                        Your organization profile determines how your collection is sorted and grouped by default.
                                    </p>
                                </div>
                                <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOrgWizardOpen(true)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                            >
                                Configure Organization...
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-3">Default View </label>
                                <div className="flex gap-4">
                                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                                        <input type="radio" name="viewMode" value="grid" checked={viewMode === 'grid'} onChange={() => setViewMode('grid')} className="text-indigo-500 focus:ring-indigo-500" />
                                        <span className="text-gray-200">Grid View</span>
                                    </label>
                                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${viewMode === 'table' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                                        <input type="radio" name="viewMode" value="table" checked={viewMode === 'table'} onChange={() => setViewMode('table')} className="text-indigo-500 focus:ring-indigo-500" />
                                        <span className="text-gray-200">Table View</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-3">Grid Size</label>
                                <select
                                    value={gridSize}
                                    onChange={(e) => setGridSize(e.target.value)}
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
                                >
                                    <option value="sm">Small</option>
                                    <option value="md">Medium</option>
                                    <option value="lg">Large</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'community' && (
                    <CommunitySettingsTab />
                )}

                {activeTab === 'data' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-semibold text-white">Data Management</h2>

                        {/* Collapsible Danger Zone */}
                        <details className="group border border-red-500/20 rounded-xl bg-red-500/5 open:bg-red-500/10 transition-colors">
                            <summary className="flex items-center justify-between p-4 cursor-pointer select-none">
                                <div className="flex items-center gap-2">
                                    <span className="text-red-500">⚠️</span>
                                    <h3 className="text-lg font-bold text-red-500 uppercase tracking-wide">Danger Zone</h3>
                                </div>
                                <div className="text-red-500 transform transition-transform group-open:rotate-180">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </summary>

                            <div className="p-4 pt-0 border-t border-red-500/10 mt-2">
                                <div className="space-y-4">
                                    <div className="p-4 border-b border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-white">Clear Wishlist</h4>
                                            <p className="text-sm text-gray-400">Permanently delete all items from your wishlist.</p>
                                        </div>
                                        <button
                                            onClick={() => { setDeleteTarget('wishlist'); setDeleteModalOpen(true); }}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            Clear Wishlist
                                        </button>
                                    </div>

                                    <div className="p-4 border-b border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-white">Delete All Decks</h4>
                                            <p className="text-sm text-gray-400">Delete all your decks. Cards will remain in your collection.</p>
                                        </div>
                                        <button
                                            onClick={() => { setDeleteTarget('decks'); setDeleteModalOpen(true); }}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            Delete Decks
                                        </button>
                                    </div>

                                    <div className="p-4 border-b border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-white">Delete Collection</h4>
                                            <p className="text-sm text-gray-400">Delete all cards. This will empty your decks.</p>
                                        </div>
                                        <button
                                            onClick={() => { setDeleteTarget('collection'); setDeleteModalOpen(true); }}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            Delete Collection
                                        </button>
                                    </div>

                                    <div className="p-4 bg-red-900/20 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-white">Delete Everything</h4>
                                            <p className="text-sm text-gray-400">Wipe your entire library: decks, cards, and wishlist.</p>
                                        </div>
                                        <button
                                            onClick={() => { setDeleteTarget('all'); setDeleteModalOpen(true); }}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-red-900/20"
                                        >
                                            Delete Everything
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </details>

                        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 mb-6">
                            <h3 className="text-yellow-500 font-bold mb-1 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                Important Note
                            </h3>
                            <p className="text-yellow-200/80 text-sm">
                                Backups include your collection data. Deck exports can be done from individual deck pages.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors">
                                <div>
                                    <h3 className="text-white font-medium">Export Collection</h3>
                                    <p className="text-gray-400 text-sm">Download a JSON backup of your entire card collection.</p>
                                </div>
                                <button
                                    onClick={handleExportCollection}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                >
                                    Export JSON
                                </button>
                            </div>

                            <div className="border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors">
                                <div>
                                    <h3 className="text-white font-medium">Import Data</h3>
                                    <p className="text-gray-400 text-sm">Restore from a backup or import cards. Supports Merge and Replace.</p>
                                </div>
                                <button
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-gray-600"
                                >
                                    Import...
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'membership' && (
                    <Membership />
                )}

                {activeTab === 'admin' && (user?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3' || userProfile?.settings?.isAdmin) && (
                    <AdminPanel />
                )}
            </div>

            {/* Import Modal */}
            <ImportDataModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                mode="global"
            />

            {/* Helper Settings Modal */}
            <HelperSettingsModal
                isOpen={isHelperModalOpen}
                onClose={() => setIsHelperModalOpen(false)}
            />

            {/* Organization Wizard */}
            <OrganizationWizardModal
                isOpen={isOrgWizardOpen}
                onClose={() => setIsOrgWizardOpen(false)}
                onComplete={() => {
                    setIsOrgWizardOpen(false);
                    refreshUserProfile();
                }}
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                targetName={deleteTarget ? deleteTarget.toUpperCase() : ''}
                title={
                    deleteTarget === 'all' ? 'Delete Everything?' :
                        deleteTarget === 'decks' ? 'Delete All Decks?' :
                            deleteTarget === 'collection' ? 'Delete Collection?' : 'Clear Wishlist?'
                }
                message={
                    deleteTarget === 'all' ? 'This will permanently delete ALL data associated with your account, including decks, cards, and wishlist. This cannot be undone.' :
                        deleteTarget === 'decks' ? 'This will delete all your deck lists. Your cards will be returned to your binder.' :
                            deleteTarget === 'collection' ? 'This will delete all cards in your collection. Your decks will remain but will be empty.' :
                                'This will remove all cards from your wishlist.'
                }
                onConfirm={async () => {
                    setDeleteLoading(true);
                    try {
                        await api.delete('/api/users/me/data', { data: { target: deleteTarget } });
                        window.location.reload();
                    } catch (err) {
                        console.error(err);
                        alert("Failed to delete data.");
                    } finally {
                        setDeleteLoading(false);
                        setDeleteModalOpen(false);
                    }
                }}
            />

            {/* Actions */}
            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div >
    );
};

export default SettingsPage;
