import { auth } from '../lib/firebase';

const BASE_URL = 'http://localhost:3000'; // TODO: Use env var

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
    const url = new URL(`${BASE_URL}${endpoint}`);
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
    delete: (endpoint) => request('DELETE', endpoint),
    getBugs: () => request('GET', '/bugs').then(res => res.content),
    updateUser: (id, data) => request('PUT', `/users/${id}`, data)
};
