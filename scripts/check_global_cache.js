
import { knex } from '../server/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkCache() {
    console.log("Checking global 'cards' table for bad entries...");
    try {
        const badCards = await knex('cards')
            // Check for missing data or missing image_uris in data
            .whereRaw("data IS NULL OR data::text = 'null'")
            .orWhereRaw("NOT jsonb_exists(data, 'image_uris') AND NOT jsonb_exists(data, 'card_faces')");

        console.log(`Found ${badCards.length} potentially bad cards in global cache.`);

        if (badCards.length > 0) {
            console.log("Sample:", badCards.slice(0, 3).map(c => ({
                id: c.uuid,
                name: c.name,
                hasData: !!c.data,
                hasImageUris: c.data?.image_uris,
                hasCardFaces: c.data?.card_faces
            })));

            const deleted = await knex('cards')
                .whereRaw("data IS NULL OR data::text = 'null'")
                .orWhereRaw("NOT jsonb_exists(data, 'image_uris') AND NOT jsonb_exists(data, 'card_faces')")
                .del();

            console.log(`Successfully deleted ${deleted} rows from global cache.`);
        } else {
            console.log("Global cache is clean!");
        }

    } catch (err) {
        console.error("Check failed:", err);
    } finally {
        await knex.destroy();
    }
}

checkCache();
