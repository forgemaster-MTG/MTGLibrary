
import { knex } from '../db.js';

const run = async () => {
    try {
        console.log("Simulating cardService.findCards behavior...");

        // 1. OLD Logic (type = 'legendary creature')
        const oldQuery = knex('cards')
            // Trying to mimic the strict "Legendary Creature" string check often used simpler
            .whereRaw("data->>'type_line' ILIKE ?", ['%Legendary%'])
            .andWhereRaw("data->>'type_line' ILIKE ?", ['%Creature%'])
            .orderBy('name', 'asc')
            .limit(50);

        const oldStart = Date.now();
        const oldRes = await oldQuery.select('name', 'data');
        console.log(`\nOLD Logic: ${oldRes.length} results found in ${Date.now() - oldStart}ms`);

        // 2. NEW Logic (isCommander = true)
        const newQuery = knex('cards')
            .where((builder) => {
                builder.whereRaw("data->>'type_line' ILIKE ?", ['%Legendary%'])
                    .andWhereRaw("data->>'type_line' ILIKE ?", ['%Creature%'])
                    .orWhereRaw("data->>'oracle_text' ILIKE ?", ['%can be your commander%'])
                    .orWhereRaw("(data->>'leadershipskills')::jsonb @> ?", ['{"commander": true}'])
                    .orWhereRaw("(data->>'leadership_skills')::jsonb @> ?", ['{"commander": true}']);
            })
            .orderBy('name', 'asc')
            .limit(50);

        const newStart = Date.now();
        const newRes = await newQuery.select('name', 'data');
        console.log(`NEW Logic (isCommander=true): ${newRes.length} results found in ${Date.now() - newStart}ms`);
        // console.log("Example:", newRes[0]?.name);

        // 3. Comparison
        const oldNames = new Set(oldRes.map(c => c.name));
        const newNames = new Set(newRes.map(c => c.name));

        const missing = oldRes.filter(c => !newNames.has(c.name));
        if (missing.length > 0) {
            console.log(`\nCRITICAL: ${missing.length} cards present in OLD but missing in NEW (first 5):`);
            missing.slice(0, 5).forEach(c => console.log(`  - ${c.name} [Type: ${c.data?.type_line}]`));
        } else {
            console.log("\nSuccess: New logic returns all results from Old logic (or more).");
        }

        const gained = newRes.filter(c => !oldNames.has(c.name));
        if (gained.length > 0) {
            console.log(`\nInfo: ${gained.length} cards present in NEW but missing in OLD (first 5):`);
            gained.slice(0, 5).forEach(c => console.log(`  - ${c.name} [Type: ${c.data?.type_line}]`));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
};

run();
