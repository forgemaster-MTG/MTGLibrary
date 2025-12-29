import { api } from './api';

export const collectionService = {
    async addCardToCollection(userId, card, count = 1, finish, is_wishlist = false) {
        // API handles upsert logic internally or just adds new instance?
        // Plan: API currently creates new row.
        return api.post('/collection', {
            scryfall_id: card.id,
            name: card.name,
            set_code: card.set || card.set_code,
            collector_number: card.collector_number,
            finish: finish || card.finish || 'nonfoil',
            count: count,
            data: card,
            deck_id: null, // Binder
            is_wishlist: is_wishlist
        });
    },

    async updateCard(id, updates) {
        return api.put(`/collection/${id}`, updates);
    },

    async removeCard(id) {
        return api.delete(`/collection/${id}`);
    },

    async importBatch(userId, cards, mode = 'merge') {
        return api.post('/collection/batch', { cards, mode });
    }
};
