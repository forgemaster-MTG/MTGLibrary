export const SUPPORTED_FORMATS = [
    'Standard',
    'Commander',
    'Modern',
    'Pioneer',
    'Legacy',
    'Vintage',
    'Pauper',
    'Alchemy',
    'Historic',
    'Timeless',
    'Brawl',
    'Standardbrawl',
    'Paupercommander',
    'Duel',
    'Oathbreaker',
    'Penny',
    'Predh',
    'Premodern',
    'Oldschool',
    'Gladiator',
    'Future',
    'Limited',
    'Other'
];

/**
 * Checks if a given format is a Commander-style format (has a commander)
 */
export const isCommanderFormat = (format) => {
    if (!format) return false;
    const f = format.toLowerCase();
    return [
        'commander',
        'brawl',
        'standardbrawl',
        'paupercommander',
        'duel',
        'oathbreaker',
        'predh'
    ].includes(f);
};

/**
 * Returns the maximum number of copies allowed for a single card in the format
 * (excluding basic lands)
 */
export const getFormatLimit = (format) => {
    if (!format) return 4;
    const f = format.toLowerCase();

    // Singleton formats (including Gladiator which is 100-card singleton without a commander)
    if (isCommanderFormat(f) || f === 'gladiator') return 1;

    if (f === 'limited') return 99; // Essentially unbounded, constrained by pool

    // Default to 4 for 60-card formats (Standard, Modern, Pioneer, etc.)
    return 4;
};

/**
 * Validates if a card is legal in the specified format according to Scryfall legalities
 */
export const isCardLegalInFormat = (card, format) => {
    if (!card || !format) return true; // Fail open if missing data

    // "Other" and "Limited" skip strict scryfall legality checks
    const f = format.toLowerCase();
    if (f === 'other' || f === 'limited') return true;

    // We get card.data.legalities or card.legalities
    const data = card.data || card;
    const legalities = data.legalities || {};

    // Map internal strings to Scryfall format strings
    // Mostly they are identical (e.g. 'commander' -> 'commander', 'standard' -> 'standard')
    let scryfallKey = f;

    // Check if the card is legal or restricted (e.g. Vintage)
    const status = legalities[scryfallKey];

    // If we don't have legality data for this format, we might fail open or closed.
    // Generally, MTG formats have a strict "not_legal" or "banned". Let's fail if it's explicitly not legal/banned.
    if (status === 'banned' || status === 'not_legal') {
        return false;
    }

    return true; // legal, restricted, or unknown
};
