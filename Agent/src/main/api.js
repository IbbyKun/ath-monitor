'use strict';

// HTTP client for the ATH Monitor backend.
//
// Routing note: everything goes through the nginx in front of the stack, which
// splits by prefix (see Frontend/nginx.conf):
//   /api/v3/...        -> admin service      (login lives here)
//   /api/v1/auth/...   -> admin service
//   /api/v1/...        -> store-logs-api     (all agent uploads live here)
// So a single base URL is enough; we never talk to a service directly.

const { getServerUrl } = require('./config');

/** Thrown for any non-2xx response, so callers can branch on `status`. */
class ApiError extends Error {
    constructor(status, message, body) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
    /** 401/403 mean the session is gone — the user has to log in again. */
    get isAuthError() {
        return this.status === 401 || this.status === 403;
    }
}

const REQUEST_TIMEOUT_MS = 30_000;

async function request(path, { method = 'GET', token, json, form, timeout = REQUEST_TIMEOUT_MS } = {}) {
    const url = `${getServerUrl()}${path}`;
    const headers = {};
    let body;

    if (json !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(json);
    } else if (form !== undefined) {
        // Let fetch set Content-Type — it has to append the multipart boundary.
        body = form;
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    // AbortSignal.timeout would be neater, but an explicit controller lets us
    // distinguish "we gave up" from "the network refused" in the message.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let res;
    try {
        res = await fetch(url, { method, headers, body, signal: controller.signal });
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new ApiError(0, `Request to ${path} timed out after ${timeout / 1000}s`);
        }
        // DNS failure, connection refused, offline — all land here.
        throw new ApiError(0, `Cannot reach the server (${err.message})`);
    } finally {
        clearTimeout(timer);
    }

    const text = await res.text();
    let payload = null;
    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        payload = text;
    }

    if (!res.ok) {
        const message =
            (payload && (payload.message || payload.error)) ||
            `${res.status} ${res.statusText}`;
        throw new ApiError(res.status, String(message), payload);
    }

    // The admin service returns HTTP 200 with an in-body `code` for some
    // failures (validation errors in particular), so a 200 alone is not enough.
    if (payload && typeof payload === 'object' && payload.code && payload.code >= 400) {
        throw new ApiError(payload.code, payload.message || 'Request failed', payload);
    }

    return payload;
}

/**
 * Employee login.
 *
 * POST /api/v3/auth/user -> { code: 200, data: <accessToken>, user_id, ... }
 * where `user_id` in the response is the **employee_id**, and `u_id` is the
 * users-table id. The token is a doubly-encrypted JWT whose session lives in
 * Redis; store-logs-api resolves it back to the employee on every call.
 */
async function login(email, password) {
    const res = await request('/api/v3/auth/user', {
        method: 'POST',
        json: { email, password },
    });

    if (!res || !res.data) {
        throw new ApiError(400, (res && res.message) || 'Login failed');
    }
    // A 2FA-enabled account returns "OTP Send Successful" with no usable token.
    // The agent has no OTP screen yet, so fail loudly rather than half-work.
    if (res.message && /otp/i.test(res.message) && typeof res.data !== 'string') {
        throw new ApiError(400, 'This account requires 2FA, which the desktop agent does not support yet.');
    }

    return {
        token: res.data,
        employeeId: res.user_id,
        userId: res.u_id,
        organizationId: res.organization_id,
        fullName: res.full_name || res.user_name || email,
        email: res.email || email,
        role: res.role,
    };
}

/** Per-user tracking settings — most importantly the screenshot frequency. */
async function fetchFeatureStatus(token) {
    const res = await request('/api/v1/desktop/feature-status', { token });
    return (res && res.data) || null;
}

/** Push one batch of activity. `payload` is { sign, data: [...] }. */
async function sendActivity(token, payload) {
    return request('/api/v1/desktop/add-activity-log', {
        method: 'POST',
        token,
        json: payload,
    });
}

/**
 * Upload screenshots.
 *
 * `shots` is [{ filename, buffer }]. The filename is load-bearing: the storage
 * layer slices the date straight out of it (`originalname.substr(3, 10)`), so
 * it must be `HH-YYYY-MM-DD HH-mm-ss-scN.jpg`.
 */
async function uploadScreenshots(token, shots, { projectId = 0, taskId = 0 } = {}) {
    const form = new FormData();
    for (const shot of shots) {
        form.append(
            'screenshots',
            new Blob([shot.buffer], { type: 'image/jpeg' }),
            shot.filename,
        );
    }
    form.append('projectId', String(projectId));
    form.append('taskId', String(taskId));

    return request('/api/v1/desktop/upload-screenshots', {
        method: 'POST',
        token,
        form,
        timeout: 120_000,   // several full-screen JPEGs on a slow line
    });
}

/**
 * Record a clock-in/clock-out span.
 * type 1 = clock, 2 = break. mode 1 = automatic, 2 = manual.
 */
async function recordClock(token, { startDate, endDate, type = 1, mode = 2 }) {
    return request('/api/v1/timesheet/record-clock-in', {
        method: 'POST',
        token,
        json: { data: [{ type, mode, startDate, endDate }] },
    });
}

/** Invalidate the server-side session. Best-effort — never blocks logout. */
async function logout(token) {
    return request('/api/v3/auth/agent-logout', { token });
}

module.exports = {
    ApiError,
    login,
    logout,
    fetchFeatureStatus,
    sendActivity,
    uploadScreenshots,
    recordClock,
};
