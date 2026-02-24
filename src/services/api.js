import { auth } from '../lib/firebase';

const BASE_URL = import.meta.env.VITE_API_URL || ''; // Use VITE_API_URL from .env if present, otherwise use relative path

async function getHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (auth.currentUser) {
        // Force refresh if needed? Usually getIdToken() handles it.
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        console.warn('[API] No currentUser found, sending request without auth.');
    }

    // Include referral code if present
    const referralCode = localStorage.getItem('mtg_forge_ref');
    if (referralCode) {
        headers['X-Referral-Code'] = referralCode;
    }

    // Impersonation Header
    const impersonateId = localStorage.getItem('impersonate_user_id');
    if (impersonateId) {
        headers['x-impersonate-user-id'] = impersonateId;
    }

    return headers;
}

// Global toast handler injection
let globalToast = null;
export const setGlobalToast = (fn) => { globalToast = fn; };

async function request(method, endpoint, body = null, params = {}) {
    // ... (url construction same as before) ...
    let urlString = `${BASE_URL}${endpoint}`;

    // Fail fast if offline
    if (!navigator.onLine) {
        throw new Error('Network Error: Device is offline');
    }

    const url = new URL(urlString, window.location.origin);

    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.append(key, params[key]);
        }
    });

    const config = {
        method,
        headers: await getHeaders()
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);

    if (!response.ok && response.status !== 304) {
        // Try to parse error message
        let errMsg = response.statusText;
        let errCode = null;
        let errData = null;
        try {
            errData = await response.json();
            if (errData.error) errMsg = errData.error;
            if (errData.code) errCode = errData.code;
        } catch (e) { /* ignore */ }

        // Intercept Usage Limits
        if (response.status === 403 && errCode === 'LIMIT_REACHED' && globalToast) {
            globalToast(`Subscription Limit Reached: ${errMsg}`, 'error', 5000);
            // We still throw so the calling component can stop its loading state
        }

        const error = new Error(`API Error (${response.status}): ${errMsg}`);
        error.response = { status: response.status, data: errData };
        error.code = errCode;
        throw error;
    }

    // Return null for 204 No Content
    if (response.status === 204) return null;

    // Safely parse JSON
    // Safely parse JSON
    const text = await response.text();
    if (!text) return {};

    try {
        // Check if response looks like HTML (common for SPA 404s)
        if (text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html')) {
            throw new Error('Received HTML response from API (likely 404 or SPA fallback)');
        }
        return JSON.parse(text);
    } catch (e) {
        console.warn(`[API] Failed to parse response from ${endpoint}:`, e.message);
        throw new Error('Invalid JSON response from API');
    }
}

export const api = {
    get: (endpoint, params) => request('GET', endpoint, null, params),
    post: (endpoint, body) => request('POST', endpoint, body),
    put: (endpoint, body) => request('PUT', endpoint, body),
    delete: (endpoint, body) => request('DELETE', endpoint, body),
    batchAddToCollection: (cards, mode = 'merge', targetUserId = null) => request('POST', '/api/collection/batch', { cards, mode, targetUserId }),
    batchDeleteCollection: (ids) => request('DELETE', '/api/collection/batch', { ids }),
    batchAddCardsToDeck: (deckId, cards) => request('POST', `/api/decks/${deckId}/cards/batch`, { cards }),
    getBugs: () => request('GET', '/bugs').then(res => res.content),
    updateUser: (id, data) => request('PUT', `/api/users/${id}`, data),
    getBinders: (params) => api.get('/api/binders', { params }),
    getBinder: (id) => api.get(`/api/binders/${id}`),
    getBinderCards: (id) => api.get(`/api/binders/${id}/cards`),
    createBinder: (data) => request('POST', '/api/binders', data),
    updateBinder: (id, data) => request('PUT', `/api/binders/${id}`, data),
    deleteBinder: (id) => request('DELETE', `/api/binders/${id}`),

    // Epics
    getEpics: () => request('GET', '/api/epics'),
    createEpic: (data) => request('POST', '/api/epics', data),
    updateEpic: (id, data) => request('PUT', `/api/epics/${id}`, data),
    reorderEpics: (order) => request('PUT', '/api/epics/reorder/batch', { order }),
    deleteEpic: (id) => request('DELETE', `/api/epics/${id}`),

    // Tickets
    getTickets: (params) => request('GET', '/api/tickets', null, params),
    getTicketReport: (params) => request('GET', '/api/tickets/report', null, params),
    createTicket: (data) => request('POST', '/api/tickets', data),
    updateTicket: (id, data) => request('PUT', `/api/tickets/${id}`, data),
    deleteTicket: (id) => request('DELETE', `/api/tickets/${id}`),
    voteTicket: (id) => request('POST', `/api/tickets/${id}/vote`),
    getAssignees: () => request('GET', '/api/tickets/meta/assignees'),
    getTicketNotes: (id) => request('GET', `/api/tickets/${id}/notes`),
    addTicketNote: (id, note) => request('POST', `/api/tickets/${id}/notes`, { note }),

    // Admin / Permissions
    updateUserPermissions: (id, permissions, isAdmin, subscriptionData = {}) => request('PUT', `/api/users/${id}/permissions`, { permissions, isAdmin, ...subscriptionData }),
    getUsers: () => request('GET', '/api/users'),

    // Releases
    // Releases
    getReleases: () => request('GET', '/api/releases'),
    publishRelease: (data) => request('POST', '/api/releases', data),

    // Precons
    checkPreconOwnership: (id) => request('POST', `/api/precons/${id}/check-ownership`),
    createPreconDeck: (id, options = {}) => request('POST', `/api/precons/${id}/create`, options),

    // Audit
    getActiveAudit: () => request('GET', '/api/audit/active'),
    startAudit: (data) => request('POST', '/api/audit/start', data),
    getAuditItems: (id, params) => request('GET', `/api/audit/${id}/items`, null, params),
    updateAuditItem: (sessionId, itemId, quantity, reviewed = null) => {
        const payload = { quantity };
        if (reviewed !== null) payload.reviewed = reviewed;
        return request('PUT', `/api/audit/${sessionId}/item/${itemId}`, payload);
    },

    swapFoilAuditItem: (sessionId, itemId) => request('POST', `/api/audit/${sessionId}/item/${itemId}/swap-foil`),

    addAuditItem: (sessionId, data) => request('POST', `/api/audit/${sessionId}/items/add`, data),

    cancelAudit: (id) => request('POST', `/api/audit/${id}/cancel`),
    finalizeAudit: (id) => request('POST', `/api/audit/${id}/finalize`),
    reviewAuditSection: (id, data) => request('POST', `/api/audit/${id}/section/review`, data),
    batchUpdateAuditItems: (id, updates) => request('POST', `/api/audit/${id}/items/batch-update`, { updates }),

    // Featured Products (Store)
    getFeaturedProducts: (admin = false) => request('GET', admin ? '/api/featured/all' : '/api/featured'),
    createFeaturedProduct: (data) => request('POST', '/api/featured', data),
    updateFeaturedProduct: (id, data) => request('PUT', `/api/featured/${id}`, data),
    deleteFeaturedProduct: (id) => request('DELETE', `/api/featured/${id}`),
    reorderFeaturedProducts: (order) => request('PUT', '/api/featured/reorder/batch', { order }),

    // Credit Reset
    resetUserCredits: (userId) => request('POST', `/api/admin/credit-reset/${userId}`),

    // AI Personas
    getPersonas: () => request('GET', '/api/personas'),
    getAdminPersonas: () => request('GET', '/api/personas/admin'),
    createPersona: (data) => request('POST', '/api/personas/admin', data),
    updatePersona: (id, data) => request('PUT', `/api/personas/admin/${id}`, data),
    deletePersona: (id) => request('DELETE', `/api/personas/admin/${id}`)
};
