import { api } from './api';

export const collectionService = {
    async addCardToCollection(userId, card, count = 1, finish, is_wishlist = false, targetUserId = null) {
        // API handles upsert logic internally or just adds new instance?
        // Plan: API currently creates new row.
        return api.post('/api/collection', {
            scryfall_id: card.id,
            name: card.name,
            set_code: card.set || card.set_code,
            collector_number: card.collector_number,
            finish: finish || card.finish || 'nonfoil',
            count: count,
            data: card,
            deck_id: null, // Binder
            is_wishlist: is_wishlist,
            targetUserId: targetUserId
        });
    },

    async updateCard(id, updates) {
        return api.put(`/api/collection/${id}`, updates);
    },

    async removeCard(id) {
        return api.delete(`/api/collection/${id}`);
    },

    async importBatch(userId, cards, mode = 'merge') {
        return api.post('/api/collection/batch', { cards, mode });
    },

    async batchRemoveCards(cardIds) {
        return api.delete('/api/collection/batch/delete', { cardIds });
    }
};
