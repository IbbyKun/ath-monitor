'use strict';

// Renderer: two views, driven entirely by status pushed from the main process.
// It holds no tracking state of its own — the timer keeps running whether this
// window is open, hidden or closed, so the UI is a pure view of `status`.

const $ = (id) => document.getElementById(id);

const el = {
    login: $('view-login'),
    main: $('view-main'),
    form: $('login-form'),
    email: $('email'),
    password: $('password'),
    loginServer: $('login-server'),
    loginVersion: $('login-version'),
    loginBtn: $('login-btn'),
    loginError: $('login-error'),
    who: $('who'),
    serverLabel: $('server-label'),
    logoutBtn: $('logout-btn'),
    clock: document.querySelector('.clock'),
    clockLabel: $('clock-label'),
    clockTime: $('clock-time'),
    clockDetail: $('clock-detail'),
    statShots: $('stat-shots'),
    statQueued: $('stat-queued'),
    notice: $('notice'),
    mainError: $('main-error'),
    version: $('version'),
    conn: $('conn'),
};

let startedAt = null;
let ticker = null;

// ── formatting ──────────────────────────────────────────────────────────────

function hms(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function compact(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function show(node, text) {
    if (text) {
        node.textContent = text;
        node.hidden = false;
    } else {
        node.hidden = true;
    }
}

// ── rendering ───────────────────────────────────────────────────────────────

function renderStatus(status) {
    startedAt = status.running && status.startedAt ? new Date(status.startedAt) : null;

    el.clock.classList.toggle('running', status.running);
    el.clockLabel.textContent = status.running ? 'Tracking' : 'Not tracking';

    // No "press start" copy any more — there is no button to press. Tracking
    // begins at login and ends when the session does.
    el.clockDetail.textContent = status.running
        ? `About ${status.screenshotsPerHour} screenshots an hour.`
        : 'Tracking starts automatically when you sign in to Windows.';

    // Active and "idle removed" are no longer shown. Tracked time is the
    // Windows session, breaks included, so a figure for deducted break time
    // describes a rule that no longer decides anything an employee can act on.
    el.statShots.textContent = status.running ? String(status.screenshotCount) : '—';
    el.statQueued.textContent = status.queued > 0 ? String(status.queued) : 'none';

    // A non-empty queue means uploads are failing — that is the honest read of
    // connectivity, more so than navigator.onLine.
    el.conn.classList.toggle('offline', status.queued > 0);
    el.conn.title = status.queued > 0
        ? `${status.queued} batch(es) waiting to upload — they will be sent automatically.`
        : 'Connected';

    show(el.notice, status.windowTrackingIssue);
    show(el.mainError, status.lastError);

    updateElapsed();
}

function updateElapsed() {
    el.clockTime.textContent = startedAt ? hms((Date.now() - startedAt.getTime()) / 1000) : '00:00:00';
}

function showLogin() {
    el.login.hidden = false;
    el.main.hidden = true;
    el.password.value = '';
    el.email.focus();
}

function showMain(auth, info) {
    el.login.hidden = true;
    el.main.hidden = false;
    el.who.textContent = auth.fullName || auth.email;
    el.serverLabel.textContent = info.serverUrl;
}

// ── events ──────────────────────────────────────────────────────────────────

el.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    show(el.loginError, null);

    const email = el.email.value.trim();
    const password = el.password.value;
    if (!email || !password) {
        return show(el.loginError, 'Enter your email and password.');
    }

    el.loginBtn.disabled = true;
    el.loginBtn.textContent = 'Signing in…';
    try {
        // No serverUrl argument: the address is fixed by the build.
        const result = await window.agent.login(email, password);
        if (!result.ok) {
            show(el.loginError, result.error);
            return;
        }
        const info = await window.agent.getInfo();
        showMain(result.auth, info);
        renderStatus(info.status);
    } finally {
        el.loginBtn.disabled = false;
        el.loginBtn.textContent = 'Sign in';
    }
});

el.logoutBtn.addEventListener('click', async () => {
    await window.agent.logout();
    showLogin();
});

window.agent.onStatus(renderStatus);

window.agent.onAuthExpired(() => {
    showLogin();
    show(el.loginError, 'Your session expired. Please sign in again.');
});

// ── boot ────────────────────────────────────────────────────────────────────

(async function init() {
    const info = await window.agent.getInfo();

    el.version.textContent = `v${info.version}`;
    el.loginVersion.textContent = info.version;
    el.loginServer.textContent = info.serverUrl.replace(/^https?:\/\//, '');

    if (info.auth) {
        showMain(info.auth, info);
        renderStatus(info.status);
    } else {
        showLogin();
    }

    // The main process only emits on real changes; this keeps the visible
    // elapsed time moving between them.
    ticker = setInterval(updateElapsed, 1000);
    window.addEventListener('beforeunload', () => clearInterval(ticker));
})();
