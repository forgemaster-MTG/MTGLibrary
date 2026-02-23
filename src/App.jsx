import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import PricingPage from './pages/PricingPage';
import LoginPage from './pages/LoginPage';
import CollectionPage from './pages/CollectionPage';
import DecksPage from './pages/DecksPage';
import BindersPage from './pages/BindersPage';
import CreateDeckPage from './pages/CreateDeckPage';
import DeckDetailsPage from './pages/DeckDetailsPage';
import SetsPage from './pages/SetsPage';
import SetDetailsPage from './pages/SetDetailsPage';
import ProductsPage from './pages/ProductsPage';
import SettingsPage from './pages/SettingsPage';
import WishlistPage from './pages/WishlistPage';
import PreconPage from './pages/PreconPage';
import PreconDeckPage from './pages/PreconDeckPage';
import DeckBuildWizardPage from './pages/DeckBuildWizardPage';
import OnboardingPage from './pages/OnboardingPage';
import AboutPage from './pages/AboutPage';
import PublicDeckPage from './pages/PublicDeckPage';
import RemoteLensPage from './pages/RemoteLensPage';
import AIStrategyPage from './pages/AIStrategyPage';
import TheVault from './pages/TheVault';
import AuditWizard from './components/Audit/AuditWizard';
import AuditHub from './components/Audit/AuditHub';
import AuditCompletion from './components/Audit/AuditCompletion';
import AchievementToast from './components/common/AchievementToast';
import Lobby from './pages/LiveSession/Lobby';
import GameRoom from './pages/LiveSession/GameRoom';
import SocialPage from './pages/SocialPage';
import TradeDashboard from './pages/TradeDashboard';
import TradeDetail from './pages/TradeDetail';
import ProfilePage from './pages/ProfilePage';
import TournamentPage from './pages/TournamentPage';
import TournamentJoinPage from './pages/TournamentJoinPage';
import SolitairePage from './pages/SolitairePage';
import AdminPage from './pages/AdminPage';
import SupportPage from './pages/SupportPage';
import TermsOfService from './pages/legal/TermsOfService';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import FeedbackBanner from './components/common/FeedbackBanner';
import LegalAgreementModal from './components/modals/LegalAgreementModal';
import ChatWidget from './components/ChatWidget';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';

import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persister } from './queryClient'; // Import our new persistent client
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { CardModalProvider } from './contexts/CardModalContext';
import CardDetailsModal from './components/modals/CardDetailsModal';
import AuthGuard from './components/AuthGuard';
import ApiInterceptor from './components/ApiInterceptor';
import ReferralTracker from './components/ReferralTracker';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

import OfflineNotifier from './components/OfflineNotifier';
import AchievementMonitor from './components/common/AchievementMonitor';

import ImpersonationBanner from './components/Admin/ImpersonationBanner';
import AdminGuard from './components/Admin/AdminGuard';
import UsernamePrompt from './components/onboarding/UsernamePrompt';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';

// Syncs ThemeContext with UserProfile settings
const ThemeSync = () => {
    const { userProfile } = useAuth();
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (userProfile?.settings?.theme && userProfile.settings.theme !== theme) {
            console.log(`[ThemeSync] Syncing theme from profile: ${userProfile.settings.theme}`);
            setTheme(userProfile.settings.theme);
        }
    }, [userProfile?.settings?.theme]);

    return null;
};

function App() {
    // Global Shortcuts
    useKeyboardShortcuts([
        {
            key: 'Escape',
            action: () => {
                // Dispatch event for modals to close
                window.dispatchEvent(new CustomEvent('close-modals'));
            }
        }
    ]);

    // Note: OfflineNotifier handles toast logic now to avoid hook rules error

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
            onSuccess={() => console.log('Query cache restored successfully')}
            loadingComponent={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-primary-500 font-bold tracking-widest animate-pulse">LOADING MAGIC...</div>}
        >
            <ToastProvider>
                <ThemeProvider>
                    <OfflineNotifier />
                    <AchievementToast />
                    <AuthProvider>
                        <ThemeSync />
                        <AchievementMonitor />
                        <CardModalProvider>
                            <div className="bg-gray-900 text-gray-200 font-sans min-h-screen flex flex-col transition-colors duration-500">
                                <ScrollToTop />
                                <ReferralTracker />
                                <ImpersonationBanner />
                                {/* Navbar is now always rendered but handles its own restriction logic */}
                                <Navbar />
                                <AuthGuard>
                                    <div className="flex-grow pb-24 md:pb-0">
                                        <Routes>
                                            <Route path="/" element={<LandingPage />} />
                                            <Route path="/about" element={<AboutPage />} />
                                            <Route path="/dashboard" element={<Dashboard />} />
                                            <Route path="/login" element={<LoginPage />} />
                                            <Route path="/onboarding" element={<OnboardingPage />} />
                                            <Route path="/collection" element={<CollectionPage />} />
                                            <Route path="/pricing" element={<PricingPage />} />
                                            <Route path="/decks" element={<DecksPage />} />
                                            <Route path="/binders" element={<BindersPage />} />
                                            <Route path="/precons" element={<PreconPage />} />
                                            <Route path="/precons/type/:type" element={<PreconPage />} />
                                            <Route path="/precons/set/:set" element={<PreconPage />} />
                                            <Route path="/precons/deck/:id" element={<PreconDeckPage />} />
                                            <Route path="/decks/new" element={<CreateDeckPage />} />
                                            <Route path="/decks/:deckId" element={<DeckDetailsPage />} />
                                            <Route path="/share/:slug" element={<PublicDeckPage />} />
                                            <Route path="/decks/:deckId/build" element={<DeckBuildWizardPage />} />
                                            <Route path="/sets" element={<SetsPage />} />
                                            <Route path="/sets/:setCode" element={<SetDetailsPage />} />
                                            <Route path="/wishlist" element={<WishlistPage />} />
                                            <Route path="/settings/*" element={<SettingsPage />} />
                                            <Route path="/vault" element={<TheVault />} />
                                            <Route path="/audit" element={<AuditHub />} />
                                            <Route path="/audit/complete" element={<AuditCompletion />} />
                                            <Route path="/audit/:id" element={<AuditHub />} />
                                            <Route path="/audit/:auditId/wizard" element={<AuditWizard />} />
                                            <Route path="/remote/:sessionId" element={<RemoteLensPage />} />
                                            <Route path="/strategy" element={<AIStrategyPage />} />
                                            <Route path="/play" element={<Navigate to="/play/lobby" replace />} />
                                            <Route path="/play/lobby" element={<Lobby />} />
                                            <Route path="/play/room/:id" element={<GameRoom />} />
                                            <Route path="/social" element={<SocialPage />} />
                                            <Route path="/profile/:id" element={<ProfilePage />} />
                                            <Route path="/trades" element={<TradeDashboard />} />
                                            <Route path="/trades/:id" element={<TradeDetail />} />
                                            <Route path="/tournaments" element={<TournamentPage />} />
                                            <Route path="/tournaments/:id" element={<TournamentPage />} />
                                            <Route path="/tournaments/:id/join" element={<TournamentJoinPage />} />
                                            <Route path="/solitaire/:deckId" element={<SolitairePage />} />
                                            <Route path="/products" element={<ProductsPage />} />
                                            <Route path="/support" element={<SupportPage />} />
                                            <Route path="/terms" element={<TermsOfService />} />
                                            <Route path="/privacy" element={<PrivacyPolicy />} />
                                            {/* Authenticated Routes */}
                                            <Route path="/admin/*" element={
                                                <AdminGuard>
                                                    <AdminPage />
                                                </AdminGuard>
                                            } />
                                        </Routes>
                                    </div>
                                </AuthGuard>
                                <ApiInterceptor />
                                {/* Global Components */}
                                <FeedbackBanner />
                                <LegalAgreementCheck />
                                <ChatWidget />
                                <CardDetailsModal />
                                <UsernamePrompt />
                            </div>
                        </CardModalProvider>
                    </AuthProvider>
                </ThemeProvider>
            </ToastProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </PersistQueryClientProvider>
    );
}

// Helper component to check for legal agreement
const LegalAgreementCheck = () => {
    const { user, userProfile } = useAuth();
    const { pathname } = useLocation();
    const [isModalOpen, setIsModalOpen] = useState(false);

    React.useEffect(() => {
        const isLegalPath = pathname === '/terms' || pathname === '/privacy';

        if (user && userProfile && !userProfile.agreed_to_terms_at && !isLegalPath) {
            setIsModalOpen(true);
        } else {
            setIsModalOpen(false);
        }
    }, [user, userProfile, pathname]);

    return (
        <LegalAgreementModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
        />
    );
};

export default App;
