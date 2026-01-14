import { Routes, Route, Navigate } from 'react-router-dom';

import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import PricingPage from './pages/PricingPage';
import LoginPage from './pages/LoginPage';
import CollectionPage from './pages/CollectionPage';
import DecksPage from './pages/DecksPage';
import CreateDeckPage from './pages/CreateDeckPage';
import DeckDetailsPage from './pages/DeckDetailsPage';
import SetsPage from './pages/SetsPage';
import SetDetailsPage from './pages/SetDetailsPage';
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
import AuditWizard from './components/Audit/AuditWizard';
import AuditHub from './components/Audit/AuditHub';
import Lobby from './pages/LiveSession/Lobby';
import GameRoom from './pages/LiveSession/GameRoom';
import SocialPage from './pages/SocialPage';
import TournamentPage from './pages/TournamentPage';
import TournamentJoinPage from './pages/TournamentJoinPage';
import ChatWidget from './components/ChatWidget';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

import { CardModalProvider } from './contexts/CardModalContext';
import CardDetailsModal from './components/modals/CardDetailsModal';
import AuthGuard from './components/AuthGuard';
import ApiInterceptor from './components/ApiInterceptor';
import ReferralTracker from './components/ReferralTracker';

function App() {
    return (
        <ToastProvider>
            <AuthProvider>
                <CardModalProvider>
                    <div className="bg-gray-900 text-gray-200 font-sans min-h-screen flex flex-col">
                        <ScrollToTop />
                        <ReferralTracker />
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
                                    <Route path="/settings/:tab?" element={<SettingsPage />} />
                                    <Route path="/audit" element={<AuditHub />} />
                                    <Route path="/audit/:id" element={<AuditHub />} />
                                    <Route path="/audit/:auditId/wizard" element={<AuditWizard />} />
                                    <Route path="/remote/:sessionId" element={<RemoteLensPage />} />
                                    <Route path="/strategy" element={<AIStrategyPage />} />
                                    <Route path="/play" element={<Navigate to="/play/lobby" replace />} />
                                    <Route path="/play/lobby" element={<Lobby />} />
                                    <Route path="/play/room/:id" element={<GameRoom />} />
                                    <Route path="/social" element={<SocialPage />} />
                                    <Route path="/tournaments" element={<TournamentPage />} />
                                    <Route path="/tournaments/:id" element={<TournamentPage />} />
                                    <Route path="/tournaments/:id/join" element={<TournamentJoinPage />} />
                                </Routes>
                            </div>
                        </AuthGuard>
                        <ApiInterceptor />
                        {/* Global Components */}
                        <ChatWidget />
                        <CardDetailsModal />
                    </div>
                </CardModalProvider>
            </AuthProvider>
        </ToastProvider>
    );
}

export default App;
