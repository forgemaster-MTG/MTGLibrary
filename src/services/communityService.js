import { api } from './api';

export const communityService = {
    // Relationships
    fetchRelationships: async () => {
        return api.get('/api/community/relationships');
    },

    sendRequest: async (target, type = 'pod') => {
        // target can be email string OR object { targetEmail, targetId }
        const payload = typeof target === 'string' ? { targetEmail: target, type } : { ...target, type };
        return api.post('/api/community/relationships/request', payload);
    },

    respondToRequest: async (id, status) => {
        return api.put(`/api/community/relationships/${id}`, { status });
    },

    deleteRelationship: async (id) => {
        return api.delete(`/api/community/relationships/${id}`);
    },

    // Permissions
    fetchPermissions: async (deckId = null) => {
        return api.get(`/api/community/permissions${deckId ? `?deckId=${deckId}` : ''}`);
    },

    fetchIncomingPermissions: async () => {
        return api.get('/api/community/permissions?direction=incoming');
    },

    grantPermission: async (granteeId, permissionLevel, deckId = null) => {
        return api.post('/api/community/permissions', { granteeId, permissionLevel, deckId });
    },

    revokePermission: async (id) => {
        return api.delete(`/api/community/permissions/${id}`);
    },

    // Deck Settings
    updateDeckPublicStatus: async (deckId, isPublic, shareSlug) => {
        return api.put(`/api/decks/${deckId}`, { isPublic, shareSlug });
    }
};
