
import { knex } from '../db.js';

const run = async () => {
    try {
        const userId = 8;
        console.log(`Checking commanders for User ${userId}...`);

        // OLD Query
        // (type_line = 'legendary creature' was split in collection.js before)
        const oldCards = await knex('user_cards')
            .where({ user_id: userId })
            // .whereNull('deck_id') // User might have them in decks, filtering by deck_id might be the key?
            // The collection endpoint filters for whereNull('deck_id') unless deck_id param is null/binder
            // Let's mimic the endpoint EXACTLY
            .whereNull('deck_id')
            .where((builder) => {
                // Emulate collection.js old behavior: loop through terms
                builder.whereRaw("data->>'type_line' ILIKE ?", ['%legendary%']);
                builder.whereRaw("data->>'type_line' ILIKE ?", ['%creature%']);
            })
            .select('name', 'data');

        console.log(`\nOLD QUERY RESULTS (${oldCards.length}):`);
        // oldCards.forEach(c => console.log(`  - ${c.name} [Type: ${c.data?.type_line}]`));

        // NEW Query
        const newCardsQuery = knex('user_cards')
            .where({ user_id: userId })
            // MATCHING collection endpoint logic
            .whereNull('deck_id')
            .where((builder) => {
                builder.whereRaw("data->>'type_line' ILIKE ?", ['%Legendary%'])
                    .andWhereRaw("data->>'type_line' ILIKE ?", ['%Creature%'])
                    .orWhereRaw("data->>'oracle_text' ILIKE ?", ['%can be your commander%'])
                    .orWhereRaw("(data->>'leadershipskills')::jsonb @> ?", ['{"commander": true}'])
                    .orWhereRaw("(data->>'leadership_skills')::jsonb @> ?", ['{"commander": true}']);
            });

        const newCardsData = await newCardsQuery.select('name', 'data');

        console.log(`\nNEW QUERY RESULTS (${newCardsData.length}):`);
        // newCardsData.forEach(c => console.log(`  - ${c.name} [Type: ${c.data?.type_line}]`));

        // Comparison
        const oldSet = new Set(oldCards.map(c => c.name));
        const newSet = new Set(newCardsData.map(c => c.name));

        const missing = oldCards.filter(c => !newSet.has(c.name));
        if (missing.length > 0) {
            console.log("\nCRITICAL: MISSING IN NEW QUERY:");
            missing.forEach(c => {
                console.log(`  - ${c.name}`);
                console.log(`    Type: ${c.data?.type_line}`);
                console.log(`    Text: ${c.data?.oracle_text?.substring(0, 50)}...`);
            });
        } else {
            console.log("\nSUCCESS: All old cards present in new query.");
        }

        const gained = newCardsData.filter(c => !oldSet.has(c.name));
        if (gained.length > 0) {
            console.log(`\nINFO: GAINED IN NEW QUERY (${gained.length}):`);
            // gained.slice(0, 5).forEach(c => {
            //     console.log(`  - ${c.name}`);
            //     console.log(`    Type: ${c.data?.type_line}`);
            //     console.log(`    Text: ${c.data?.oracle_text?.substring(0, 50)}...`);
            // });
        }

    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
};

run();
