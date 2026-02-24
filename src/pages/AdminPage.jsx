import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import UserManagement from '../components/Admin/UserManagement';
import DatabaseSync from '../components/Admin/DatabaseSync';
import ContentManager from '../components/Admin/ContentManager';
import StoreManager from '../components/Admin/StoreManager';
import AIPersonasManager from '../components/Admin/AIPersonasManager';
import PricingCalculator from './admin/PricingCalculator';
import { useAuth } from '../contexts/AuthContext';

const AdminPage = () => {
    const { userProfile } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Double-check Admin Access
    if (!userProfile?.settings?.isAdmin && userProfile?.firestore_id !== 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3') {
        return <Navigate to="/dashboard" replace />;
    }

    const navItems = [
        {
            path: 'users', label: 'User Management', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            )
        },
        {
            path: 'pricing', label: 'Pricing & Config', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )
        },
        {
            path: 'sync', label: 'DB Sync & Tools', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            )
        },
        {
            path: 'content', label: 'Content Manager', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
            )
        },
        {
            path: 'store', label: 'Store Manager', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            )
        },
        {
            path: 'personas', label: 'AI Personas', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
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
                        Admin Console
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">System Management</p>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={`/admin/${item.path}`}
                            onClick={() => setIsSidebarOpen(false)}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
                                ${isActive
                                    ? 'bg-primary-600/10 text-primary-400 border border-primary-500/20 shadow-lg shadow-primary-900/10'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'
                                }
                            `}
                        >
                            {/* Icon */}
                            <div className={`${location.pathname.includes(item.path) ? 'text-primary-500' : 'text-gray-500'}`}>
                                {item.icon}
                            </div>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <div className="bg-gray-900 rounded-lg p-3 text-xs text-gray-500 border border-gray-800">
                        <p className="font-bold text-gray-400 mb-1">System Status</p>
                        <div className="flex justify-between items-center">
                            <span>Server</span>
                            <span className="text-green-500 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
                            </span>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto bg-gray-900 relative w-full">
                <div className="w-full p-0 md:p-4 lg:p-6 pt-16 md:pt-8">
                    <Routes>
                        <Route path="users" element={<UserManagement />} />
                        <Route path="pricing" element={<PricingCalculator />} />
                        <Route path="sync" element={<DatabaseSync />} />
                        <Route path="content" element={<ContentManager />} />
                        <Route path="store" element={<StoreManager />} />
                        <Route path="personas" element={<AIPersonasManager />} />
                        <Route path="*" element={<Navigate to="users" replace />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
};

export default AdminPage;
