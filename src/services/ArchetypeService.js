
/**
 * Service to analyze a collection of cards and determine the player's "Archetype".
 * Returns a persona (Name, Colors, Playstyle Description).
 */
export const archetypeService = {

    analyze(cards) {
        if (!cards || cards.length < 10) return null; // Need some data

        const stats = {
            colors: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            types: { Creature: 0, Instant: 0, Sorcery: 0, Artifact: 0, Enchantment: 0, Planeswalker: 0, Land: 0 },
            totalCmc: 0,
            nonLandCount: 0
        };

        // 1. Gather Stats
        cards.forEach(card => {
            const data = card.data || card; // Handle different shapes

            // Colors (Simple count of identity or colors)
            const colors = data.colors;
            if (!colors || !Array.isArray(colors) || colors.length === 0) stats.colors.C++;
            else colors.forEach(c => { if (stats.colors[c] !== undefined) stats.colors[c]++; });

            // Types
            const typeLine = (data.type_line || '').toLowerCase();
            if (typeLine.includes('creature')) stats.types.Creature++;
            if (typeLine.includes('instant')) stats.types.Instant++;
            if (typeLine.includes('sorcery')) stats.types.Sorcery++;
            if (typeLine.includes('artifact')) stats.types.Artifact++;
            if (typeLine.includes('enchantment')) stats.types.Enchantment++;
            if (typeLine.includes('planeswalker')) stats.types.Planeswalker++;
            if (typeLine.includes('land')) stats.types.Land++;

            // CMC
            if (!typeLine.includes('land')) {
                stats.totalCmc += (data.cmc || 0);
                stats.nonLandCount++;
            }
        });

        // 2. Determine Top Colors (Color Identity)
        const sortedColors = Object.entries(stats.colors)
            .filter(([k, v]) => k !== 'C') // Ignore colorless for badge color, but use for checks
            .sort((a, b) => b[1] - a[1]);

        const topColors = sortedColors.slice(0, 2).filter(c => c[1] > (cards.length * 0.1)); // Must have at least 10% representation
        const colorKey = topColors.map(c => c[0]).sort().join('');

        const GUILDS = {
            'WU': 'Azorius', 'UB': 'Dimir', 'BR': 'Rakdos', 'RG': 'Gruul', 'GW': 'Selesnya',
            'WB': 'Orzhov', 'BG': 'Golgari', 'GU': 'Simic', 'UR': 'Izzet', 'RW': 'Boros'
        };
        const SHARDS = {
            'GWU': 'Bant', 'UWB': 'Esper', 'UBR': 'Grixis', 'BRG': 'Jund', 'RGW': 'Naya',
            'WBG': 'Abzan', 'URW': 'Jeskai', 'BGU': 'Sultai', 'RWB': 'Mardu', 'GUR': 'Temur'
        };

        let colorName = '';
        if (topColors.length === 0) colorName = 'Colorless';
        else if (topColors.length === 1) {
            const map = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
            colorName = `Mono-${map[topColors[0][0]]}`;
        }
        else if (topColors.length === 2) colorName = GUILDS[colorKey] || 'Dual-Color';
        else colorName = 'Multicolor';

        // 3. Determine Playstyle (Class)
        let className = 'Novice';
        let flavor = '';

        const typePcts = {};
        Object.keys(stats.types).forEach(k => typePcts[k] = stats.types[k] / cards.length);
        const avgCmc = stats.nonLandCount > 0 ? (stats.totalCmc / stats.nonLandCount) : 0;

        if (typePcts.Artifact > 0.15) {
            className = 'Artificer';
            flavor = 'Forging victory from steel and stone.';
        } else if (typePcts.Instant + typePcts.Sorcery > 0.30) {
            className = 'Spellslinger';
            flavor = 'Control the stack, control the game.';
        } else if (typePcts.Creature > 0.40) {
            if (avgCmc > 3.5) {
                className = 'Behemoth';
                flavor = 'Crushing foes with massive threats.';
            } else {
                className = 'Tactician';
                flavor = 'Overwhelming boards with numbers.';
            }
        } else if (typePcts.Enchantment > 0.15) {
            className = 'Enchantress';
            flavor = 'Weaving magic into permanent reality.';
        } else if (typePcts.Planeswalker > 0.05) {
            className = 'Superfriend';
            flavor = 'Summoning allies from across the multiverse.';
        } else if (avgCmc < 2.0) {
            className = 'Speedster';
            flavor = 'Efficiency is the key to victory.';
        } else {
            className = 'General';
            flavor = 'Balanced and ready for anything.';
        }

        // Final Title
        const title = `${colorName} ${className}`;

        return {
            title,
            className,
            colorName,
            colorKey,
            flavor,
            stats: {
                topColors,
                counts: stats.types
            }
        };
    }
};
