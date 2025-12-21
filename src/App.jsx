import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import CollectionPage from './pages/CollectionPage';
import DecksPage from './pages/DecksPage';
import CreateDeckPage from './pages/CreateDeckPage';
import DeckDetailsPage from './pages/DeckDetailsPage';
import SetsPage from './pages/SetsPage';
import SetDetailsPage from './pages/SetDetailsPage';
import SettingsPage from './pages/SettingsPage';
import ChatWidget from './components/ChatWidget';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

import { CardModalProvider } from './contexts/CardModalContext';
import CardDetailsModal from './components/modals/CardDetailsModal';

function App() {
    return (
        <ToastProvider>
            <AuthProvider>
                <CardModalProvider>
                    <div className="bg-gray-900 text-gray-200 font-sans min-h-screen flex flex-col">
                        <Navbar />
                        <div className="flex-grow">
                            <Routes>
                                <Route path="/" element={<LandingPage />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/collection" element={<CollectionPage />} />
                                <Route path="/decks" element={<DecksPage />} />
                                <Route path="/decks/new" element={<CreateDeckPage />} />
                                <Route path="/decks/:deckId" element={<DeckDetailsPage />} />
                                <Route path="/sets" element={<SetsPage />} />
                                <Route path="/sets/:setCode" element={<SetDetailsPage />} />
                                <Route path="/settings" element={<SettingsPage />} />
                            </Routes>
                        </div>
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
