import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CardSearchModal from './CardSearchModal';
import PlaystyleWizardModal from './modals/PlaystyleWizardModal';
import PlaystyleProfileModal from './modals/PlaystyleProfileModal';

const Navbar = () => {
    const location = useLocation();
    const { currentUser, userProfile, logout, updateSettings, refreshUserProfile } = useAuth();
    const isLanding = location.pathname === '/';
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isPlaystyleWizardOpen, setIsPlaystyleWizardOpen] = useState(false);
    const [isPlaystyleProfileOpen, setIsPlaystyleProfileOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    // Close user menu when clicking outside (simple handler)
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
        // Save to backend via AuthContext
        await updateSettings({ playstyle: profile });
        // Refresh local profile to ensure UI updates
        await refreshUserProfile();
        // Open the profile view after completion
        setIsPlaystyleProfileOpen(true);
    };

    return (
        <>
            <nav className="bg-gray-800/80 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">

                        {/* Desktop Content */}
                        <div className="flex items-center justify-between w-full">
                            {/* Logo */}
                            <div className="flex-shrink-0 flex items-center gap-3">
                                <Link to="/" className="flex items-center gap-2 transform hover:scale-105 transition-transform">
                                    <img src="/logo.png" alt="MTG Forge Logo" className="h-10 w-auto" />
                                    <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                                        MTG-Forge
                                    </span>
                                </Link>
                            </div>

                            {/* Desktop Nav Links */}
                            <div className="hidden md:ml-10 md:flex md:items-baseline md:space-x-4">
                                {isLanding ? (
                                    <>
                                        <a href="#features" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Features</a>
                                        <a href="#about" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">About</a>
                                        <Link to="/directory" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Directory</Link>
                                    </>
                                ) : (
                                    <>
                                        <Link to="/dashboard" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Dashboard</Link>
                                        <Link to="/collection" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Collection</Link>
                                        <Link to="/decks" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Decks</Link>
                                        <Link to="/sets" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Sets</Link>
                                        <Link to="/settings" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">Settings</Link>
                                    </>
                                )}
                            </div>

                            {/* Right Side Actions */}
                            <div className="hidden md:flex items-center gap-4">
                                {currentUser && (
                                    <button
                                        onClick={() => setIsSearchOpen(true)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        <span className="inline">Add Card</span>
                                    </button>
                                )}

                                {currentUser ? (
                                    <div className="relative">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-gray-300">{currentUser.email}</span>
                                            <button
                                                id="user-menu-button"
                                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                                className="text-gray-400 hover:text-white transition-colors focus:outline-none"
                                            >
                                                <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center ring-2 ring-transparent hover:ring-indigo-500 transition-all">
                                                    <span className="text-xs font-bold text-indigo-300">
                                                        {currentUser.email ? currentUser.email[0].toUpperCase() : 'U'}
                                                    </span>
                                                </div>
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
                                                        logout();
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

            <CardSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

            <PlaystyleWizardModal
                isOpen={isPlaystyleWizardOpen}
                onClose={() => setIsPlaystyleWizardOpen(false)}
                onComplete={handlePlaystyleUpdate}
            />

            <PlaystyleProfileModal
                isOpen={isPlaystyleProfileOpen}
                onClose={() => setIsPlaystyleProfileOpen(false)}
                profile={userProfile?.settings?.playstyle}
                onRetake={() => {
                    setIsPlaystyleProfileOpen(false);
                    setIsPlaystyleWizardOpen(true);
                }}
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
                        <Link to="/decks" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname.startsWith('/decks') ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            <span className="text-[10px] mt-1 uppercase tracking-wide">Decks</span>
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
        </>
    );
};

export default Navbar;
