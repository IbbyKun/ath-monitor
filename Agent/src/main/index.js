'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage, dialog } = require('electron');

const api = require('./api');
const store = require('./store');
const session = require('./session');
const tracker = require('./tracker');
const { getServerUrl, setServerUrl, DEFAULT_SERVER_URL } = require('./config');

const IS_DEV = !!process.env.AGENT_DEV;

let win = null;
let tray = null;
let auth = null;          // { token, employeeId, ... } once signed in
let quitting = false;

// A second copy of the agent would double every screenshot and fight over the
// queue directory. Hand the focus back to the running instance instead.
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', showWindow);
    app.whenReady().then(bootstrap);
}

// ── windows ─────────────────────────────────────────────────────────────────

function createWindow() {
    win = new BrowserWindow({
        width: 400,
        height: 620,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        title: 'ATH Monitor Agent',
        show: false,
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,     // the preload needs `require` for ipcRenderer
        },
    });

    win.setMenuBarVisibility(false);
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
    win.once('ready-to-show', () => win.show());

    // Closing the window while the timer runs should not stop tracking — that
    // is the whole point of a tray app. Quit is explicit, via the tray menu.
    win.on('close', (event) => {
        if (!quitting) {
            event.preventDefault();
            win.hide();
        }
    });

    // External links (support docs, the web portal) open in the real browser.
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

function showWindow() {
    if (!win) return createWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
}

// ── tray ────────────────────────────────────────────────────────────────────

function trayIcon(running) {
    // Drawn inline so there is no image asset to keep in sync. A filled dot
    // when tracking, a hollow ring when idle — legible at 16px in both the
    // Windows notification area and the macOS menu bar.
    const svg = running
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#16a34a"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="#94a3b8" stroke-width="2"/></svg>`;

    const image = nativeImage.createFromDataURL(
        `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    );
    // Let macOS recolour it for light/dark menu bars.
    if (process.platform === 'darwin') image.setTemplateImage(false);
    return image;
}

function buildTray() {
    tray = new Tray(trayIcon(false));
    tray.setToolTip('ATH Monitor Agent');
    tray.on('click', showWindow);
    refreshTray();
}

function refreshTray() {
    if (!tray) return;
    const running = tracker.isRunning;

    tray.setImage(trayIcon(running));
    tray.setToolTip(running ? 'ATH Monitor — tracking' : 'ATH Monitor — stopped');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: auth ? `Signed in as ${auth.fullName}` : 'Not signed in', enabled: false },
        { type: 'separator' },
        {
            label: running ? 'Stop timer' : 'Start timer',
            enabled: !!auth,
            click: () => (running ? stopTimer() : startTimer()),
        },
        { label: 'Open', click: showWindow },
        { type: 'separator' },
        { label: 'Quit', click: () => quit() },
    ]));
}

// ── timer control ───────────────────────────────────────────────────────────

async function startTimer() {
    if (!auth || tracker.isRunning) return;

    // Frequency is per-organisation, so it has to come from the server rather
    // than a constant. A failure here is not fatal — fall back to the default.
    let perHour;
    try {
        const feature = await api.fetchFeatureStatus(auth.token);
        perHour = feature && feature.screenshot && Number(feature.screenshot.frequencyPerHour);
    } catch (err) {
        console.warn('[main] could not read feature-status, using default frequency:', err.message);
    }

    tracker.start(auth, perHour);
    refreshTray();
}

async function stopTimer() {
    if (!tracker.isRunning) return;
    await tracker.stop();
    refreshTray();
}

// ── auth ────────────────────────────────────────────────────────────────────

async function doLogin(email, password, serverUrl) {
    if (serverUrl) setServerUrl(serverUrl);

    const result = await api.login(email, password);
    auth = result;
    session.save(result);

    // Anything the previous run could not deliver goes out now that we have a
    // fresh token.
    await tracker.recoverInterruptedSession(auth);

    refreshTray();
    return publicAuth();
}

async function doLogout() {
    await stopTimer();
    tracker.stopQueueDrain();

    if (auth) {
        try {
            await api.logout(auth.token);
        } catch {
            // Server-side invalidation is best-effort; the local token is
            // cleared either way.
        }
    }
    auth = null;
    session.clear();
    refreshTray();
}

function publicAuth() {
    if (!auth) return null;
    // Never hand the token to the renderer — it has no use for it and it would
    // be reachable from devtools.
    return {
        fullName: auth.fullName,
        email: auth.email,
        employeeId: auth.employeeId,
        organizationId: auth.organizationId,
        role: auth.role,
    };
}

// ── ipc ─────────────────────────────────────────────────────────────────────

function registerIpc() {
    ipcMain.handle('app:info', () => ({
        version: app.getVersion(),
        serverUrl: getServerUrl(),
        defaultServerUrl: DEFAULT_SERVER_URL,
        platform: process.platform,
        auth: publicAuth(),
        status: tracker.getStatus(),
    }));

    ipcMain.handle('auth:login', async (_e, { email, password, serverUrl }) => {
        try {
            return { ok: true, auth: await doLogin(email, password, serverUrl) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('auth:logout', async () => {
        await doLogout();
        return { ok: true };
    });

    ipcMain.handle('timer:start', async () => {
        try {
            await startTimer();
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('timer:stop', async () => {
        try {
            await stopTimer();
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('queue:drain', async () => {
        await tracker.drainQueue();
        return { ok: true };
    });

    ipcMain.handle('status:get', () => tracker.getStatus());
}

// ── startup / shutdown ──────────────────────────────────────────────────────

async function bootstrap() {
    app.setAppUserModelId('com.athgadlang.athmonitoragent');

    registerIpc();
    createWindow();
    buildTray();

    tracker.on('status', (status) => {
        if (win && !win.isDestroyed()) win.webContents.send('status', status);
    });

    tracker.on('auth-expired', async () => {
        await doLogout();
        if (win && !win.isDestroyed()) {
            win.webContents.send('auth-expired');
            showWindow();
        }
    });

    // Sleeping/waking is normal on laptops. The per-second sampler simply
    // stops firing while suspended, so nothing needs undoing — but a resumed
    // machine is usually back online, which is the right moment to drain.
    require('electron').powerMonitor.on('resume', () => {
        tracker.drainQueue().catch(() => { /* retried on schedule */ });
    });

    const saved = session.load();
    if (saved) {
        auth = saved;
        refreshTray();
        // Don't auto-start the timer — starting tracking without the user
        // asking is exactly the behaviour that makes monitoring software feel
        // untrustworthy. We only recover undelivered data.
        tracker.recoverInterruptedSession(auth).catch(() => { /* non-fatal */ });
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        else showWindow();
    });
}

async function quit() {
    if (quitting) return;

    if (tracker.isRunning) {
        const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Stop timer and quit', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
            message: 'The timer is still running.',
            detail: 'Quitting will stop tracking and upload the time recorded so far.',
        });
        if (response === 1) return;
        await stopTimer();
    }

    quitting = true;
    store.flushNow();
    app.quit();
}

app.on('before-quit', () => { quitting = true; store.flushNow(); });

// The tray app deliberately outlives its window on every platform.
app.on('window-all-closed', () => { /* keep running */ });

if (IS_DEV) {
    app.whenReady().then(() => win && win.webContents.openDevTools({ mode: 'detach' }));
}
