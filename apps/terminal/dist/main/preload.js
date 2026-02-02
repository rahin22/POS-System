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
    // Custom receipt assets
    selectLogoImage: () => electron_1.ipcRenderer.invoke('select-logo-image'),
    selectQrCodeImage: () => electron_1.ipcRenderer.invoke('select-qrcode-image'),
    resetLogo: () => electron_1.ipcRenderer.invoke('reset-logo'),
    resetQrCode: () => electron_1.ipcRenderer.invoke('reset-qrcode'),
    // Auto-updates
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => electron_1.ipcRenderer.invoke('download-update'),
    installUpdate: () => electron_1.ipcRenderer.invoke('install-update'),
    onUpdateAvailable: (callback) => {
        electron_1.ipcRenderer.on('update-available', (_, info) => callback(info));
    },
    onUpdateDownloadProgress: (callback) => {
        electron_1.ipcRenderer.on('update-download-progress', (_, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback) => {
        electron_1.ipcRenderer.on('update-downloaded', (_, info) => callback(info));
    },
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
