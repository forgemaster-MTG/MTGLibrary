
import { knex } from '../db.js';

async function verifyIsPublicUpdate() {
    try {
        console.log("Starting verification...");

        // 1. Find a test deck
        const deck = await knex('user_decks').first();
        if (!deck) {
            console.log("No decks found to test.");
            return;
        }

        console.log(`Testing with Deck ID: ${deck.id} (Current is_public: ${deck.is_public})`);

        // 2. Set to TRUE
        await knex('user_decks').where({ id: deck.id }).update({ is_public: true });
        const updatedTrue = await knex('user_decks').where({ id: deck.id }).first();
        console.log(`Set TRUE -> DB Value: ${updatedTrue.is_public} (${typeof updatedTrue.is_public})`);

        // 3. Set to FALSE
        await knex('user_decks').where({ id: deck.id }).update({ is_public: false });
        const updatedFalse = await knex('user_decks').where({ id: deck.id }).first();
        console.log(`Set FALSE -> DB Value: ${updatedFalse.is_public} (${typeof updatedFalse.is_public})`);

        // 4. Restore original
        await knex('user_decks').where({ id: deck.id }).update({ is_public: deck.is_public });
        console.log("Restored original value.");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await knex.destroy();
        process.exit(0);
    }
}

verifyIsPublicUpdate();
