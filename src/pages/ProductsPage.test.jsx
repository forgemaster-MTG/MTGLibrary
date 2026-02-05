import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProductsPage from '../pages/ProductsPage';
import { api } from '../services/api';

// Mock dependencies
vi.mock('../services/api', () => ({
    api: {
        getFeaturedProducts: vi.fn(),
    }
}));

// Mock Lucide icons to avoid render issues
vi.mock('lucide-react', () => ({
    Search: () => <div data-testid="icon-search" />,
    ShoppingBag: () => <div data-testid="icon-shopping-bag" />,
    ExternalLink: () => <div data-testid="icon-external-link" />,
    Layers: () => <div data-testid="icon-layers" />,
    Box: () => <div data-testid="icon-box" />,
    Square: () => <div data-testid="icon-square" />,
    Dices: () => <div data-testid="icon-dices" />,
    BookOpen: () => <div data-testid="icon-book-open" />,
    Warehouse: () => <div data-testid="icon-warehouse" />,
    Scroll: () => <div data-testid="icon-scroll" />,
    Shield: () => <div data-testid="icon-shield" />,
}));

describe('ProductsPage', () => {
    const mockProducts = [
        {
            id: 1,
            title: 'Test Commander Deck',
            image_url: 'test-image.jpg',
            link_url: 'http://test.com',
            category: 'Commander',
            price_label: '$40.00'
        },
        {
            id: 2,
            title: 'Test Booster Box',
            image_url: 'box-image.jpg',
            link_url: 'http://test.com/box',
            category: 'Sealed',
            price_label: '$120.00'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        api.getFeaturedProducts.mockResolvedValue(mockProducts);
    });

    it('renders the page title and default state', async () => {
        render(<ProductsPage />);

        expect(screen.getByText(/OFFICIAL/i)).toBeInTheDocument();
        expect(screen.getByText(/STORE/i)).toBeInTheDocument();

        // Wait for data load
        await waitFor(() => {
            expect(screen.getByText('Test Commander Deck')).toBeInTheDocument();
        });
    });

    it('filters filtering by category', async () => {
        render(<ProductsPage />);
        await waitFor(() => screen.getByText('Test Commander Deck'));

        // Click on Sealed Category
        const sealedBtn = screen.getByText('Sealed', { selector: 'button' });
        fireEvent.click(sealedBtn);

        // Should show Sealed item
        expect(screen.getByText('Test Booster Box')).toBeInTheDocument();

        // Should NOT show Commander item (logic hides other categories in filtered view)
        expect(screen.queryByText('Test Commander Deck')).not.toBeInTheDocument();
    });

    it('handles search input', async () => {
        render(<ProductsPage />);
        await waitFor(() => screen.getByText('Test Commander Deck'));

        const searchInput = screen.getByPlaceholderText('Search the store...');
        fireEvent.change(searchInput, { target: { value: 'Booster' } });

        expect(screen.getByText('Test Booster Box')).toBeInTheDocument();
        expect(screen.queryByText('Test Commander Deck')).not.toBeInTheDocument();
    });

    it('shows empty state when no results found', async () => {
        render(<ProductsPage />);
        await waitFor(() => screen.getByText('Test Commander Deck'));

        const searchInput = screen.getByPlaceholderText('Search the store...');
        fireEvent.change(searchInput, { target: { value: 'NonExistentProduct' } });

        expect(screen.getByText(/No products found for "NonExistentProduct"/i)).toBeInTheDocument();
        expect(screen.getByText(/Search Amazon Instead/i)).toBeInTheDocument();
    });
});
