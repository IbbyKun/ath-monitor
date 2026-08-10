'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');

const api = require('./api');
const store = require('./store');
const session = require('./session');
const tracker = require('./tracker');
const updater = require('./updater');
const { getServerUrl, migrateLegacyServerUrl, DEFAULT_SERVER_URL } = require('./config');

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
    // Stay in the tray when Windows launched us at login — tracking starts by
    // itself, so there is nothing for the employee to do with the window. A
    // manual launch still shows it.
    win.once('ready-to-show', () => { if (!LAUNCHED_AT_LOGIN) win.show(); });

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
    // No Start/Stop entry. The timer follows the Windows session now, so there
    // is nothing for the employee to toggle — see startTimer().
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: auth ? `Signed in as ${auth.fullName}` : 'Not signed in', enabled: false },
        { label: running ? 'Tracking' : 'Not tracking', enabled: false },
        { type: 'separator' },
        { label: 'Open', click: showWindow },
        { type: 'separator' },
        { label: 'Quit', click: () => quit() },
    ]));
}

// ── timer control ───────────────────────────────────────────────────────────

async function startTimer() {
    if (!auth || tracker.isRunning) return;

    // Screenshot frequency and the idle threshold are both per-organisation
    // settings, so they come from the server rather than constants. A failure
    // here is not fatal — the tracker falls back to its defaults.
    let perHour;
    let idleMinutes;
    try {
        const feature = await api.fetchFeatureStatus(auth.token);
        perHour = feature && feature.screenshot && Number(feature.screenshot.frequencyPerHour);
        idleMinutes = feature && Number(feature.idleInMinute);
    } catch (err) {
        console.warn('[main] could not read feature-status, using defaults:', err.message);
    }

    tracker.start(auth, { screenshotsPerHour: perHour, idleMinutes });
    refreshTray();
}

async function stopTimer() {
    if (!tracker.isRunning) return;
    await tracker.stop();
    refreshTray();
}

// ── auth ────────────────────────────────────────────────────────────────────

// No serverUrl parameter. The address is fixed by the build, and removing the
// input from the sign-in screen is only half of that — leaving the IPC channel
// able to set it would still let anyone with devtools point their agent at
// another host. The renderer gets no say.
async function doLogin(email, password) {
    const result = await api.login(email, password);
    auth = result;
    session.save(result);

    // Anything the previous run could not deliver goes out now that we have a
    // fresh token.
    await tracker.recoverInterruptedSession(auth);

    refreshTray();
    // Signing in is the start of the shift when there is no Start button.
    startTimer().catch((err) => console.warn('[main] post-login start failed:', err.message));
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

    ipcMain.handle('auth:login', async (_e, { email, password }) => {
        try {
            return { ok: true, auth: await doLogin(email, password) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('auth:logout', async () => {
        await doLogout();
        return { ok: true };
    });

    // timer:start / timer:stop are deliberately absent. The timer is driven by
    // the Windows session, so exposing a channel the renderer could call would
    // be a way around that — and the renderer is the least trustworthy place in
    // the app to enforce it from.

    ipcMain.handle('queue:drain', async () => {
        await tracker.drainQueue();
        return { ok: true };
    });

    ipcMain.handle('status:get', () => tracker.getStatus());
}

// ── startup / shutdown ──────────────────────────────────────────────────────

/**
 * Launch the agent when the employee logs in.
 *
 * Without this nothing ties the timer to the Windows session — the agent only
 * runs when someone opens it, which is the manual start it is meant to replace.
 * NSIS creates shortcuts but no Run entry, so this has to be set from the app.
 *
 * `--autostart` marks the login launch so bootstrap can skip showing the
 * window: tracking begins on its own, and a window appearing at every login is
 * noise nobody needs to act on.
 *
 * Per-user (HKCU Run), matching the per-user install — no admin rights needed.
 */
function enableAutoLaunch() {
    if (process.platform !== 'win32' || !app.isPackaged) return;
    try {
        app.setLoginItemSettings({
            openAtLogin: true,
            args: ['--autostart'],
        });
    } catch (err) {
        // Never fatal: an agent that cannot register autostart must still track
        // for the rest of this session.
        console.warn('[main] could not enable auto-launch:', err.message);
    }
}

const LAUNCHED_AT_LOGIN = process.argv.includes('--autostart');

async function bootstrap() {
    app.setAppUserModelId('com.athgadlang.athmonitoragent');
    enableAutoLaunch();

    // Before anything reads the server URL. An agent upgraded in place from a
    // pre-TLS build still has http://<ip> in its store, and that beats the new
    // default — see migrateLegacyServerUrl().
    if (migrateLegacyServerUrl() && IS_DEV) {
        console.log(`migrated legacy server URL to ${DEFAULT_SERVER_URL}`);
    }

    registerIpc();
    createWindow();
    buildTray();

    // Early on purpose: if a previous session staged an update, this installs it
    // and relaunches now, before the timer has anything to lose. See updater.js
    // for why installing at launch beats installing at quit.
    updater.init((msg) => { if (IS_DEV) console.log(msg); });

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

    // The shift is the Windows session, so the machine going to sleep has to
    // end the tracked stretch rather than pause inside it. Closing the lid is
    // the case that matters: without this, a laptop shut at 6pm and opened at
    // 9am would bank the night as worked time. The per-second sampler stops
    // firing while suspended, but the session's start time would still span it.
    const { powerMonitor } = require('electron');

    powerMonitor.on('suspend', () => {
        stopTimer().catch((err) => console.warn('[main] suspend stop failed:', err.message));
    });

    powerMonitor.on('resume', () => {
        // Back online is the right moment to push anything undelivered, and to
        // begin the next stretch — the employee is at the machine again.
        tracker.drainQueue().catch(() => { /* retried on schedule */ });
        startTimer().catch((err) => console.warn('[main] resume start failed:', err.message));
    });

    const saved = session.load();
    if (saved) {
        auth = saved;
        refreshTray();
        tracker.recoverInterruptedSession(auth).catch(() => { /* non-fatal */ });
        // Auto-start: the agent launches at login (see enableAutoLaunch), so
        // this is what ties the timer to the Windows session. Employees have no
        // Start control any more — tracked time is shift time, breaks included,
        // which is the whole point of removing the toggle.
        startTimer().catch((err) => console.warn('[main] autostart failed:', err.message));
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        else showWindow();
    });
}

async function quit() {
    if (quitting) return;

    // No confirmation prompt: the employee has no say over the timer any more,
    // so asking them to approve stopping it is a dialog with one real answer.
    // Logging off or shutting down reaches here the same way.
    if (tracker.isRunning) await stopTimer();

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
