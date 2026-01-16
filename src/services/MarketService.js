/**
 * Service for handling market data, pricing, and affiliate conversions.
 */
export const marketService = {
    /**
     * Safely extra price from a Scryfall card object.
     * @param {Object} card - Scryfall card object
     * @param {string} style - 'usd' | 'usd_foil' | 'eur' | 'tix'
     * @returns {number} Price as float or 0 if missing
     */
    getPrice(card, style = 'usd') {
        if (!card) return 0;

        let price = null;

        // Handle priced arrays from Scryfall (sometimes in 'prices' object)
        if (card.prices && card.prices[style]) {
            price = card.prices[style];
        }

        // Fallback or specific logic for other currencies if needed is TBD

        return price ? parseFloat(price) : 0;
    },

    /**
     * Calculate total value of a card list.
     * @param {Array} cards 
     * @param {string} currency 
     * @returns {Object} { total, max, average, distribution }
     */
    getDeckValue(cards = [], currency = 'usd') {
        let total = 0;
        let max = 0;
        let maxCard = null;

        // For distribution chart (e.g. 0-1, 1-5, 5-20, 20+)
        const distribution = {
            bulk: 0,   // < $1
            budget: 0, // $1 - $5
            mid: 0,    // $5 - $20
            high: 0,   // $20 - $50
            premium: 0 // > $50
        };

        const pricedCards = cards.map(c => {
            const p = this.getPrice(c, currency);
            total += (p * (c.quantity || 1));

            if (p > max) {
                max = p;
                maxCard = c;
            }

            // Distribution buckets
            if (p < 1) distribution.bulk += (c.quantity || 1);
            else if (p < 5) distribution.budget += (c.quantity || 1);
            else if (p < 20) distribution.mid += (c.quantity || 1);
            else if (p < 50) distribution.high += (c.quantity || 1);
            else distribution.premium += (c.quantity || 1);

            return { ...c, price: p };
        });

        return {
            total: parseFloat(total.toFixed(2)),
            max: parseFloat(max.toFixed(2)),
            maxCard,
            average: cards.length ? parseFloat((total / cards.length).toFixed(2)) : 0,
            distribution,
            currency
        };
    },

    /**
     * Generates a TCGPlayer Mass Entry URL for a list of cards.
     * @param {Array} cards 
     * @param {string} affiliateCode 
     * @returns {string} URL
     */
    generateTCGPlayerLink(cards, affiliateCode = 'MTGLibrary') {
        // TCGPlayer Mass Entry format: c=Qty Name||Qty Name...
        // e.g. https://store.tcgplayer.com/massentry?partner=CODE&utm_campaign=affiliate&c=4 Sol Ring||1 Command Tower

        if (!cards || cards.length === 0) return '';

        const cardListPart = cards.map(c => {
            // Clean name of special characters if needed, though TCGPlayer handles most
            return `${c.quantity || 1} ${c.name}`;
        }).join('||');

        const baseUrl = 'https://store.tcgplayer.com/massentry';
        const params = new URLSearchParams({
            partner: affiliateCode,
            utm_campaign: 'affiliate',
            utm_medium: 'mtglibrary',
            utm_source: 'MTGLibrary',
            c: cardListPart
        });

        return `${baseUrl}?${params.toString()}`;
    }
};
