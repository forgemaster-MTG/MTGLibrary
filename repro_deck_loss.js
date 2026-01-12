import { knex } from './server/db.js';

async function test() {
    console.log("Starting reproduction test...");

    // 1. Create a dummy user
    const [userId] = await knex('users').insert({
        email: 'test@example.com',
        firestore_id: 'test-uid-' + Date.now(),
        username: 'testuser' + Date.now()
    }).returning('id');

    console.log(`Created test user ${userId}`);

    // 2. Create some decks
    await knex('user_decks').insert([
        { user_id: userId, name: 'Deck 1' },
        { user_id: userId, name: 'Deck 2' }
    ]);

    const initialDecks = await knex('user_decks').where({ user_id: userId }).count('id as count');
    console.log(`Initial deck count: ${initialDecks[0].count}`);

    // 3. Simulate Import (Replace Mode, No Decks)
    const cards = [{ id: 'scry-1', name: 'Test Card', set_code: 'SET', collector_number: '1' }];
    const decks = undefined; // What we expect from a card-only backup
    const mode = 'replace';

    console.log(`Simulating import: mode=${mode}, decks=${decks}`);

    // REPRODUCE LOGIC FROM collection.js
    await knex.transaction(async (trx) => {
        if (mode === 'replace') {
            await trx('user_cards').where({ user_id: userId }).del();

            if (decks && Array.isArray(decks) && decks.length > 0) {
                await trx('user_decks').where({ user_id: userId }).del();
            }
        }

        // ... (Skipping full insertion for brevity)
    });

    const finalDecks = await knex('user_decks').where({ user_id: userId }).count('id as count');
    console.log(`Final deck count: ${finalDecks[0].count}`);

    if (finalDecks[0].count === initialDecks[0].count) {
        console.log("SUCCESS: Decks were preserved!");
    } else {
        console.log("FAILURE: Decks were deleted!");
    }

    // Cleanup
    await knex('user_decks').where({ user_id: userId }).del();
    await knex('users').where({ id: userId }).del();
    process.exit();
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
