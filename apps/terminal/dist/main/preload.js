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
    getPrinters: () => electron_1.ipcRenderer.invoke('get-printers'),
    getPrintQueue: () => electron_1.ipcRenderer.invoke('get-print-queue'),
    // VFD Customer Display
    vfd: {
        connect: (portPath, baudRate) => electron_1.ipcRenderer.invoke('vfd-connect', portPath, baudRate),
        disconnect: () => electron_1.ipcRenderer.invoke('vfd-disconnect'),
        status: () => electron_1.ipcRenderer.invoke('vfd-status'),
        listPorts: () => electron_1.ipcRenderer.invoke('vfd-list-ports'),
        welcome: () => electron_1.ipcRenderer.invoke('vfd-welcome'),
        itemAdded: (itemName, price, total) => electron_1.ipcRenderer.invoke('vfd-item-added', itemName, price, total),
        total: (total) => electron_1.ipcRenderer.invoke('vfd-total', total),
        clear: () => electron_1.ipcRenderer.invoke('vfd-clear'),
    },
});
