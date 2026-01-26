"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const electron_store_1 = __importDefault(require("electron-store"));
// Initialize store for settings
const store = new electron_store_1.default({
    defaults: {
        apiUrl: 'http://localhost:3001',
        kioskMode: false,
        printerEnabled: true,
    },
});
let mainWindow = null;
function createWindow() {
    const isKiosk = store.get('kioskMode');
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 600,
        fullscreen: isKiosk,
        kiosk: isKiosk,
        autoHideMenuBar: isKiosk,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, '../renderer/assets/icon.png'),
    });
    // In development, load from Vite dev server
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        mainWindow.loadURL('http://localhost:3004');
        mainWindow.webContents.openDevTools();
    }
    else {
        // In production, load the built files
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Create menu (hidden in kiosk mode)
    if (!isKiosk) {
        const menu = electron_1.Menu.buildFromTemplate([
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Toggle Kiosk Mode',
                        accelerator: 'F11',
                        click: () => toggleKioskMode(),
                    },
                    {
                        label: 'Toggle DevTools',
                        accelerator: 'F12',
                        click: () => mainWindow?.webContents.toggleDevTools(),
                    },
                    { type: 'separator' },
                    { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => electron_1.app.quit() },
                ],
            },
        ]);
        electron_1.Menu.setApplicationMenu(menu);
    }
}
function toggleKioskMode() {
    if (!mainWindow)
        return;
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
    mainWindow.setKiosk(!isFullScreen);
}
// App lifecycle
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// IPC Handlers
electron_1.ipcMain.handle('get-settings', () => {
    return {
        apiUrl: store.get('apiUrl'),
        kioskMode: store.get('kioskMode'),
        printerEnabled: store.get('printerEnabled'),
    };
});
electron_1.ipcMain.handle('set-settings', (_, settings) => {
    Object.entries(settings).forEach(([key, value]) => {
        store.set(key, value);
    });
    return true;
});
electron_1.ipcMain.handle('toggle-fullscreen', () => {
    toggleKioskMode();
    return mainWindow?.isFullScreen();
});
electron_1.ipcMain.handle('get-app-info', () => {
    return {
        version: electron_1.app.getVersion(),
        platform: process.platform,
        arch: process.arch,
    };
});
// Print via ESC/POS (if printer connected directly to terminal)
electron_1.ipcMain.handle('print-receipt', async (_, orderData) => {
    try {
        // This would use escpos directly if printer is connected to this machine
        // For now, we'll delegate to the backend API
        console.log('Print request received:', orderData);
        return { success: true };
    }
    catch (error) {
        console.error('Print error:', error);
        return { success: false, error: error.message };
    }
});
