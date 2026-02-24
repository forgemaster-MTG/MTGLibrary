export const FORMAT_DESCRIPTIONS = {
    'Commander': {
        description: 'A multiplayer free-for-all where you build a 99-card deck around a Legendary Creature "Commander".',
        rules: '100 Cards • Singleton • Color Identity strict'
    },
    'Standard': {
        description: 'A rotating 60-card format using only the newest Magic sets released in the last 3 years.',
        rules: '60 Cards • Up to 4 copies • Rotating card pool'
    },
    'Modern': {
        description: 'A non-rotating 60-card format allowing cards from 8th Edition to present.',
        rules: '60 Cards • Up to 4 copies • Non-rotating'
    },
    'Pioneer': {
        description: 'A non-rotating 60-card format bridging the gap between Standard and Modern (Return to Ravnica forward).',
        rules: '60 Cards • Up to 4 copies • Non-rotating'
    },
    'Legacy': {
        description: 'The ultimate constructed format allowing cards from all of Magic history, with a curated ban list.',
        rules: '60 Cards • Up to 4 copies • Eternal'
    },
    'Vintage': {
        description: 'Magic\'s most powerful format. Cards restricted rather than banned (e.g. Black Lotus is a 1-of).',
        rules: '60 Cards • Up to 4 copies • Eternal with Restrictions'
    },
    'Pauper': {
        description: 'A highly competitive format using only cards that have been printed at Common rarity.',
        rules: '60 Cards • Up to 4 copies • Commons Only'
    },
    'Oathbreaker': {
        description: 'A 60-card multiplayer format led by a Planeswalker and a Signature Spell.',
        rules: '60 Cards • Singleton • Color Identity strict'
    },
    'Brawl': {
        description: 'A 60-card singleton format using only Standard-legal cards, led by a legendary creature or planeswalker.',
        rules: '60 Cards • Singleton • Standard card pool'
    },
    'Historic': {
        description: 'MTG Arena\'s digital non-rotating format with digital-only cards.',
        rules: '60 Cards • Up to 4 copies • Arena Only'
    },
    'Timeless': {
        description: 'MTG Arena\'s most powerful format, featuring everything on the client with restrictions instead of bans.',
        rules: '60 Cards • Up to 4 copies • Arena Only with Restrictions'
    },
    'Gladiator': {
        description: 'A 100-card singleton format played without a commander, usually on MTG Arena.',
        rules: '100 Cards • Singleton • No Commander'
    },
    'Paupercommander': {
        description: 'Commander but your general is any Uncommon creature and your 99 are all Commons.',
        rules: '100 Cards • Singleton • Uncommon General + Common 99'
    },
    'Alchemy': {
        description: 'A rotating MTG Arena format based on Standard, but featuring digital-only cards and rebalances.',
        rules: '60 Cards • Up to 4 copies • Digital Only'
    },
    'Standardbrawl': {
        description: 'A 60-card singleton MTG Arena format led by a commander, using only Standard-legal cards.',
        rules: '60 Cards • Singleton • Standard Pool'
    },
    'Duel': {
        description: 'A 1v1 variant of Commander with a specific banlist tailored for competitive heads-up play.',
        rules: '100 Cards • Singleton • 1v1 Banlist'
    },
    'Penny': {
        description: 'A Magic Online format where only cards that cost 0.02 tix or less are legal at the time of rotation.',
        rules: '60 Cards • Up to 4 copies • Budget Only'
    },
    'Predh': {
        description: 'Commander using only cards printed before the release of Commander 2011 (when the format became official).',
        rules: '100 Cards • Singleton • Pre-2011 Pool'
    },
    'Premodern': {
        description: 'A community-created non-rotating format consisting of sets from 4th Edition (1995) to Scourge (2003).',
        rules: '60 Cards • Up to 4 copies • Classic Frames (95-03)'
    },
    'Oldschool': {
        description: 'A nostalgic format using only the earliest Magic sets (from Alpha up through 1994).',
        rules: '60 Cards • Up to 4 copies • 93/94 Pool'
    },
    'Future': {
        description: 'Cards previewed for an upcoming set that are not yet officially released or tournament legal.',
        rules: '60 Cards • Spoiler Season'
    }
};

export const getFormatDetails = (format) => {
    // Exact match
    if (FORMAT_DESCRIPTIONS[format]) return FORMAT_DESCRIPTIONS[format];

    // Attempt case-insensitive match
    const match = Object.keys(FORMAT_DESCRIPTIONS).find(k => k.toLowerCase() === format.toLowerCase());
    if (match) return FORMAT_DESCRIPTIONS[match];

    return {
        description: `Build a deck for the ${format} format.`,
        rules: 'Custom or unlisted layout rules'
    };
};
