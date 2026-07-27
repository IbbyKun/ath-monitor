'use strict';

// The only bridge between the renderer and the main process.
//
// Everything is an explicit, named channel — the renderer never receives
// `ipcRenderer` itself, and never sees the auth token.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
    getInfo: () => ipcRenderer.invoke('app:info'),
    login: (email, password, serverUrl) =>
        ipcRenderer.invoke('auth:login', { email, password, serverUrl }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    startTimer: () => ipcRenderer.invoke('timer:start'),
    stopTimer: () => ipcRenderer.invoke('timer:stop'),
    getStatus: () => ipcRenderer.invoke('status:get'),
    drainQueue: () => ipcRenderer.invoke('queue:drain'),

    onStatus: (callback) => {
        const handler = (_event, status) => callback(status);
        ipcRenderer.on('status', handler);
        return () => ipcRenderer.removeListener('status', handler);
    },
    onAuthExpired: (callback) => {
        const handler = () => callback();
        ipcRenderer.on('auth-expired', handler);
        return () => ipcRenderer.removeListener('auth-expired', handler);
    },
});
