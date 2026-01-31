import { knex } from './server/db.js';

async function check() {
    console.log("Checking for TLA cards...");
    try {
        const setCode = 'tla';
        const cn = '13';

        // 1. Check if set exists in cards table
        const cards = await knex('cards').where({ setcode: setCode }).limit(5);
        console.log(`\n--- Set '${setCode}' ---`);
        console.log(`Found ${cards.length} sample cards.`);
        cards.forEach(c => console.log(`- ${c.name} (CN: ${c.number})`));

        // 2. Check for "Solstice Revelations" specifically
        console.log(`\n--- Searching for 'Solstice Revelations' ---`);
        const byName = await knex('cards').where({ name: 'Solstice Revelations' }).first();
        if (byName) {
            console.log(`FOUND by Name! Set: ${byName.setcode}, CN: ${byName.number}`);
        } else {
            console.log("NOT FOUND by exact Name.");
            // Try fuzzy
            const fuzzy = await knex('cards').whereRaw("name ILIKE ?", ['%Solstice%']).limit(3);
            if (fuzzy.length) {
                console.log("Found Fuzzy Matches:");
                fuzzy.forEach(c => console.log(`- ${c.name} (${c.setcode})`));
            } else {
                console.log("No fuzzy matches found.");
            }
        }

        // 3. Check for CN 13 in TLA
        console.log(`\n--- Searching for CN ${cn} in ${setCode} ---`);
        const byCN = await knex('cards').where({ setcode: setCode, number: cn }).first();
        if (byCN) {
            console.log(`FOUND by CN! Name: ${byCN.name}`);
        } else {
            console.log("NOT FOUND by exact CN.");
            // Flexible CN check (ignore leading zeros)
            const flexCN = await knex('cards')
                .whereRaw("lower(setcode) = ? AND ltrim(number, '0') = ?", [setCode, cn])
                .first();
            if (flexCN) {
                console.log(`FOUND by Flexible CN! Name: ${flexCN.name} (CN: ${flexCN.number})`);
            } else {
                console.log("NOT FOUND by Flexible CN.");
            }
        }

    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        process.exit();
    }
}

check();
