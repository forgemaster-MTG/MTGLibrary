import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeckBuildWizardPage from './DeckBuildWizardPage';
import { GeminiService } from '../services/gemini';

// Mock scrollIntoView for JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// --- Mocks ---

// Mock Router
vi.mock('react-router-dom', () => ({
    useParams: () => ({ deckId: '123' }),
    useNavigate: () => vi.fn(),
}));

// Mock Auth
vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        userProfile: {
            id: 1,
            subscription_tier: 'tier_4', // Magician/Wizard (High tier)
            settings: {
                helper: { name: 'The Oracle' },
                geminiApiKey: 'test-key'
            }
        },
        currentUser: { email: 'test@example.com' }
    })
}));

// Mock Toast
vi.mock('../contexts/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() })
}));

// Mock Hooks
const mockDeck = {
    id: '123',
    name: 'Test Commander',
    commander: { name: 'Sol Ring', set_code: 'LEA' }, // Simple commander
    cards: []
};

vi.mock('../hooks/useDeck', () => ({
    useDeck: () => ({
        deck: mockDeck,
        cards: [],
        loading: false,
        error: null
    })
}));

vi.mock('../hooks/useCollection', () => ({
    useCollection: () => ({
        cards: [
            { name: 'Forest', data: { set: 'LEA' } },
            { name: 'Black Lotus', data: { set: 'LEA' } }
        ]
    })
}));

// Mock Services
vi.mock('../services/api', () => ({
    api: {
        get: vi.fn().mockResolvedValue({ data: [] }), // Mock /api/sets
        post: vi.fn().mockResolvedValue({ data: {} })
    }
}));

// Mock Gemini Service (Crucial!)
vi.mock('../services/gemini', () => ({
    GeminiService: {
        generateDeckBlueprint: vi.fn().mockResolvedValue({
            strategyName: 'Test Strategy',
            description: 'A test strategy.',
            foundation: { lands: 35, ramp: 10, draw: 10, interaction: 5, wipes: 2 },
            packages: [
                { name: 'Core Synergy', count: 5 }
            ]
        }),
        fetchPackage: vi.fn().mockResolvedValue({
            suggestions: [
                { name: 'Giant Growth', role: 'Synergy' }
            ]
        }),
        getDeckStrategy: vi.fn().mockResolvedValue("Aggro"),
        gradeDeck: vi.fn().mockResolvedValue({ grade: 'A' })
    }
}));

// Mock Components
vi.mock('../components/common/CardGridItem', () => ({
    default: ({ card }) => <div data-testid="card-grid-item">{card.name}</div>
}));

describe('DeckBuildWizardPage', () => {

    it('renders the initial setup step correctly', async () => {
        render(<DeckBuildWizardPage />);

        // Header
        // Header
        expect(screen.getByRole('heading', { name: /THE ORACLE/i })).toBeInTheDocument();
        expect(screen.getByText(/Configure how the Oracle should construct/i)).toBeInTheDocument();

        // Mode Buttons
        expect(screen.getByText(/My Collection/i)).toBeInTheDocument();
        expect(screen.getByText(/Global Discovery/i)).toBeInTheDocument();
    });

    it('toggles build mode', async () => {
        render(<DeckBuildWizardPage />);

        const collectionBtn = screen.getByText(/My Collection/i);
        const discoveryBtn = screen.getByText(/Global Discovery/i);

        // Default relies on state, usually 'collection' is first.
        // Click Discovery
        fireEvent.click(discoveryBtn);
        // The UI changes for discovery (e.g. text input appears)
        // We verify the text input placeholder shows up
        expect(screen.getByPlaceholderText(/Tell The Oracle specifically what you're looking for/i)).toBeInTheDocument();

        // Click Collection again
        fireEvent.click(collectionBtn);
        // Input should be gone or section hidden
        expect(screen.queryByPlaceholderText(/Tell The Oracle specifically what you're looking for/i)).not.toBeInTheDocument();
    });

    it('runs analysis when start button is clicked', async () => {
        render(<DeckBuildWizardPage />);

        const startBtn = screen.getByText(/INITIALIZE ARCHITECT/i);
        fireEvent.click(startBtn);

        // Should switch to processing/architecting status
        await waitFor(() => {
            expect(screen.getByText(/Architecting Interface/i)).toBeInTheDocument();
        });

        // Should call Gemini
        expect(GeminiService.generateDeckBlueprint).toHaveBeenCalled();
    });

});
