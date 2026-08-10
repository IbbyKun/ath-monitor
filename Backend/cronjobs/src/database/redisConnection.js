// Redis access for the cron workers.
//
// ── Why this is not the same shape as admin's redis.service.js ──────────────
// admin is on redis ^3.1.2, where `createClient({ host, port })` and
// `promisify(client.get)` are correct. cronjobs is on ^5.11.0, where both are
// wrong — and the combination crash-looped this service roughly every eight
// minutes.
//
// Three separate faults, worth naming because each one alone is subtle:
//
//   1. v4+ takes `{ socket: { host, port } }`. A top-level host/port is
//      silently IGNORED, so the client dialled localhost — where, inside this
//      container, nothing is listening.
//
//   2. v4+ never connects implicitly. Without an explicit `connect()` every
//      command rejects with ClientClosedError, which is exactly what the logs
//      were full of.
//
//   3. `promisify` over a method that already returns a promise is what made
//      it FATAL rather than merely broken. promisify calls
//      `client.set(key, value, callback)` and then waits for a callback that
//      node-redis never invokes; the rejected promise node-redis actually
//      returns is dropped on the floor, unhandled, and Node kills the process.
//      That is why the try/catch in appInfo.controller.js never caught it —
//      the rejection it needed to catch belonged to a promise it never saw.
//
// So: v5 config, an explicit connect, and no promisify. Callers keep the same
// getAsync/setAsync names.

const redis = require("redis");

const client = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT || 6379),
    },
    // node-redis sends AUTH whenever `password` is defined, and "" is still
    // defined. Our compose sets REDIS_PASSWORD to an empty string, which would
    // make the server reject the handshake — so omit the key entirely instead.
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
});

client.on("ready", () => console.log("=== Redis server connected ==="));
// Without a listener, an 'error' event is itself fatal. Redis being briefly
// unreachable must never take down the cron process.
client.on("error", (err) => console.log("=== Error in connecting redis server ===\n", err));

let connecting = null;

/**
 * Resolve once the client is usable, connecting on first use and after any
 * disconnect. Rejections propagate to the caller so their try/catch works —
 * unlike the previous code, where the failure bypassed callers entirely.
 */
function ready() {
    if (client.isOpen) return Promise.resolve();
    if (!connecting) {
        // Cleared either way, so a later disconnect can trigger a fresh attempt
        // rather than handing out a stale resolved promise forever.
        connecting = client.connect().finally(() => { connecting = null; });
    }
    return connecting;
}

async function getAsync(key) {
    await ready();
    return client.get(key);
}

async function setAsync(key, value) {
    await ready();
    return client.set(key, value);
}

module.exports = { getAsync, setAsync, client };
