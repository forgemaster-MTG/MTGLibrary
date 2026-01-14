
import { knex } from '../server/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function cleanup() {
    console.log("Starting cleanup ROUND 2...");

    try {
        // Broaden search to find cards with no image or no underlying data object
        // This often happens when the partial add fails to resolve a scryfall object
        const badCards = await knex('user_cards')
            .whereNull('image_uri')
            .orWhereNull('data')
            .orWhere('image_uri', '')
            .orWhereRaw("data::text = 'null'"); // Check for JSON null if applicable

        const count = badCards.length;
        console.log(`Found ${count} cards with MISSING IMAGE or DATA.`);

        if (count > 0) {
            console.log("Sample:", badCards.slice(0, 3).map(c => ({
                id: c.id,
                name: c.name,
                set: c.set_code,
                cn: c.collector_number,
                hasImage: !!c.image_uri,
                hasData: !!c.data
            })));

            // Delete them
            const deleted = await knex('user_cards')
                .whereNull('image_uri')
                .orWhereNull('data')
                .orWhere('image_uri', '')
                .orWhereRaw("data::text = 'null'")
                .del();

            console.log(`Successfully deleted ${deleted} rows.`);
        } else {
            console.log("No missing-image/data cards found.");
        }

    } catch (err) {
        console.error("Cleanup failed:", err);
    } finally {
        await knex.destroy();
    }
}

cleanup();
