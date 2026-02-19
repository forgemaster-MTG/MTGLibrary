export const MTG_IDENTITY_REGISTRY = [
    // Mono Colors
    { badge: "White", colors: ["W"], flavor: "Order, protection, and the light of law." },
    { badge: "Blue", colors: ["U"], flavor: "Knowledge, manipulation, and the perfection of mind." },
    { badge: "Black", colors: ["B"], flavor: "Power, ambition, and death at any cost." },
    { badge: "Red", colors: ["R"], flavor: "Freedom, emotion, and the fire of impulse." },
    { badge: "Green", colors: ["G"], flavor: "Nature, instinct, and the strength of the wild." },
    { badge: "Colorless", colors: ["C"], flavor: "The void between, pure and unyielding." },

    // Guilds (2 Colors)
    { badge: "Azorius", colors: ["W", "U"], flavor: "The law is the shield of the just." },
    { badge: "Dimir", colors: ["U", "B"], flavor: "Knowledge is power, and we know everything." },
    { badge: "Rakdos", colors: ["B", "R"], flavor: "Entertainment is a serious business." },
    { badge: "Gruul", colors: ["R", "G"], flavor: "Not Gruul? Then die!" },
    { badge: "Selesnya", colors: ["G", "W"], flavor: "Together, we are the world's soul." },
    { badge: "Orzhov", colors: ["W", "B"], flavor: "Wealth is power, and spirit is currency." },
    { badge: "Izzet", colors: ["U", "R"], flavor: "Genius and madness are two sides of the same coin." },
    { badge: "Golgari", colors: ["B", "G"], flavor: "Life and death are a continuous circle." },
    { badge: "Boros", colors: ["R", "W"], flavor: "Strike fast, strike hard, strike true." },
    { badge: "Simic", colors: ["G", "U"], flavor: "Nature, perfected by design." },

    // Shards (3 Colors)
    { badge: "Esper", colors: ["W", "U", "B"], flavor: "Perfection through etherium and discipline." },
    { badge: "Grixis", colors: ["U", "B", "R"], flavor: "Life is short, death is forever." },
    { badge: "Jund", colors: ["B", "R", "G"], flavor: "Only the strongest survive the feeding frenzy." },
    { badge: "Naya", colors: ["R", "G", "W"], flavor: "Where giant beasts roam and the wild reigns." },
    { badge: "Bant", colors: ["G", "W", "U"], flavor: "Honor, valor, and the righteousness of caste." },

    // Wedges (3 Colors)
    { badge: "Abzan", colors: ["W", "B", "G"], flavor: "Family is the only fortress that matters." },
    { badge: "Jeskai", colors: ["U", "R", "W"], flavor: "Cunning strategies and swift strikes." },
    { badge: "Sultai", colors: ["B", "G", "U"], flavor: "Ruthlessness is a virtue in the opulent dark." },
    { badge: "Mardu", colors: ["R", "W", "B"], flavor: "Speed of the horse, edge of the blade." },
    { badge: "Temur", colors: ["G", "U", "R"], flavor: "Savagery concealed by ice and snow." },

    // 4 Colors
    { badge: "Glint-Eye", "colors": ["U", "B", "R", "G"], flavor: "Chaos without order." }, // Non-White
    { badge: "Dune-Brood", "colors": ["W", "B", "R", "G"], flavor: "Growth through conflict." }, // Non-Blue
    { badge: "Ink-Treader", "colors": ["W", "U", "R", "G"], flavor: "Motion without purpose." }, // Non-Black
    { badge: "Witch-Maw", "colors": ["W", "U", "B", "G"], flavor: "Life without death." }, // Non-Red
    { badge: "Yore-Tiller", "colors": ["W", "U", "B", "R"], flavor: "Artifice without nature." }, // Non-Green

    // 5 Colors
    { badge: "WUBRG", colors: ["W", "U", "B", "R", "G"], flavor: "All five colors in perfect harmony." }
];

// Helper to map colors to styling
const getStyle = (badge, colors) => {
    if (!colors || colors.length === 0) return { bg: 'bg-gray-500', color: 'text-gray-400' };

    // Mono
    if (colors.length === 1) {
        switch (colors[0]) {
            case 'W': return { bg: 'bg-yellow-400', color: 'text-yellow-200' };
            case 'U': return { bg: 'bg-blue-500', color: 'text-blue-400' };
            case 'B': return { bg: 'bg-gray-800', color: 'text-gray-400' };
            case 'R': return { bg: 'bg-red-500', color: 'text-red-400' };
            case 'G': return { bg: 'bg-green-500', color: 'text-green-400' };
            case 'C': return { bg: 'bg-gray-400', color: 'text-gray-300' };
        }
    }

    // Guilds
    if (colors.length === 2) {
        // Simple mapping based on badge names if desired, or just generic gold
        return { bg: 'bg-amber-600', color: 'text-amber-400' }; // Gold for multicolor
    }

    // 3+ Colors
    return { bg: 'bg-primary-500', color: 'text-primary-400' };
};

export const getIdentity = (colors) => {
    // Sanitize
    const c = colors || [];
    const len = c.length;

    // Exact match search
    const match = MTG_IDENTITY_REGISTRY.find(entry => {
        if (entry.badge === 'Colorless' && (len === 0 || (len === 1 && c[0] === 'C'))) return true;
        if (entry.colors.length !== len) return false;
        return entry.colors.every(col => c.includes(col));
    });

    const base = match || { badge: "Commander", colors: c, flavor: "A unique combination of powers." };
    const styles = getStyle(base.badge, base.colors);

    return {
        ...base,
        pips: base.colors, // Widget expects 'pips'
        bg: styles.bg,
        color: styles.color
    };
};
