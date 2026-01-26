"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Settings
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    setSettings: (settings) => electron_1.ipcRenderer.invoke('set-settings', settings),
    // App control
    toggleFullscreen: () => electron_1.ipcRenderer.invoke('toggle-fullscreen'),
    getAppInfo: () => electron_1.ipcRenderer.invoke('get-app-info'),
    // Printing
    printReceipt: (orderData) => electron_1.ipcRenderer.invoke('print-receipt', orderData),
});
