import { useMemo } from 'react';
import { marketService } from '../services/MarketService';

/**
 * Hook to analyze deck value and market trends.
 * @param {Array} cards - Array of card objects
 */
export function useMarketData(cards = []) {
    const valueData = useMemo(() => {
        if (!cards || cards.length === 0) return null;
        return marketService.getDeckValue(cards);
    }, [cards]);

    const tcgPlayerLink = useMemo(() => {
        return marketService.generateTCGPlayerLink(cards);
    }, [cards]);

    return {
        value: valueData,
        tcgPlayerLink,
        // formattedTotal: valueData ? `$${valueData.total.toLocaleString()}` : '$0.00'
    };
}
