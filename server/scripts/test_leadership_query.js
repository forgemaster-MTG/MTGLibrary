
import { knex } from '../db.js';

const run = async () => {
    try {
        const userId = 8;
        console.log("Testing leadershipskills query syntax...");

        // 1. Direct JSONB containment (Current Implementation)
        // Checks if the VALUE itself is a JSON object containing {"commander": true}
        const query1 = await knex('user_cards')
            .where({ user_id: userId })
            .whereRaw("name ILIKE '%Shorikai%'")
            .whereRaw("data->'leadershipskills' @> ?", ['{"commander": true}'])
            .count('* as count');

        console.log(`Query 1 (Direct JSONB @>): ${query1[0].count} matches`);

        // 2. Cast to JSONB then containment
        // Takes the text value, parses it as JSON, then checks
        try {
            const query2 = await knex('user_cards')
                .where({ user_id: userId })
                .whereRaw("name ILIKE '%Shorikai%'")
                .whereRaw("(data->>'leadershipskills')::jsonb @> ?", ['{"commander": true}'])
                .count('* as count');
            console.log(`Query 2 (Cast to JSONB @>): ${query2[0].count} matches`);
        } catch (e) {
            console.log(`Query 2 Failed: ${e.message}`);
        }

        // 3. Text Match (Safe fallback)
        const query3 = await knex('user_cards')
            .where({ user_id: userId })
            .whereRaw("name ILIKE '%Shorikai%'")
            // Handle spaces or no spaces
            .whereRaw("data->>'leadershipskills' ILIKE ?", ['%"commander":%true%'])
            .count('* as count');

        console.log(`Query 3 (Text ILIKE): ${query3[0].count} matches`);

    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
};

run();
