/**
 * Utility for Magic: The Gathering Color Logic
 */

// Mapping of color combinations to names
export const COLOR_COMBINATIONS = {
    // Mono
    'W': 'White',
    'U': 'Blue',
    'B': 'Black',
    'R': 'Red',
    'G': 'Green',
    'C': 'Colorless',

    // Guilds (2 Colors)
    'WU': 'Azorius',
    'WB': 'Orzhov',
    'WR': 'Boros',
    'WG': 'Selesnya',
    'UB': 'Dimir',
    'UR': 'Izzet',
    'UG': 'Simic',
    'BR': 'Rakdos',
    'BG': 'Golgari',
    'RG': 'Gruul',

    // Shards (3 Colors - Ally)
    'GWU': 'Bant',
    'WUB': 'Esper',
    'UBR': 'Grixis',
    'BRG': 'Jund',
    'RGW': 'Naya',

    // Wedges (3 Colors - Enemy)
    'WBG': 'Abzan',
    'URW': 'Jeskai',
    'BGU': 'Sultai',
    'RWB': 'Mardu',
    'GUR': 'Temur',

    // 4 Colors
    'WUBR': 'Yore-Tiller', // or Artifice
    'UBRG': 'Glint-Eye', // or Chaos
    'BRGW': 'Dune-Brood', // or Aggression
    'RGWU': 'Ink-Treader', // or Altruism
    'GWUB': 'Witch-Maw', // or Growth

    // 5 Colors
    'WUBRG': 'WUBRG'
};

/**
 * Gets the name of a color identity.
 * @param {Array<string>|string} colors Array of color codes ['W', 'U'] or string 'WU'
 * @returns {string} The name (e.g., 'Azorius') or 'Multicolor' if unknown combination
 */
export const getColorName = (colors) => {
    if (!colors || colors.length === 0) return 'Colorless';
    if (colors.includes('C') && colors.length === 1) return 'Colorless';

    // Sort colors to match key format (WUBRG order usually, but let's just use alphabetical for consistency if needed, 
    // BUT common convention is WUBRG. Let's just sort effectively.)
    // Actually, simple alpha sort works if keys are consistent.
    // Let's normalize the input to be sorted WUBRG order for consistent keys.

    const wubrgOrder = { 'W': 0, 'U': 1, 'B': 2, 'R': 3, 'G': 4 };

    const colorArray = Array.isArray(colors) ? colors : colors.split('');
    // filter out garbage
    const cleanColors = colorArray.filter(c => wubrgOrder[c] !== undefined);

    if (cleanColors.length === 0) return 'Colorless';

    const sortedKey = cleanColors.sort((a, b) => wubrgOrder[a] - wubrgOrder[b]).join('');

    // Check specific keys first
    if (COLOR_COMBINATIONS[sortedKey]) return COLOR_COMBINATIONS[sortedKey];

    // Fallback logic
    if (cleanColors.length === 2) return 'Multicolor (Guild)';
    if (cleanColors.length === 3) return 'Multicolor (Shard/Wedge)';
    if (cleanColors.length === 4) return 'Multicolor (Nephilim)';
    if (cleanColors.length === 5) return '5-Color';

    return 'Multicolor';
};

/**
 * Get Color Pair/Triples Identity from a card
 */
export const getCardColorIdentity = (card) => {
    return card.color_identity || [];
};
