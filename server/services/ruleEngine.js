/**
 * Translates JSON rules into Knex query conditions
 * @param {import('knex').Knex.QueryBuilder} query - The knex query builder
 * @param {Array} rules - Array of rule objects: { field, operator, value }
 */
export function applyRules(query, rules) {
    if (!rules || !Array.isArray(rules)) return query;

    rules.forEach(rule => {
        const { field, operator, value } = rule;

        // Handle specific fields and their mapping to DB columns or JSON data
        switch (field) {
            case 'name':
                applyStringFilter(query, 'user_cards.name', operator, value);
                break;
            case 'colors':
                // Check color_identity in data JSON
                applyJsonArrayFilter(query, "user_cards.data->'color_identity'", operator, value);
                break;
            case 'rarity':
                applyJsonStringFilter(query, "user_cards.data->>'rarity'", operator, value);
                break;
            case 'type':
                applyJsonStringFilter(query, "user_cards.data->>'type_line'", operator, value);
                break;
            case 'price':
                // Scryfall prices are in data.prices.usd
                const priceValue = parseFloat(value);
                if (!isNaN(priceValue)) {
                    applyNumericFilter(query, "CAST(user_cards.data->'prices'->>'usd' AS NUMERIC)", operator, priceValue);
                }
                break;
            case 'set':
                // Set name or code (Grouped to prevent OR logic leak)
                query.where(q => {
                    applyJsonStringFilter(q, "user_cards.data->>'set_name'", operator, value);
                    // Also allow matching set code if it looks like one
                    if (typeof value === 'string' && value.length <= 4) {
                        q.orWhereRaw("user_cards.data->>'set' ILIKE ?", [`%${value}%`]);
                    }
                });
                break;
            case 'cmc':
                applyNumericFilter(query, "CAST(user_cards.data->>'cmc' AS NUMERIC)", operator, value);
                break;
            case 'count':
                applyNumericFilter(query, "user_cards.count", operator, parseInt(value, 10));
                break;
            case 'in_deck':
                if (value === 'true') {
                    query.whereNotNull('user_cards.deck_id');
                } else {
                    query.whereNull('user_cards.deck_id');
                }
                break;
            default:
                // Fallback for any other field in the data JSON
                applyJsonStringFilter(query, `user_cards.data->>'${field}'`, operator, value);
        }
    });

    return query;
}

function applyStringFilter(query, column, operator, value) {
    switch (operator) {
        case 'is':
            query.where(column, value);
            break;
        case 'contains':
            query.whereRaw(`${column} ILIKE ?`, [`%${value}%`]);
            break;
        case 'not':
            query.whereNot(column, value);
            break;
        case 'in':
            query.whereIn(column, Array.isArray(value) ? value : [value]);
            break;
    }
}

function applyJsonStringFilter(query, column, operator, value) {
    switch (operator) {
        case 'is':
            query.whereRaw(`${column} = ?`, [value]);
            break;
        case 'contains':
            query.whereRaw(`${column} ILIKE ?`, [`%${value}%`]);
            break;
        case 'not':
            query.whereRaw(`${column} != ?`, [value]);
            break;
        case 'in':
            const values = Array.isArray(value) ? value : [value];
            query.whereRaw(`${column} IN (${values.map(() => '?').join(',')})`, values);
            break;
        case 'not_in':
            const notValues = Array.isArray(value) ? value : [value];
            query.whereRaw(`${column} NOT IN (${notValues.map(() => '?').join(',')})`, notValues);
            break;
    }
}

function applyJsonArrayFilter(query, column, operator, value) {
    // PostgreS JSONB containment
    // value could be 'G' or ['G', 'W']
    const values = Array.isArray(value) ? value : [value];

    switch (operator) {
        case 'contains':
            // Check if array contains ALL specified values
            query.whereRaw(`${column} @> ?`, [JSON.stringify(values)]);
            break;
        case 'contains_any':
            // Check if array contains ANY of the specified values
            query.whereRaw(`${column} ?| array[${values.map(() => '?').join(',')}]`, values);
            break;
        case 'is_exactly':
            query.whereRaw(`${column} = ?`, [JSON.stringify(values)]);
            break;
    }
}

function applyNumericFilter(query, column, operator, value) {
    switch (operator) {
        case 'eq':
        case 'is':
            query.whereRaw(`${column} = ?`, [value]);
            break;
        case 'gt':
        case 'greater_than':
            query.whereRaw(`${column} > ?`, [value]);
            break;
        case 'lt':
        case 'less_than':
            query.whereRaw(`${column} < ?`, [value]);
            break;
        case 'gte':
            query.whereRaw(`${column} >= ?`, [value]);
            break;
        case 'lte':
            query.whereRaw(`${column} <= ?`, [value]);
            break;
    }
}
