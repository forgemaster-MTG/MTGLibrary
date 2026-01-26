import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import GeminiUsageModal from '../../components/modals/GeminiUsageModal';
import HelperSettingsModal from '../../components/modals/HelperSettingsModal';
import OrganizationWizardModal from '../../components/modals/OrganizationWizardModal';
import { useNavigate } from 'react-router-dom';

const PreferencesSettings = () => {
    const { userProfile, refreshUserProfile } = useAuth();
    const navigate = useNavigate();

    // Stats
    const [viewMode, setViewMode] = useState('grid');
    const [gridSize, setGridSize] = useState('md');

    // AI
    const [geminiKeys, setGeminiKeys] = useState(['', '', '', '']);
    const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
    const [isHelperModalOpen, setIsHelperModalOpen] = useState(false);

    // Org
    const [isOrgWizardOpen, setIsOrgWizardOpen] = useState(false);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (userProfile?.settings) {
            if (userProfile.settings.viewMode) setViewMode(userProfile.settings.viewMode);
            if (userProfile.settings.gridSize) setGridSize(userProfile.settings.gridSize);

            if (userProfile.settings.geminiApiKeys) {
                const keys = [...userProfile.settings.geminiApiKeys];
                while (keys.length < 4) keys.push('');
                setGeminiKeys(keys.slice(0, 4));
            } else if (userProfile.settings.geminiApiKey) {
                setGeminiKeys([userProfile.settings.geminiApiKey, '', '', '']);
            }
        }
    }, [userProfile]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const currentSettings = userProfile?.settings || {};
            const newSettings = {
                ...currentSettings,
                geminiApiKey: geminiKeys[0],
                geminiApiKeys: geminiKeys,
                viewMode,
                gridSize
            };

            await api.updateUser(userProfile.id, { settings: newSettings });
            await refreshUserProfile();
            alert('Preferences saved!');
        } catch (error) {
            console.error('Failed to save preferences:', error);
            alert('Error saving preferences: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-6">
                App Preferences
            </h1>

            {/* Display Settings */}
            <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-white">Display & Interface</h2>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-indigo-500/20 transition-all ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                {/* Organization Profile */}
                <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 md:p-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">Default View </label>
                        <div className="flex gap-4">
                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-gray-900 border-gray-700 hover:border-gray-600 text-gray-400'}`}>
                                <input type="radio" name="viewMode" value="grid" checked={viewMode === 'grid'} onChange={() => setViewMode('grid')} className="sr-only" />
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                <span>Grid</span>
                            </label>
                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${viewMode === 'table' ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-gray-900 border-gray-700 hover:border-gray-600 text-gray-400'}`}>
                                <input type="radio" name="viewMode" value="table" checked={viewMode === 'table'} onChange={() => setViewMode('table')} className="sr-only" />
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                <span>Table</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">Grid Size</label>
                        <select
                            value={gridSize}
                            onChange={(e) => setGridSize(e.target.value)}
                            className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 w-full"
                        >
                            <option value="sm">Small</option>
                            <option value="md">Medium</option>
                            <option value="lg">Large</option>
                        </select>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-700">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Guided Experience</h3>
                    <button
                        onClick={async () => {
                            if (window.confirm('This will restart the welcome tour. Continue?')) {
                                // Preserve Keys
                                const apiKeys = userProfile.settings?.geminiApiKeys;
                                const singleKey = userProfile.settings?.geminiApiKey;

                                await api.updateUser(userProfile.id, {
                                    settings: {
                                        ...userProfile.settings,
                                        onboarding_complete: false,
                                        onboarding_step: 0,

                                        // Reset AI & Playstyle Data
                                        helper: null,
                                        playstyle_profile: null,
                                        ai_enabled: false,

                                        // Reset Organization Preference to Default
                                        organization: {
                                            mode: 'default',
                                            sortHierarchy: [],
                                            groupingPreference: 'set'
                                        },

                                        // Restore keys explicitly to prevent data loss
                                        geminiApiKeys: apiKeys,
                                        geminiApiKey: singleKey
                                    }
                                });
                                await refreshUserProfile();
                                navigate('/onboarding');
                            }
                        }}
                        className="w-full md:w-auto px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg border border-gray-600 transition-colors text-sm font-medium"
                    >
                        Reset Onboarding Tour
                    </button>
                </div>
            </section>

            {/* AI Section */}
            <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg space-y-6">
                <div className="flex justify-between items-start">
                    <h2 className="text-xl font-semibold text-white">AI Integrations</h2>
                    <span className="bg-indigo-900/50 text-indigo-300 text-xs px-2 py-1 rounded border border-indigo-700/50">Gemini</span>
                </div>

                <p className="text-gray-400 text-sm">
                    To enable the AI Assistant and Deck Suggestions, you need a Google Gemini API Key.
                    Keys are stored securely in your user profile.
                </p>

                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-gray-300">Google Gemini API Keys (Up to 4)</label>
                        <button
                            onClick={() => setIsUsageModalOpen(true)}
                            className="text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-500/30 transition-all font-bold"
                        >
                            View Usage & Costs
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {geminiKeys.map((key, idx) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Key {idx + 1} {idx === 0 ? '(Primary)' : ''}</span>
                                </div>
                                <input
                                    type="password"
                                    value={key}
                                    onChange={(e) => {
                                        const newKeys = [...geminiKeys];
                                        newKeys[idx] = e.target.value;
                                        setGeminiKeys(newKeys);
                                    }}
                                    placeholder={`Enter Key ${idx + 1}...`}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="text-xs text-gray-500 flex justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                        <span>Multiple keys enable automatic rotation when rate limits (429) are hit on free tiers.</span>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline">
                            Get more keys &rarr;
                        </a>
                    </div>
                </div>

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
            </section>

            {/* Modals */}
            <GeminiUsageModal isOpen={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} />
            <HelperSettingsModal isOpen={isHelperModalOpen} onClose={() => setIsHelperModalOpen(false)} />
            <OrganizationWizardModal isOpen={isOrgWizardOpen} onClose={() => setIsOrgWizardOpen(false)} onComplete={() => { setIsOrgWizardOpen(false); refreshUserProfile(); }} />
        </div>
    );
};

export default PreferencesSettings;
