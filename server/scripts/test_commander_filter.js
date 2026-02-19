
import { knex } from '../db.js';

const run = async () => {
    try {
        console.log("Analyzing all users...");

        // 1. Fetch Users
        const users = await knex('users').select('id');
        let diffCount = 0;

        for (const user of users) {
            // 2. OLD Query Logic (Legendary AND Creature)
            const oldQuery = () => knex('user_cards')
                .where({ user_id: user.id })
                .whereNull('deck_id')
                .whereRaw("data->>'type_line' ILIKE ?", ['%Legendary%'])
                .whereRaw("data->>'type_line' ILIKE ?", ['%Creature%']);

            const oldRes = await oldQuery().count('* as count');
            const oldCount = parseInt(oldRes[0].count);

            // 3. NEW Query Logic ((Legendary AND Creature) OR Text)
            const newQuery = () => knex('user_cards')
                .where({ user_id: user.id })
                .whereNull('deck_id')
                .where((builder) => {
                    builder.whereRaw("data->>'type_line' ILIKE ?", ['%Legendary%'])
                        .andWhereRaw("data->>'type_line' ILIKE ?", ['%Creature%'])
                        .orWhereRaw("data->>'oracle_text' ILIKE ?", ['%can be your commander%']);
                });

            const newRes = await newQuery().count('* as count');
            const newCount = parseInt(newRes[0].count);

            // 4. Report Difference
            if (oldCount !== newCount) {
                console.log(`[UserId: ${user.id}] Difference Found! Old: ${oldCount}, New: ${newCount}`);
                diffCount++;

                if (diffCount <= 5) {
                    const oldIds = (await oldQuery().select('id')).map(r => r.id);
                    const newIds = (await newQuery().select('id')).map(r => r.id);
                    const uniqueNew = new Set(newIds);
                    const missingInNew = oldIds.filter(id => !uniqueNew.has(id));

                    if (missingInNew.length > 0) {
                        const sample = await knex('user_cards').whereIn('id', missingInNew).select('name', 'data');
                        console.log(`  MISSING CARDS (${sample.length}):`);
                        sample.forEach(c => {
                            console.log(`    - ${c.name} (Type: ${c.data?.type_line})`);
                        });
                    }
                }
            }
        }

        if (diffCount === 0) {
            console.log("No differences found across any users!");
        } else {
            console.log(`Total users with differences: ${diffCount}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await knex.destroy();
    }
};

run();
