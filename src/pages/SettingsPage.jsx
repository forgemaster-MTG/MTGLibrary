import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import AccountSettings from '../components/Settings/AccountSettings';
import PreferencesSettings from '../components/Settings/PreferencesSettings';
import DataSettings from '../components/Settings/DataSettings';
import CommunitySettingsTab from '../components/community/CommunitySettingsTab';
import MatchHistoryTab from '../components/Settings/MatchHistoryTab';

const SettingsPage = () => {
    const location = useLocation();
    console.log("SettingsPage Render:", location.pathname);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const navItems = [
        {
            path: 'account', label: 'Account', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            )
        },
        {
            path: 'preferences', label: 'Preferences', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            )
        },
        {
            path: 'data', label: 'Data Management', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            )
        },
        {
            path: 'community', label: 'My Pod', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            )
        },
        {
            path: 'history', label: 'Match History', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )
        }
    ];

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-900 overflow-hidden relative">
            {/* Mobile Header Toggle */}
            <div className="md:hidden absolute top-4 left-4 z-50">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 bg-gray-800 rounded-lg text-white border border-gray-700 shadow-lg"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
            </div>

            {/* Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                absolute md:relative z-40 h-full w-64 bg-gray-950 border-r border-gray-800 flex flex-col transition-transform duration-300
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-6 border-b border-gray-800 pt-16 md:pt-6">
                    <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        Settings
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Manage your experience</p>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={`/settings/${item.path}`}
                            onClick={() => setIsSidebarOpen(false)}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
                                ${isActive
                                    ? 'bg-primary-600/10 text-primary-400 border border-primary-500/20 shadow-lg shadow-primary-900/10'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'
                                }
                            `}
                        >
                            <div className={`${location.pathname.includes(item.path) ? 'text-primary-500' : 'text-gray-500'}`}>
                                {item.icon}
                            </div>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-gray-900 relative w-full">
                <div className="max-w-7xl mx-auto p-4 md:p-8 pt-16 md:pt-8">
                    <Routes>
                        <Route path="account" element={<AccountSettings />} />
                        <Route path="preferences" element={<PreferencesSettings />} />
                        <Route path="data" element={<DataSettings />} />
                        <Route path="community" element={<CommunitySettingsTab />} />
                        <Route path="history" element={<MatchHistoryTab />} />
                        <Route path="*" element={<Navigate to="/settings/account" replace />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
};

export default SettingsPage;
