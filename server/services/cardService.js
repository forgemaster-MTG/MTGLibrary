import { knex } from '../db.js';

/**
 * Service to handle card metadata fetching and database synchronization.
 */
export const cardService = {
    /**
     * Helper to resolve an image URI from Scryfall card data.
     */
    resolveImage(cardData) {
        if (!cardData) return null;
        if (cardData.image_uris?.normal) return cardData.image_uris.normal;
        if (cardData.card_faces?.[0]?.image_uris?.normal) return cardData.card_faces[0].image_uris.normal;
        return null;
    },

    /**
     * Ensures a card has metadata in the global 'cards' table.
     */
    async ensureCardData(card) {
        if (card.data && card.data.image_uris) {
            return card;
        }

        console.log(`[CardService] Repairing global card data: ${card.name} (${card.setcode} #${card.number})`);

        try {
            const v4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            const scryfallId = card.uuid || card.data?.id;

            // Healing: If ID is missing or not Version 4, fallback to set/number search
            let apiUri;
            if (scryfallId && v4Regex.test(scryfallId)) {
                apiUri = `https://api.scryfall.com/cards/${scryfallId}`;
            } else {
                console.log(`[CardService] Suspect/Missing ID for ${card.name}. Using set/number fallback.`);
                apiUri = `https://api.scryfall.com/cards/${card.setcode.toLowerCase()}/${card.number}`;
            }

            const response = await fetch(apiUri);
            if (!response.ok) {
                console.warn(`[CardService] Failed to fetch from Scryfall: ${apiUri} (${response.status})`);
                return card;
            }

            const cardData = await response.json();

            const update = {
                data: cardData,
                name: cardData.name,
                setcode: cardData.set.toUpperCase(),
                number: cardData.collector_number,
                type: cardData.type_line,
                manacost: cardData.mana_cost,
                text: cardData.oracle_text,
                rarity: cardData.rarity,
                uuid: cardData.id // Ensure we store the fresh v4 ID
            };

            await knex('cards').where({ id: card.id }).update(update);
            return { ...card, ...update };
        } catch (err) {
            console.error(`[CardService] Error repairing card ${card.name}:`, err);
            return card;
        }
    },

    /**
     * Repairs a specific user_card entry.
     */
    async repairUserCard(userCard) {
        // If it already has data and an image, we're likely good
        if (userCard.data && userCard.image_uri) return userCard;

        console.log(`[CardService] Repairing user card: ${userCard.name} (${userCard.id})`);

        try {
            const v4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            let cardData = userCard.data;

            if (!cardData) {
                let apiUri;
                if (userCard.scryfall_id && v4Regex.test(userCard.scryfall_id)) {
                    apiUri = `https://api.scryfall.com/cards/${userCard.scryfall_id}`;
                } else {
                    console.log(`[CardService] Suspect/Missing ID for ${userCard.name}. Using set/number fallback.`);
                    apiUri = `https://api.scryfall.com/cards/${userCard.set_code.toLowerCase()}/${userCard.collector_number}`;
                }

                const response = await fetch(apiUri);
                if (response.ok) {
                    cardData = await response.json();
                }
            }

            if (!cardData) return userCard;

            const imageUri = this.resolveImage(cardData);
            const freshId = cardData.id;

            const update = {
                data: cardData,
                image_uri: imageUri,
                name: cardData.name,
                set_code: cardData.set.toUpperCase(),
                collector_number: cardData.collector_number,
                scryfall_id: freshId // Heal the ID
            };

            await knex('user_cards').where({ id: userCard.id }).update(update);
            return { ...userCard, ...update };
        } catch (err) {
            console.error(`[CardService] Error repairing user card ${userCard.name}:`, err);
            return userCard;
        }
    },

    /**
     * Batch repair for multiple cards.
     */
    async repairCards(cards, table = 'cards') {
        const results = [];
        for (const card of cards) {
            if (table === 'user_cards') {
                results.push(await this.repairUserCard(card));
            } else {
                results.push(await this.ensureCardData(card));
            }
        }
        return results;
    }
};
