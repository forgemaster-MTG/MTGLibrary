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
    return headers;
}

async function request(method, endpoint, body = null, params = {}) {
    // If BASE_URL is set, use it. data URL construction requires a base if the path is relative. 
    // If BASE_URL is empty (relative mode), we just use the endpoint path directly (fetch supports relative URLs).
    let urlString = `${BASE_URL}${endpoint}`;
    const url = new URL(urlString, window.location.origin); // safe constructor using current origin as fallback base

    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.append(key, params[key]);
        }
    });

    // Fetch using the string logic to avoid accidental absolute localhost conversion if we want relative
    // But URL object is nicer for params. 
    // If BASE_URL is empty, url will be "http://current-origin/endpoint". This is fine.

    const config = {
        method,
        headers: await getHeaders()
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        // Try to parse error message
        let errMsg = response.statusText;
        try {
            const errData = await response.json();
            if (errData.error) errMsg = errData.error;
        } catch (e) { /* ignore */ }
        throw new Error(`API Error (${response.status}): ${errMsg}`);
    }

    // Return null for 204 No Content
    if (response.status === 204) return null;

    return response.json();
}

export const api = {
    get: (endpoint, params) => request('GET', endpoint, null, params),
    post: (endpoint, body) => request('POST', endpoint, body),
    put: (endpoint, body) => request('PUT', endpoint, body),
    delete: (endpoint, body) => request('DELETE', endpoint, body),
    getBugs: () => request('GET', '/bugs').then(res => res.content),
    updateUser: (id, data) => request('PUT', `/api/users/${id}`, data),
    getBinders: () => request('GET', '/api/binders'),
    getBinderCards: (id) => request('GET', `/api/binders/${id}/cards`),
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
    updateUserPermissions: (id, permissions, isAdmin) => request('PUT', `/api/users/${id}/permissions`, { permissions, isAdmin }),
    getUsers: () => request('GET', '/api/users'),

    // Releases
    // Releases
    getReleases: () => request('GET', '/api/releases'),
    publishRelease: (data) => request('POST', '/api/releases', data),

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

    cancelAudit: (id) => request('POST', `/api/audit/${id}/cancel`),
    finalizeAudit: (id) => request('POST', `/api/audit/${id}/finalize`),
    reviewAuditSection: (id, data) => request('POST', `/api/audit/${id}/section/review`, data)
};
