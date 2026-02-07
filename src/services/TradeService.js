import { api } from './api';
import { communityService } from './communityService';

export const tradeService = {
    /**
     * Finds matches between the current user's wishlist and their friends' public collections.
     * @param {string} currentUserId 
     * @returns {Promise<Array>} List of matches
     */
    findMatches: async (currentUserId) => {
        try {
            // 1. Fetch My Wishlist
            // We use the same endpoint as useCollection, filtering by wishlist=true
            const wishlistResponse = await api.get(`/api/collection?userId=${currentUserId}&wishlist=true`);
            const myWishlist = wishlistResponse.map(c => ({
                id: c.scryfall_id, // Match on Oracle/Scryfall ID
                name: c.name,
                set: c.set_code,
                wishlistId: c.id // The collection row ID
            }));

            if (myWishlist.length === 0) return [];

            // 2. Fetch Friends
            const relationships = await communityService.fetchRelationships();
            const friends = relationships
                .filter(r => r.status === 'accepted')
                .map(r => r.friend); // Assuming 'friend' object contains { id, username, ... }

            if (friends.length === 0) return [];

            const matches = [];

            // 3. Scan Each Friend's Collection
            // TODO: Optimize this with a single backend endpoint if scaling issues arise.
            await Promise.all(friends.map(async (friend) => {
                try {
                    // Fetch friend's public collection
                    const friendCollection = await api.get(`/api/collection?userId=${friend.id}&public=true`);

                    // 4. Find Intersections
                    friendCollection.forEach(friendCard => {
                        const match = myWishlist.find(w => w.id === friendCard.scryfall_id);
                        if (match) {
                            matches.push({
                                cardName: friendCard.name,
                                cardId: friendCard.scryfall_id,
                                set: friendCard.set_code,
                                finish: friendCard.finish,
                                friendName: friend.username,
                                friendId: friend.id,
                                quantity: friendCard.count,
                                image: friendCard.image_uri || friendCard.data?.image_uris?.normal
                            });
                        }
                    });
                } catch (err) {
                    console.warn(`Failed to fetch collection for ${friend.username}`, err);
                }
            }));

            return matches;
        } catch (error) {
            console.error("TradeService findMatches failed:", error);
            throw error;
        }
    },

    /**
     * Fetches "Reverse" matches: What friends want that I have.
     */
    findReverseMatches: async (currentUserId) => {
        // Similar logic, but fetching friends' wishlists vs my public collection.
        // Implementation deferred for MVP.
        return [];
    },

    // API Integration
    getTrades: () => api.get('/api/trades'),
    createTrade: (data) => api.post('/api/trades', data),
    getTradeDetails: (id) => api.get(`/api/trades/${id}`),
    updateStatus: (id, status) => api.put(`/api/trades/${id}/status`, { status }),
    toggleAccept: (id) => api.post(`/api/trades/${id}/toggle_accept`),
    completeTrade: (id) => api.post(`/api/trades/${id}/complete`),
    sendMessage: (id, content) => api.post(`/api/trades/${id}/messages`, { content }),
    addItems: (id, items) => api.post(`/api/trades/${id}/items`, { items }),
    removeItem: (id, itemId) => api.delete(`/api/trades/${id}/items/${itemId}`),
    deleteTrade: (id) => api.delete(`/api/trades/${id}`)
};
