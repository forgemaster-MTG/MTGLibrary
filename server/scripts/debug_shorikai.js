
import { knex } from '../db.js';

const run = async () => {
    try {
        console.log("Searching for 'Shorikai' in user_cards...");

        // 1. Find ANY card named Shorikai
        const cards = await knex('user_cards')
            .whereRaw('name ILIKE ?', ['%Shorikai%'])
            .select('id', 'name', 'user_id', 'data');

        if (cards.length === 0) {
            console.log("No card named 'Shorikai' found in user_cards.");
        } else {
            console.log(`${cards.length} 'Shorikai' cards found.`);
            cards.forEach(c => {
                console.log(`\nCard ID: ${c.id} (User: ${c.user_id})`);
                console.log(`  Name: ${c.name}`);
                console.log(`  Type Line: ${c.data?.type_line || 'undefined'}`);

                // LEADERSHIP SKILLS CHECK
                const leadership = c.data?.leadership_skills || c.data?.leadershipskills;
                console.log(`  Leadership Skills:`, JSON.stringify(leadership, null, 2));

                const typeLine = c.data?.type_line || '';
                const oracleText = c.data?.oracle_text || '';

                const isLegendary = /Legendary/i.test(typeLine);
                const isCreature = /Creature/i.test(typeLine);
                const isCmdr = /can be your commander/i.test(oracleText);

                console.log(`  Condition Check:`);
                console.log(`    Legendary: ${isLegendary}`);
                console.log(`    Creature: ${isCreature}`);
                console.log(`    "can be your commander": ${isCmdr}`);
                console.log(`    Matches Filter? ${(isLegendary && isCreature) || isCmdr}`);
            });
        }
    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
};

run();
