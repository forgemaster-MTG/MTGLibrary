import React from 'react';

// Mana Icons (Scryfall SVG aliases)
const PIPS = ['W', 'U', 'B', 'R', 'G', 'C'];

export const IDENTITY_REGISTRY = {
    // Mono
    'W': { name: 'White', flavor: 'A single spark of light can banish a world of shadows.', theme: 'Absolute Order', pips: ['W'], bg: 'bg-yellow-600' },
    'U': { name: 'Blue', flavor: 'The mind is the only battlefield where victory is absolute.', theme: 'Infinite Inquiry', pips: ['U'], bg: 'bg-blue-600' },
    'B': { name: 'Black', flavor: 'Power at any cost, for greatness is written in blood.', theme: 'Unrestricted Power', pips: ['B'], bg: 'bg-gray-800' },
    'R': { name: 'Red', flavor: 'Do not fear the fire; fear the heart that commands it.', theme: 'Chaotic Passion', pips: ['R'], bg: 'bg-red-600' },
    'G': { name: 'Green', flavor: 'The forest does not ask for permission to grow.', theme: 'Primal Growth', pips: ['G'], bg: 'bg-green-600' },
    'C': { name: 'Colorless', flavor: 'Existence is a fleeting dream in the eyes of the silent.', theme: 'The Great Void', pips: ['C'], bg: 'bg-gray-500' },

    // Guilds (2 Colors)
    'WU': { name: 'Azorius Senate', flavor: 'Justice is blind, but she has a very long reach.', theme: 'Bureaucratic Control', pips: ['W', 'U'], bg: 'bg-gradient-to-br from-yellow-300 to-blue-500' },
    'UB': { name: 'House Dimir', flavor: 'The finest secrets are those that kill the ones who keep them.', theme: 'Subterfuge & Infiltration', pips: ['U', 'B'], bg: 'bg-gradient-to-br from-blue-600 to-black' },
    'BR': { name: 'Cult of Rakdos', flavor: 'Entertain us, or become the entertainment.', theme: 'Carnival of Carnage', pips: ['B', 'R'], bg: 'bg-gradient-to-br from-black to-red-600' },
    'RG': { name: 'Gruul Clans', flavor: 'Not for city-dwellers. Not for the weak. Only for the wild.', theme: 'Primal Destruction', pips: ['R', 'G'], bg: 'bg-gradient-to-br from-red-500 to-green-600' },
    'WG': { name: 'Selesnya Conclave', flavor: 'One voice is a whisper; the Conclave is a roar.', theme: 'Collective Harmony', pips: ['W', 'G'], bg: 'bg-gradient-to-br from-green-500 to-yellow-200' },
    'WB': { name: 'Orzhov Syndicate', flavor: 'Even death is no excuse for a breach of contract.', theme: 'Indentured Eternity', pips: ['W', 'B'], bg: 'bg-gradient-to-br from-gray-200 to-gray-900' },
    'BG': { name: 'Golgari Swarm', flavor: 'Every grave is a garden if you wait long enough.', theme: 'Cycles of Rot', pips: ['B', 'G'], bg: 'bg-gradient-to-br from-gray-900 to-green-600' },
    'UG': { name: 'Simic Combine', flavor: 'Nature is a rough draft; we are the final edit.', theme: 'Biological Evolution', pips: ['U', 'G'], bg: 'bg-gradient-to-br from-green-400 to-blue-500' },
    'UR': { name: 'Izzet League', flavor: "If it doesn't explode, you aren't trying hard enough.", theme: 'Volatile Genius', pips: ['U', 'R'], bg: 'bg-gradient-to-br from-blue-500 to-red-500' },
    'WR': { name: 'Boros Legion', flavor: 'First to the fight, last to the fall.', theme: 'Tactical Aggression', pips: ['W', 'R'], bg: 'bg-gradient-to-br from-red-600 to-yellow-200' },

    // Shards (3 Colors)
    'WUG': { name: 'Bant', flavor: 'The sigil of the sun protects those who stand together.', theme: 'Knightly Order', pips: ['W', 'U', 'G'], bg: 'bg-gradient-to-r from-green-400 via-yellow-200 to-blue-400' },
    'WUB': { name: 'Esper', flavor: 'Perfection is not a goal; it is a requirement.', theme: 'Obsidian Logic', pips: ['W', 'U', 'B'], bg: 'bg-gradient-to-r from-yellow-200 via-blue-400 to-black' },
    'UBR': { name: 'Grixis', flavor: 'A wasteland of power where only the cruelest thrive.', theme: 'Ruthless Tyranny', pips: ['U', 'B', 'R'], bg: 'bg-gradient-to-r from-blue-600 via-black to-red-600' },
    'BRG': { name: 'Jund', flavor: 'In this world, you are either the dragon or the meal.', theme: 'Apex Predation', pips: ['B', 'R', 'G'], bg: 'bg-gradient-to-r from-black via-red-600 to-green-600' },
    'WRG': { name: 'Naya', flavor: 'Where the mountains wake and the earth trembles.', theme: 'Primal Majesty', pips: ['W', 'R', 'G'], bg: 'bg-gradient-to-r from-red-500 via-green-500 to-yellow-200' },

    // Wedges (3 Colors)
    'WBG': { name: 'Abzan', flavor: 'We do not break; we simply outlast.', theme: 'Eternal Endurance', pips: ['W', 'B', 'G'], bg: 'bg-gradient-to-r from-yellow-100 via-black to-green-600' },
    'WUR': { name: 'Jeskai', flavor: 'The wind carries the strike; the mind guides the bolt.', theme: 'Disciplined Spark', pips: ['W', 'U', 'R'], bg: 'bg-gradient-to-r from-blue-500 via-red-500 to-yellow-100' },
    'UBG': { name: 'Sultai', flavor: 'Power is measured in gold and the bones of the fallen.', theme: 'Opulent Decay', pips: ['U', 'B', 'G'], bg: 'bg-gradient-to-r from-black via-green-600 to-blue-600' },
    'WBR': { name: 'Mardu', flavor: 'Victory is the only law worth following.', theme: 'Relentless Conquest', pips: ['W', 'B', 'R'], bg: 'bg-gradient-to-r from-red-600 via-yellow-100 to-black' },
    'URG': { name: 'Temur', flavor: 'The wild does not think; it reacts with ice and fire.', theme: 'Elemental Instinct', pips: ['U', 'R', 'G'], bg: 'bg-gradient-to-r from-green-500 via-blue-500 to-red-500' },

    // 4-Color
    'UBRG': { name: 'Glint-Eye', flavor: 'Order is a cage; we have chosen to break the locks.', theme: 'Chaotic Adaptation', pips: ['U', 'B', 'R', 'G'], bg: 'bg-indigo-900' },
    'WBRG': { name: 'Dune-Brood', flavor: 'When the logic of the mind fails, the instinct of the swarm prevails.', theme: 'Sandless Conquest', pips: ['W', 'B', 'R', 'G'], bg: 'bg-orange-900' },
    'WURG': { name: 'Ink-Treader', flavor: 'To touch one is to touch the whole of the world.', theme: 'Radiant Reflection', pips: ['W', 'U', 'R', 'G'], bg: 'bg-sky-900' },
    'WUBG': { name: 'Witch-Maw', flavor: 'There is a hunger beneath the earth that knows no fire.', theme: 'Eldritch Growth', pips: ['W', 'U', 'B', 'G'], bg: 'bg-emerald-900' },
    'WUBR': { name: 'Yore-Tiller', flavor: 'The past is a weapon we sharpen for the future.', theme: 'Relentless History', pips: ['W', 'U', 'B', 'R'], bg: 'bg-slate-900' },

    // 5-Color
    'WUBRG': { name: 'WUBRG', flavor: 'The full spectrum of power, bound in a single hand.', theme: 'The Convergence', pips: ['W', 'U', 'B', 'R', 'G'], bg: 'bg-gradient-to-r from-yellow-500 via-blue-500 to-green-500' }
};

export const getIdentity = (key) => {
    if (!key) return IDENTITY_REGISTRY['C'];

    // Normalize Key (Sort WUBRG)
    const wubrgOrder = { 'W': 0, 'U': 1, 'B': 2, 'R': 3, 'G': 4, 'C': -1 };

    // Handle array or string
    let chars = Array.isArray(key) ? key : key.split('');

    // Deduplicate and filter valid symbols
    const uniqueChars = [...new Set(chars)].filter(c => wubrgOrder[c] !== undefined && c !== 'C');

    // Sort
    const sortedKey = uniqueChars.sort((a, b) => wubrgOrder[a] - wubrgOrder[b]).join('');

    return IDENTITY_REGISTRY[sortedKey] || IDENTITY_REGISTRY['C'];
};
