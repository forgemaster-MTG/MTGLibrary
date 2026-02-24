import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import Membership from '../Settings/Membership';
import { Sparkles } from 'lucide-react';
import { GeminiService } from '../../services/gemini';
import { archetypeService } from '../../services/ArchetypeService';

const AccountSettings = () => {
    const { user, userProfile, updateProfileFields, resetPassword, sendVerification } = useAuth();

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [avatar, setAvatar] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    const [saving, setSaving] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [generatingAI, setGeneratingAI] = useState(false);
    const [customAvatarPrompt, setCustomAvatarPrompt] = useState('');
    const [generatedAvatarCandidate, setGeneratedAvatarCandidate] = useState(null);
    const [pricingConfig, setPricingConfig] = useState(null);

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const data = await api.get('/api/admin/pricing');
                if (data.config) setPricingConfig(data.config);
            } catch (err) { console.error("Failed to load pricing for estimation"); }
        };
        fetchPricing();
    }, []);

    const initializedRef = React.useRef(null);
    useEffect(() => {
        if (userProfile && initializedRef.current !== userProfile.id) {
            setFirstName(userProfile.first_name || '');
            setLastName(userProfile.last_name || '');
            setUsername(userProfile.username || '');
            setBio(userProfile.data?.bio || '');
            setAvatar(userProfile.data?.avatar || '');
            setContactEmail(userProfile.contact_email || '');
            setIsPublic(userProfile.is_public_library || userProfile.settings?.is_public_library || false);
            initializedRef.current = userProfile.id;
        }
    }, [userProfile]);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await updateProfileFields({
                username,
                contact_email: contactEmail,
                first_name: firstName,
                last_name: lastName,
                is_public_library: isPublic,
                settings: {
                    ...(userProfile?.settings || {}),
                    playstyle: userProfile?.settings?.playstyle || userProfile?.data?.playstyle,
                    archetype: userProfile?.settings?.archetype || userProfile?.data?.organization?.mode
                },
                data: {
                    ...(userProfile?.data || {}),
                    bio,
                    avatar
                }
            });
            alert('Profile saved successfully!');
        } catch (error) {
            console.error('Failed to save profile:', error);
            alert('Error saving profile: ' + (error.message || 'Unknown error'));
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

    const handleGenerateAIAvatar = async (quality = "quality") => {
        const cost = GeminiService.getImagenCost(quality, pricingConfig?.assumptions || {});
        if (!confirm(`Forging a new avatar costs approx. ${cost.toLocaleString()} credits. Proceed with ${quality === 'quality' ? 'Nano Banana Pro' : 'Nano Banana'}?`)) return;

        setGeneratingAI(true);
        try {
            // 1. Fetch Logo as base64
            const logoResponse = await fetch('/logo.png');
            const logoBlob = await logoResponse.blob();
            const logoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(logoBlob);
            });

            // 2. Fetch Collection & Analyze Archetype
            const collectionData = await api.get('/api/collection');
            const playstyle = userProfile?.data?.playstyle || 'Balanced';
            const arch = archetypeService.analyze(collectionData?.cards || collectionData || []);
            const archetypeTitle = arch?.title || 'Forge Traveler';

            // 3. Generate Image
            const generatedImage = await GeminiService.generateImagen(
                username,
                playstyle,
                archetypeTitle,
                logoBase64,
                userProfile,
                customAvatarPrompt,
                quality
            );

            // 4. Set Candidate for Review
            setGeneratedAvatarCandidate(generatedImage);

        } catch (error) {
            console.error('Failed to generate avatar:', error);
            alert('Error generating avatar: ' + (error.message || 'Unknown error'));
        } finally {
            setGeneratingAI(false);
            setCustomAvatarPrompt(''); // clear prompt after use
        }
    };

    const handleKeepAvatar = async () => {
        if (!generatedAvatarCandidate) return;
        setSaving(true);
        try {
            setAvatar(generatedAvatarCandidate);
            await updateProfileFields({
                data: {
                    ...(userProfile?.data || {}),
                    avatar: generatedAvatarCandidate
                }
            });
            setGeneratedAvatarCandidate(null);
            alert('Avatar forged successfully!');
        } catch (error) {
            console.error('Failed to save generated avatar:', error);
            alert('Error saving avatar: ' + (error.message || 'Unknown error'));
        } finally {
            setSaving(false);
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

    return (
        <div className="space-y-8 animate-fade-in max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-6">
                Account Settings
            </h1>

            {/* Profile Section */}
            <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-white">Profile Information</h2>
                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className={`bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-primary-500/20 transition-all ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">First Name</label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">Last Name</label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username..."
                            className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">Contact Email</label>
                        <input
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-700 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Public Appearance</h3>

                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div>
                            <p className="font-medium text-gray-200">Public Library Access</p>
                            <p className="text-sm text-gray-400">Allow others to view your collection and decks via your profile.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPublic}
                                onChange={(e) => setIsPublic(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">Avatar</label>
                        <div className="flex flex-col space-y-4">
                            <div className="flex gap-4 items-center">
                                <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 border-2 border-primary-500 shadow-lg shadow-primary-500/20">
                                    {avatar ? (
                                        <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-xl font-bold">
                                            {username?.charAt(0) || '?'}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        value={avatar}
                                        onChange={(e) => setAvatar(e.target.value)}
                                        placeholder="https://example.com/avatar.jpg"
                                        className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                    />
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            value={customAvatarPrompt}
                                            onChange={(e) => setCustomAvatarPrompt(e.target.value)}
                                            placeholder="Optional Custom Prompt (e.g., 'A fierce fire mage')"
                                            className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleGenerateAIAvatar('fast')}
                                                disabled={generatingAI}
                                                className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white text-[11px] font-bold py-2.5 px-3 rounded flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50"
                                                title={`~${GeminiService.getImagenCost('fast', pricingConfig?.assumptions || {}).toLocaleString()} credits`}
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                {generatingAI ? '...' : 'Fast AI'}
                                            </button>
                                            <button
                                                onClick={() => handleGenerateAIAvatar('quality')}
                                                disabled={generatingAI}
                                                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white text-[11px] font-bold py-2.5 px-3 rounded flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-900/20 disabled:opacity-50"
                                                title={`~${GeminiService.getImagenCost('quality', pricingConfig?.assumptions || {}).toLocaleString()} credits`}
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                {generatingAI ? '...' : 'Pro AI (4K)'}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 italic">
                                        * AI Generation uses dynamic credits based on market rates & references your playstyle.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-gray-400 block">Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Tell us about yourself..."
                            rows={3}
                            className="w-full bg-gray-900 border border-gray-700 p-2.5 rounded-lg text-gray-200 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                        />
                    </div>
                </div>
            </section>

            {/* Membership Section */}
            <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                <Membership />
            </section>

            {/* Security Section */}
            <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg space-y-6">
                <h2 className="text-xl font-semibold text-white">Security & Login</h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div>
                            <p className="font-medium text-gray-200">Email Address</p>
                            <p className="text-sm text-gray-400">{user?.email}</p>
                            {user && !user.emailVerified && (
                                <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-full border border-yellow-500/30 mt-1 inline-block">
                                    Unverified
                                </span>
                            )}
                            {user && user.emailVerified && (
                                <span className="text-[10px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded-full border border-green-500/30 mt-1 inline-block">
                                    Verified
                                </span>
                            )}
                        </div>
                        {!user?.emailVerified && (
                            <button
                                onClick={handleVerifyEmail}
                                disabled={verifyLoading}
                                className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
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
                            className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium disabled:opacity-50"
                        >
                            {resetLoading ? 'Sending...' : 'Reset Password'}
                        </button>
                    </div>
                </div>
            </section>

            {/* Avatar Preview Modal */}
            {generatedAvatarCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-gray-800 rounded-xl max-w-sm w-full p-6 border border-gray-700 shadow-2xl flex flex-col items-center">
                        <h3 className="text-xl font-bold text-white mb-2">Review Avatar</h3>
                        <p className="text-gray-400 text-sm text-center mb-6">
                            Your new Forge profile picture has been forged. Do you want to keep this avatar?
                        </p>

                        <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-primary-500 shadow-lg mb-6">
                            <img src={generatedAvatarCandidate} alt="Generated Preview" className="w-full h-full object-cover" />
                        </div>

                        <div className="flex gap-4 w-full">
                            <button
                                onClick={() => setGeneratedAvatarCandidate(null)}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleKeepAvatar}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    'Keep Avatar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountSettings;
