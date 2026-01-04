
/**
 * Smart Binder "AI" Logic
 * Parses natural language prompts into structural JSON rules for the Binder system.
 * 
 * Supported Concepts:
 * - Types: Creature, Land, Artifact, Enchantment, etc.
 * - Subtypes/Keywords: Commander (Legendary Creature), Goblin, Elf, etc.
 * - Colors: Red, Blue, Green, White, Black, Colorless, Multi, Mono
 * - Rarity: Rare, Mythic, Common, Uncommon
 * - Economics: Expensive, Cheap, Value, Bulk (> $5, < $1, > $10, etc.)
 * - Collections: In Deck, Not In Deck, Duplicates, Playsets (> 4)
 */

export const parseSmartPrompt = (prompt) => {
    const p = prompt.toLowerCase();
    const rules = [];
    let name = "Smart Binder";
    let icon = "🧠";
    let color = "blue";
    let description = `Generated from "${prompt}"`;

    // --- 1. Meta-Analysis (Name/Icon/Theme) ---

    // Theme: Red
    if (p.includes('red') || p.includes('fire') || p.includes('mountain') || p.includes('burn')) {
        color = 'red';
        if (!p.includes('goblin')) name = 'Red Collection';
    }
    // Theme: Green
    if (p.includes('green') || p.includes('forest') || p.includes('elf') || p.includes('nature')) {
        color = 'green';
        if (!p.includes('elf')) name = 'Green Collection';
    }
    // Theme: Blue
    if (p.includes('blue') || p.includes('island') || p.includes('control') || p.includes('water')) {
        color = 'blue';
        name = 'Blue Collection';
    }
    // Theme: Black
    if (p.includes('black') || p.includes('swamp') || p.includes('death') || p.includes('grave')) {
        color = 'purple'; // closest to black in our palette
        name = 'Black Collection';
    }
    // Theme: White
    if (p.includes('white') || p.includes('plains') || p.includes('light') || p.includes('angel')) {
        color = 'gray'; // white/gray
        name = 'White Collection';
    }

    // --- 2. Rule Extraction ---

    // TYPE: Commanders / Legends
    if (p.includes('commander') || p.includes('legend') || p.includes('edh')) {
        rules.push({ field: 'type', operator: 'contains', value: 'Legendary Creature' });
        icon = "👑";
        name = "Commanders";
        if (p.includes('potential') || p.includes('candidate')) name = "Potential Commanders";
    }

    // TYPE: Creatures
    else if (p.includes('creature')) {
        rules.push({ field: 'type', operator: 'contains', value: 'Creature' });
        if (name === 'Smart Binder') { name = "Creatures"; icon = "🐾"; }
    }

    // TYPE: Lands
    if (p.includes('land')) {
        rules.push({ field: 'type', operator: 'contains', value: 'Land' });
        icon = "🏔️";
        name = "Lands";
    }

    // TYPE: Artifacts
    if (p.includes('artifact') || p.includes('rock')) {
        rules.push({ field: 'type', operator: 'contains', value: 'Artifact' });
        icon = "🏺";
        name = "Artifacts";
    }

    // TYPE: Enchantments
    if (p.includes('enchantment')) {
        rules.push({ field: 'type', operator: 'contains', value: 'Enchantment' });
        icon = "✨";
        name = "Enchantments";
    }

    // SUBTYPE: Goblins
    if (p.includes('goblin')) {
        rules.push({ field: 'type', operator: 'contains', value: 'Goblin' });
        icon = "👺";
        name = "Goblin Tribe";
        color = "red";
    }

    // SUBTYPE: Elves
    if (p.includes('elf') || p.includes('elves')) {
        rules.push({ field: 'type', operator: 'contains', value: 'Elf' });
        icon = "🧝";
        name = "Elven Tribe";
        color = "green";
    }

    // STATUS: Not In Deck
    if (p.includes('not in deck') || p.includes('unused') || p.includes('spare') || p.includes('binder fodder')) {
        rules.push({ field: 'in_deck', operator: 'is', value: 'false' });
        // Refine name if generic
        if (name === "Smart Binder") name = "Unused Cards";
        else name = `Unused ${name}`;
    }
    // STATUS: In Deck
    else if (p.includes('in deck') || p.includes('used') || p.includes('active')) {
        rules.push({ field: 'in_deck', operator: 'is', value: 'true' });
        name = `Active ${name}`;
    }

    // ECONOMY: Expensive / Value
    if (p.includes('expensive') || p.includes('value') || p.includes('money') || p.includes('high end') || (p.includes('sell') && !p.includes('not') && !p.includes('dont') && !p.includes('wouldnt'))) {
        rules.push({ field: 'price', operator: 'gt', value: '5.00' });
        icon = "💎";
        if (!name.includes("Commander")) name = "High Value";
    }

    // ECONOMY: Bulk / Cheap / Not Selling
    if (p.includes('bulk') || p.includes('cheap') || p.includes('pauper') || (p.includes('sell') && (p.includes('not') || p.includes('dont') || p.includes('wouldnt')))) {
        rules.push({ field: 'price', operator: 'lt', value: '1.00' });
        icon = "📦";
        name = "Bulk Storage";
    }

    // TRADE / BINDER
    if (p.includes('trade')) {
        // Often trade binders have value, but sometimes just "trade" means anything available.
        // If they say "trade" and "not sell", it implies keeping it for trading, but maybe not high value? 
        // Let's stick to the user's specific case: "Cards to trade... wouldn't want to sell" -> likely implies accessible value but not super expensive, or just general trade.
        // For widely applicable "Trade Binder", we often check for non-bulk or just duplicates.
        // Refined: If just "trade", maybe filtered by duplicates or value > $1?
        // Let's keep it simple: Trade usually means "Not in Deck".
        if (!rules.some(r => r.field === 'in_deck')) {
            rules.push({ field: 'in_deck', operator: 'is', value: 'false' });
        }
        name = "Trade Binder";
        icon = "🤝";
    }

    // RARITY
    const rarities = [];
    if (p.includes('rare')) rarities.push('rare');
    if (p.includes('mythic')) rarities.push('mythic');
    if (rarities.length > 0) {
        rules.push({ field: 'rarity', operator: 'in', value: rarities });
        if (!icon || icon === '🧠') icon = "🌟";
    }

    // INVENTORY: Duplicates / Playsets / Quantity
    if (p.includes('duplicate') || p.includes('playset') || p.includes('extra') || p.includes('few of') || p.includes('many')) {
        rules.push({ field: 'count', operator: 'gt', value: '4' });
        if (name === "Smart Binder") name = "Trade Stock";
        icon = "🔄";
    }

    // --- 3. Fallback ---
    // If no rules were generated, fallback to name match to prevent empty binders
    if (rules.length === 0) {
        rules.push({ field: 'name', operator: 'contains', value: prompt });
    }

    return {
        id: `ai-${Date.now()}`,
        name,
        description,
        icon,
        color,
        rules
    };
};
