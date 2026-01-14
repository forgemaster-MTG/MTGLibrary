import { api } from './api';

export const deckService = {
    /**
     * Adds a card to a deck.
     * Uses API POST /collection with deck_id.
     */
    async addCardToDeck(userId, deckId, card) {
        // card object must contain Scryfall data
        return api.post('/api/collection', {
            scryfall_id: card.id, // Scryfall ID
            name: card.name,
            set_code: card.set || card.set_code,
            collector_number: card.collector_number,
            finish: card.finish || 'nonfoil',
            data: card, // Pass full data for cache
            deck_id: deckId,
            count: 1
        });
    },

    async batchAddCardsToDeck(userId, deckId, cards, mode = 'merge') {
        const payload = cards.map(c => ({
            ...c,
            deck_id: deckId
        }));
        return api.batchAddToCollection(payload, mode);
    },

    /**
     * Removes a card from a deck (Return to binder).
     */
    async removeCardFromDeck(userId, deckId, cardId) {
        // cardId is the user_cards row ID (managedId or id)
        // Set deck_id to null
        return api.put(`/api/collection/${cardId}`, { deck_id: null });
    },

    /**
     * Updates the quantity of a card in a deck.
     */
    async updateCardQuantity(userId, deckId, cardId, newCount) {
        if (newCount <= 0) {
            return this.removeCardFromDeck(userId, deckId, cardId); // or delete?
        }
        return api.put(`/api/collection/${cardId}`, { count: newCount });
    },

    /**
     * Sets the commander for a deck.
     */
    async setCommander(userId, deckId, card) {
        return api.put(`/api/decks/${deckId}`, { commander: card });
    },

    /**
     * Imports a deck with options.
     */
    async importDeck(userId, deck, cards, options) {
        return api.post('/api/decks/import', { deck, cards, options });
    },

    async updateDeck(userId, deckId, data) {
        return api.put(`/api/decks/${deckId}`, data);
    },

    async deleteDeck(userId, deckId, options = {}) {
        const query = new URLSearchParams(options).toString();
        return api.delete(`/api/decks/${deckId}?${query}`);
    },

    async batchRemoveCards(userId, deckId, cardIds, action = 'remove') {
        // action: 'remove' (return to binder) or 'delete' (delete from DB)
        return api.delete(`/api/decks/${deckId}/cards?action=${action}`, { cardIds });
    }
};
