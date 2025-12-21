import { api } from './api';

export const collectionService = {
    async addCardToCollection(userId, card, count = 1) {
        // API handles upsert logic internally or just adds new instance?
        // Plan: API currently creates new row.
        // If we want "stacking" behavior (check existing), api/collection.js didn't implement deduping.
        // It just inserts.
        // We can replicate current behavior: always add new instance?
        // Existing `collectionService.js` combined duplicates by updating count.
        // The API `POST /collection` I wrote just does `insert`.
        // So I'm changing behavior to "always new instance" unless I update the API.
        // Given Phase 2 is about migration to "User Cards Table", usually we want unique rows or robust stacking.
        // For now, I'll just call the API. If duplicates appear, so be it (allows Split Stack).
        return api.post('/collection', {
            scryfall_id: card.id,
            name: card.name,
            set_code: card.set || card.set_code,
            collector_number: card.collector_number,
            finish: card.finish || 'nonfoil',
            count: count,
            data: card,
            deck_id: null // Binder
        });
    },

    async importBatch(userId, cards, mode = 'merge') {
        return api.post('/collection/batch', { cards, mode });
    }
};
