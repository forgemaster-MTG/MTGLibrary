/**
 * Mana Calculator Module
 * Calculates mana requirements and basic land distribution for Commander decks
 */

/**
 * Count colored mana pips in a card's mana cost
 * @param {string} manaCost - Mana cost string like "{2}{G}{G}" or "{1}{U}{W}"
 * @returns {Object} - { W: count, U: count, B: count, R: count, G: count }
 */
export function countPipsInManaCost(manaCost) {
    const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 };

    if (!manaCost || typeof manaCost !== 'string') return pips;

    // Match individual mana symbols like {W}, {U}, {B}, {R}, {G}
    // Also handle hybrid mana like {W/U}, split mana, etc.
    const matches = manaCost.match(/\{[^}]+\}/g);
    if (!matches) return pips;

    matches.forEach(symbol => {
        const clean = symbol.replace(/[{}]/g, '');

        // Handle hybrid mana - count both colors
        if (clean.includes('/')) {
            const colors = clean.split('/');
            colors.forEach(color => {
                if (pips.hasOwnProperty(color)) pips[color]++;
            });
        }
        // Handle Phyrexian mana (e.g., W/P)
        else if (clean.includes('P')) {
            const color = clean.replace('/P', '');
            if (pips.hasOwnProperty(color)) pips[color]++;
        }
        // Regular colored mana
        else if (pips.hasOwnProperty(clean)) {
            pips[clean]++;
        }
        // Ignore generic mana {1}, {2}, colorless {C}, X, etc.
    });

    return pips;
}

/**
 * Count all colored mana pips in a deck's non-land cards
 * @param {Array} cards - Array of card objects with mana_cost property
 * @returns {Object} - { W: count, U: count, B: count, R: count, G: count, total: count }
 */
export function countManaPips(cards) {
    const totalPips = { W: 0, U: 0, B: 0, R: 0, G: 0, total: 0 };

    if (!cards || !Array.isArray(cards)) return totalPips;

    cards.forEach(card => {
        // Skip lands
        if (card.type_line && card.type_line.toLowerCase().includes('land')) return;

        const cardPips = countPipsInManaCost(card.mana_cost);
        Object.keys(cardPips).forEach(color => {
            totalPips[color] += cardPips[color];
            totalPips.total += cardPips[color];
        });
    });

    return totalPips;
}

/**
 * Check if a land produces a specific color of mana
 * @param {Object} card - Card object
 * @param {string} color - Color code (W, U, B, R, G)
 * @returns {boolean}
 */
function landProducesColor(card, color) {
    if (!card) return false;

    // Check color_identity
    if (card.color_identity && Array.isArray(card.color_identity)) {
        if (card.color_identity.includes(color)) return true;
    }

    // Check produced_mana
    if (card.produced_mana && Array.isArray(card.produced_mana)) {
        if (card.produced_mana.includes(color)) return true;
    }

    // Check oracle text for mana production
    if (card.oracle_text) {
        const colorSymbols = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
        const colorName = colorSymbols[color];
        const text = card.oracle_text.toLowerCase();

        // Look for patterns like "Add {W}" or "Add one mana of any color"
        if (text.includes(`{${color}}`) || text.includes('add one mana of any color')) {
            return true;
        }
    }

    return false;
}

/**
 * Count non-basic lands by color production
 * @param {Array} lands - Array of land cards
 * @returns {Object} - { W: count, U: count, B: count, R: count, G: count }
 */
export function countNonBasicLandsByColor(lands) {
    const counts = { W: 0, U: 0, B: 0, R: 0, G: 0 };

    if (!lands || !Array.isArray(lands)) return counts;

    lands.forEach(land => {
        // Skip basic lands
        const isBasic = land.type_line && land.type_line.includes('Basic');
        if (isBasic) return;

        // Count this land for each color it produces
        ['W', 'U', 'B', 'R', 'G'].forEach(color => {
            if (landProducesColor(land, color)) {
                counts[color]++;
            }
        });
    });

    return counts;
}

/**
 * Calculate recommended basic land counts for a deck
 * @param {Object} deck - Deck object with cards and commander
 * @param {number} targetLandCount - Total lands desired (default 37)
 * @returns {Object} - { W: count, U: count, B: count, R: count, G: count, total: count, details: {...} }
 */
export function calculateBasicLandNeeds(deck, targetLandCount = 37) {
    const result = {
        W: 0, U: 0, B: 0, R: 0, G: 0,
        total: 0,
        details: {
            pips: { W: 0, U: 0, B: 0, R: 0, G: 0, total: 0 },
            nonBasicLands: { W: 0, U: 0, B: 0, R: 0, G: 0 },
            currentLandCount: 0,
            percentages: { W: 0, U: 0, B: 0, R: 0, G: 0 }
        }
    };

    if (!deck || !deck.cards) return result;

    // Get all cards including commander
    const allCards = Object.keys(deck.cards).map(firestoreId => {
        const cardData = window.localCollection?.[firestoreId];
        return cardData;
    }).filter(Boolean);

    if (deck.commander) {
        allCards.push(deck.commander);
    }

    // Count mana pips in non-land cards
    const pips = countManaPips(allCards);
    result.details.pips = pips;

    // If no colored pips, return zeros
    if (pips.total === 0) return result;

    // Calculate percentage each color represents
    const percentages = {};
    ['W', 'U', 'B', 'R', 'G'].forEach(color => {
        percentages[color] = pips[color] / pips.total;
    });
    result.details.percentages = percentages;

    // Separate lands from non-lands
    const lands = allCards.filter(card =>
        card.type_line && card.type_line.toLowerCase().includes('land')
    );
    result.details.currentLandCount = lands.length;

    // Count non-basic lands by color
    const nonBasicLands = countNonBasicLandsByColor(lands);
    result.details.nonBasicLands = nonBasicLands;

    // Calculate how many basic lands we need total
    const basicSlotsNeeded = Math.max(0, targetLandCount - lands.length);

    // Distribute basic lands proportionally to pip count
    let allocated = 0;
    const colorOrder = ['W', 'U', 'B', 'R', 'G'].sort((a, b) => pips[b] - pips[a]);

    colorOrder.forEach((color, index) => {
        if (pips[color] === 0) return;

        // For the last color with pips, give it all remaining slots
        if (index === colorOrder.findIndex(c => pips[c] > 0 && colorOrder.slice(index + 1).every(cc => pips[cc] === 0))) {
            result[color] = basicSlotsNeeded - allocated;
        } else {
            result[color] = Math.floor(basicSlotsNeeded * percentages[color]);
        }

        allocated += result[color];
    });

    result.total = allocated;

    return result;
}

/**
 * Calculate total basic lands used across all decks
 * @param {Object} decks - All user decks (localDecks)
 * @returns {Object} - { W: count, U: count, B: count, R: count, G: count, total: count, byDeck: {...} }
 */
export function calculateBasicLandsInUse(decks) {
    const usage = { W: 0, U: 0, B: 0, R: 0, G: 0, total: 0, byDeck: {} };

    if (!decks || typeof decks !== 'object') return usage;

    Object.keys(decks).forEach(deckId => {
        const deck = decks[deckId];
        if (!deck) return;

        const needs = calculateBasicLandNeeds(deck);
        usage.byDeck[deckId] = {
            name: deck.name || 'Unnamed Deck',
            needs: { W: needs.W, U: needs.U, B: needs.B, R: needs.R, G: needs.G }
        };

        ['W', 'U', 'B', 'R', 'G'].forEach(color => {
            usage[color] += needs[color];
        });
        usage.total += needs.total;
    });

    return usage;
}
