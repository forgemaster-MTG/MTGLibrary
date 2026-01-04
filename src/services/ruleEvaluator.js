/**
 * Simple frontend logic to evaluate Smart Binder rules against cards
 */
export const evaluateRules = (card, rules) => {
    if (!rules || !Array.isArray(rules) || rules.length === 0) return true;

    // Use .every for AND logic (as implemented in backend)
    return rules.every(rule => {
        const { field, operator, value } = rule;

        let cardValue;

        // Map fields to card properties
        switch (field) {
            case 'name':
                cardValue = card.name || '';
                break;
            case 'colors':
                cardValue = card.data?.color_identity || [];
                break;
            case 'rarity':
                cardValue = card.data?.rarity || '';
                break;
            case 'type':
                cardValue = card.data?.type_line || '';
                break;
            case 'price':
                cardValue = parseFloat(card.data?.prices?.usd || 0);
                break;
            case 'set':
                cardValue = card.data?.set_name || '';
                const setCode = card.data?.set || '';
                if (operator === 'contains') {
                    return (cardValue.toLowerCase().includes(String(value).toLowerCase()) ||
                        setCode.toLowerCase().includes(String(value).toLowerCase()));
                }
                break;
            case 'cmc':
                cardValue = parseFloat(card.data?.cmc || 0);
                break;
            case 'count':
                cardValue = parseInt(card.count || 0, 10);
                break;
            case 'in_deck':
                const isInDeck = !!card.deck_id;
                return value === 'true' ? isInDeck : !isInDeck;
            default:
                cardValue = card.data?.[field] || '';
        }

        const ruleVal = Array.isArray(value) ? value : String(value);

        switch (operator) {
            case 'is':
            case 'eq':
                return String(cardValue).toLowerCase() === String(ruleVal).toLowerCase();
            case 'not':
                return String(cardValue).toLowerCase() !== String(ruleVal).toLowerCase();
            case 'contains':
                return String(cardValue).toLowerCase().includes(String(ruleVal).toLowerCase());
            case 'gt':
            case 'greater_than':
                return parseFloat(cardValue) > parseFloat(ruleVal);
            case 'lt':
            case 'less_than':
                return parseFloat(cardValue) < parseFloat(ruleVal);
            case 'in':
                return Array.isArray(ruleVal) ? ruleVal.includes(String(cardValue).toLowerCase()) : false;
            case 'not_in':
                return Array.isArray(ruleVal) ? !ruleVal.includes(String(cardValue).toLowerCase()) : true;
            case 'contains_any':
                if (Array.isArray(cardValue)) {
                    return Array.isArray(ruleVal) ? ruleVal.some(v => cardValue.includes(v)) : false;
                }
                return false;
            case 'is_exactly':
                if (Array.isArray(cardValue)) {
                    return JSON.stringify(cardValue.sort()) === JSON.stringify(ruleVal.sort());
                }
                return false;
            default:
                return false;
        }
    });
};
