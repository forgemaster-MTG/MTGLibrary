import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import StateHistoryModal from './modals/StateHistoryModal';
import { useAuth } from '../contexts/AuthContext';
import CardSearchModal from './CardSearchModal';
import PlaystyleWizardModal from './modals/PlaystyleWizardModal';
import PlaystyleProfileModal from './modals/PlaystyleProfileModal';
import BadgeSelectionModal from './modals/BadgeSelectionModal';
import { TIERS, TIER_CONFIG } from '../config/tiers';
import { useToast } from '../contexts/ToastContext';
import HelpCenterModal from './modals/HelpCenterModal';
import ForgeLensModal from './modals/ForgeLensModal';
import { api } from '../services/api';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const Navbar = () => {
    const location = useLocation();
    const { currentUser, userProfile, logout, updateSettings, refreshUserProfile, uploadProfilePicture } = useAuth();

    const { addToast } = useToast();
    const isLanding = location.pathname === '/';
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isForgeLensOpen, setIsForgeLensOpen] = useState(false);
    const [isPlaystyleWizardOpen, setIsPlaystyleWizardOpen] = useState(false);
    const [isPlaystyleProfileOpen, setIsPlaystyleProfileOpen] = useState(false);
    const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const fileInputRef = React.useRef(null);


    // Keyboard Shortcuts
    useKeyboardShortcuts([
        {
            key: 'k',
            modifiers: ['ctrl'],
            action: () => setIsSearchOpen(true)
        },
        {
            key: '/',
            modifiers: ['ctrl'],
            action: () => setIsHelpOpen(true)
        }
    ]);

    // Close user menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (isUserMenuOpen && !event.target.closest('#user-menu-button') && !event.target.closest('#user-menu-dropdown')) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isUserMenuOpen]);

    const handlePlaystyleUpdate = async (profile) => {
        console.log("Saving new playstyle:", profile);
        await updateSettings({ playstyle: profile });
        await refreshUserProfile();
        setIsPlaystyleProfileOpen(true);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        console.log('[Navbar] Starting file upload:', file.name, file.size, file.type);

        try {
            setIsUploading(true);
            console.log('[Navbar] Calling uploadProfilePicture...');
            const photoURL = await uploadProfilePicture(file);
            console.log('[Navbar] Upload successful! Photo URL:', photoURL);
            // Optional: Show success toast
            alert('Profile picture updated successfully!');
        } catch (error) {
            console.error('[Navbar] Upload failed:', error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            console.log('[Navbar] Upload complete, resetting state');
            setIsUploading(false);
            setIsUserMenuOpen(false);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const isMaster = currentUser?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';

    // Override display for Master
    const displayEmail = isMaster ? "FORGE MASTER" : (currentUser?.email || '');

    // Tier Badge Logic
    let tierBadge = null;
    const tier = userProfile?.subscription_tier;

    if (tier && tier !== 'free') {
        const config = TIER_CONFIG[tier];
        if (config) {
            tierBadge = {
                icon: '🛡️', // Default
                label: config.name,
                color: 'text-blue-400 border-blue-500/30 bg-blue-500/10'
            };

            // Custom icons/colors per tier
            if (tier === TIERS.TIER_1) tierBadge = { icon: '✨', label: 'Apprentice', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' };
            if (tier === TIERS.TIER_2) tierBadge = { icon: '🔮', label: 'Magician', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' };
            if (tier === TIERS.TIER_3) tierBadge = { icon: '🧙‍♂️', label: 'Wizard', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' };
            if (tier === TIERS.TIER_4) tierBadge = { icon: '⚡', label: 'Archmage', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' };
            if (tier === TIERS.TIER_5) tierBadge = { icon: '🪐', label: 'Planeswalker', color: 'text-red-400 border-red-500/30 bg-red-500/10' };
        }
    }

    const displayBadge = isMaster
        ? { icon: '👑', label: 'Architect', id: 'architect', color: 'text-amber-500 bg-amber-500/20 border-amber-500/50' }
        : (tierBadge || userProfile?.settings?.badge || { icon: '🧪', label: 'Alpha Tester', id: 'alpha_tester', color: 'text-gray-400 bg-gray-800 border-gray-700' });

    // Handle logout with redirect
    const handleLogout = async () => {
        try {
            await logout();
            window.location.href = '/'; // Force reload to clear state cleanly or use navigate('/')
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <>
            <nav className="bg-gray-950/30 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">

                        {/* Desktop Content */}
                        <div className="flex items-center justify-between w-full">
                            {/* Logo */}
                            <div className="flex-shrink-0 flex items-center gap-3">
                                <Link to="/" className="flex items-center gap-3 transform hover:scale-105 transition-transform">
                                    <img src="/logo.png" alt="MTG Forge Logo" className="h-10 w-auto" />

                                    {/* Mobile Badges (Right of Logo) */}
                                    <div className="flex flex-col gap-1 sm:hidden">
                                        <span className="bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse w-fit leading-none">
                                            ALPHA
                                        </span>
                                        {tier && tier !== 'free' && (() => {
                                            const config = TIER_CONFIG[tier];
                                            let badgeColor = 'text-gray-400 border-gray-600 bg-gray-800';

                                            if (tier === TIERS.TIER_1) badgeColor = 'text-blue-400 border-blue-500/30 bg-blue-500/10';
                                            if (tier === TIERS.TIER_2) badgeColor = 'text-purple-400 border-purple-500/30 bg-purple-500/10';
                                            if (tier === TIERS.TIER_3) badgeColor = 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
                                            if (tier === TIERS.TIER_4) badgeColor = 'text-orange-400 border-orange-500/30 bg-orange-500/10';
                                            if (tier === TIERS.TIER_5) badgeColor = 'text-red-400 border-red-500/30 bg-red-500/10';

                                            return (
                                                <span className={`border text-[9px] font-bold px-1.5 py-0.5 rounded leading-none uppercase w-fit ${badgeColor}`}>
                                                    {config?.name || 'MEMBER'}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    {/* Desktop Title & Badges */}
                                    <div className="hidden sm:flex flex-col justify-center">
                                        <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent leading-none pb-1">
                                            MTG-Forge
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse leading-none">
                                                ALPHA
                                            </span>
                                            {tier && tier !== 'free' && (() => {
                                                const config = TIER_CONFIG[tier];
                                                let badgeColor = 'text-gray-400 border-gray-600 bg-gray-800';

                                                if (tier === TIERS.TIER_1) badgeColor = 'text-blue-400 border-blue-500/30 bg-blue-500/10'; // Apprentice
                                                if (tier === TIERS.TIER_2) badgeColor = 'text-purple-400 border-purple-500/30 bg-purple-500/10'; // Magician
                                                if (tier === TIERS.TIER_3) badgeColor = 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'; // Wizard
                                                if (tier === TIERS.TIER_4) badgeColor = 'text-orange-400 border-orange-500/30 bg-orange-500/10'; // Archmage
                                                if (tier === TIERS.TIER_5) badgeColor = 'text-red-400 border-red-500/30 bg-red-500/10'; // Planeswalker

                                                return (
                                                    <span className={`border text-[9px] font-bold px-1.5 py-0.5 rounded leading-none uppercase ${badgeColor}`}>
                                                        {config?.name || 'MEMBER'}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </Link>
                            </div>

                            {/* Desktop Nav Links */}
                            <div className="hidden lg:ml-6 lg:flex lg:items-baseline lg:space-x-1">
                                {currentUser ? (
                                    <>
                                        <Link to="/dashboard" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Dashboard</Link>
                                        <Link to="/collection" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Collection</Link>
                                        <Link to="/wishlist" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Wishlist</Link>
                                        <Link to="/decks" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Decks</Link>
                                        <Link to="/binders" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Binders</Link>
                                        <Link to="/social" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Social</Link>
                                        <Link to="/precons" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Precons</Link>
                                        <Link to="/sets" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Sets</Link>
                                    </>
                                ) : (
                                    <>
                                        {isLanding ? (
                                            <>
                                                <a href="#features" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Features</a>
                                                <Link to="/about" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">About</Link>
                                            </>
                                        ) : (
                                            <>
                                                <Link to="/about" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">About</Link>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Right Side Actions */}
                            <div className="flex items-center gap-2 md:gap-4">
                                {currentUser && (
                                    <>
                                        <button
                                            onClick={() => setIsSearchOpen(true)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            <span className="hidden xl:inline">Add Card</span>
                                        </button>

                                        {/* Help Button */}
                                        <button
                                            onClick={() => setIsHelpOpen(true)}
                                            className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 hover:border-indigo-500 hover:text-white text-gray-400 flex items-center justify-center transition-all shadow-lg"
                                            title="Help Center"
                                        >
                                            <span className="font-bold text-lg">?</span>
                                        </button>
                                    </>
                                )}

                                {currentUser ? (
                                    <div className="relative">
                                        <div className="flex items-center gap-3">

                                            {/* Founder/Tier Badge */}
                                            <button
                                                onClick={() => setIsBadgeModalOpen(true)}
                                                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all group relative ${displayBadge.color || 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
                                                title={displayBadge.label || "Change Badge"}
                                            >
                                                <span className="text-base">{displayBadge.icon}</span>
                                                {isMaster && (
                                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                                                    </span>
                                                )}
                                            </button>

                                            <span className={`text-sm font-medium hidden xl:inline-block ${isMaster ? 'text-amber-400 font-bold tracking-wider' : 'text-gray-300 max-w-[150px] truncate'}`}>
                                                {displayEmail}
                                            </span>

                                            <button
                                                id="user-menu-button"
                                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                                className="text-gray-400 hover:text-white transition-colors focus:outline-none"
                                            >
                                                {userProfile?.photo_url || (currentUser.photoURL && !imageError) ? (
                                                    <img
                                                        src={userProfile?.photo_url || currentUser.photoURL}
                                                        alt="Profile"
                                                        className="h-8 w-8 rounded-full object-cover ring-2 ring-transparent hover:ring-indigo-500 transition-all border border-gray-600"
                                                        onError={() => setImageError(true)}
                                                    />
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center ring-2 ring-transparent hover:ring-indigo-500 transition-all">
                                                        <span className="text-xs font-bold text-indigo-300">
                                                            {currentUser.email ? currentUser.email[0].toUpperCase() : 'U'}
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        </div>

                                        {/* User Dropdown */}
                                        {isUserMenuOpen && (
                                            <div id="user-menu-dropdown" className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 border border-gray-700 ring-1 ring-black ring-opacity-5 animate-fade-in-up">
                                                <div className="px-4 py-2 border-b border-gray-700">
                                                    <p className="text-sm text-white font-bold">Account</p>
                                                    <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
                                                </div>

                                                <button
                                                    onClick={triggerFileInput}
                                                    disabled={isUploading}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                                                >
                                                    {isUploading ? 'Uploading...' : 'Upload Photo'}
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    accept="image/*"
                                                />

                                                <div className="border-t border-gray-700 my-1"></div>

                                                <button
                                                    onClick={() => {
                                                        setIsUserMenuOpen(false);
                                                        setIsPlaystyleProfileOpen(true);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                                                >
                                                    Playstyle Profile
                                                </button>

                                                <Link
                                                    to="/settings"
                                                    onClick={() => setIsUserMenuOpen(false)}
                                                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                                                >
                                                    Settings
                                                </Link>

                                                <div className="border-t border-gray-700 my-1"></div>

                                                <button
                                                    onClick={() => {
                                                        setIsUserMenuOpen(false);
                                                        setIsHistoryOpen(true);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                                                >
                                                    <span className="text-cyan-400">↺</span> History
                                                </button>

                                                <div className="border-t border-gray-700 my-1"></div>

                                                <button
                                                    onClick={() => {
                                                        setIsUserMenuOpen(false);
                                                        handleLogout();
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300"
                                                >
                                                    Sign Out
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <Link to="/login" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-indigo-500/20">
                                        Sign In
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </nav>

            <CardSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onOpenForgeLens={() => {
                    setIsSearchOpen(false);
                    setIsForgeLensOpen(true);
                }}
            />

            <ForgeLensModal
                isOpen={isForgeLensOpen}
                onClose={() => setIsForgeLensOpen(false)}
                onFinish={async (scannedBatch, options = {}) => {
                    if (!scannedBatch || scannedBatch.length === 0) return;

                    const apiMode = options.targetDeckId ? `deck:${options.targetDeckId}` : 'collection';
                    const payload = scannedBatch.map(c => ({
                        scryfall_id: c.scryfall_id,
                        name: c.name,
                        set_code: c.set_code,
                        collector_number: c.collector_number,
                        finish: c.finish,
                        quantity: c.quantity,
                        is_foil: c.finish === 'foil'
                    }));

                    try {
                        console.log("[Navbar] Adding batch via Forge Lens:", payload, apiMode);
                        await api.batchAddToCollection(payload, apiMode);

                        addToast(`Successfully added ${scannedBatch.length} cards via Forge Lens!`, 'success');
                        setIsForgeLensOpen(false);
                    } catch (error) {
                        console.error("Batch add failed", error);
                        addToast(`Failed to add cards: ${error.message}`, 'error');
                    }
                }}
            />

            <PlaystyleWizardModal
                isOpen={isPlaystyleWizardOpen}
                onClose={() => setIsPlaystyleWizardOpen(false)}
                onComplete={handlePlaystyleUpdate}
            />

            <PlaystyleProfileModal
                isOpen={isPlaystyleProfileOpen}
                onClose={() => setIsPlaystyleProfileOpen(false)}
                profile={userProfile?.settings?.playstyle}
                userImage={currentUser?.photoURL}
                onRetake={() => {
                    setIsPlaystyleProfileOpen(false);
                    setIsPlaystyleWizardOpen(true);
                }}
            />

            <BadgeSelectionModal
                isOpen={isBadgeModalOpen}
                onClose={() => setIsBadgeModalOpen(false)}
                currentBadgeId={userProfile?.settings?.badge?.id || 'alpha_tester'}
                isMaster={currentUser?.uid === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3'}
                onSelect={async (badge) => {
                    await updateSettings({ badge });
                    await refreshUserProfile();
                    setIsBadgeModalOpen(false);
                }}
            />

            <StateHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
            />

            {/* Mobile Bottom Tab Bar */}
            {!isLanding && (
                <div className="md:hidden fixed bottom-0 left-0 w-full bg-gray-900 border-t border-gray-800 z-50 pb-safe">
                    <div className="flex justify-around items-center h-16">
                        <Link to="/dashboard" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/dashboard' ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                            <span className="text-[10px] mt-1 uppercase tracking-wide">Home</span>
                        </Link>
                        <Link to="/collection" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/collection' ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            <span className="text-[10px] mt-1 uppercase tracking-wide">Collection</span>
                        </Link>
                        <Link to="/wishlist" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/wishlist' ? 'text-orange-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                            <span className="text-[10px] mt-1 uppercase tracking-wide">Wishlist</span>
                        </Link>
                        <Link to="/decks" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.startsWith('/decks') ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            <span className="text-[10px] mt-1 uppercase tracking-wide">Decks</span>
                        </Link>
                        <Link to="/social" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/social' ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            <span className="text-[10px] mt-1 uppercase tracking-wide">Social</span>
                        </Link>
                        <Link to="/precons" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.startsWith('/precons') ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                            <span className="text-[10px] mt-1 uppercase tracking-wide">Precons</span>
                        </Link>
                        <Link to="/sets" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.startsWith('/sets') ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                            <span className="text-[10px] mt-1 uppercase tracking-wide">Sets</span>
                        </Link>
                        <Link to="/settings" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/settings' ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <span className="text-[10px] mt-1 uppercase tracking-wide">Settings</span>
                        </Link>
                    </div>
                </div>
            )}

            <StateHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
            />

            <HelpCenterModal
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
                onStartTour={() => window.dispatchEvent(new Event('start-tour'))}
                onOpenChat={() => {
                    // This is tricky as ChatWidget is sibling or child. 
                    // We'll dispatch another event for the ChatWidget to listen to.
                    window.dispatchEvent(new Event('open-chat-widget'));
                }}
            />
        </>
    );
};

export default Navbar;
