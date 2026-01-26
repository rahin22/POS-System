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
        apiUrl: 'https://kebab-posbackend-production.up.railway.app',
        kioskMode: false,
        printerEnabled: true,
        printerName: 'Element_RW973_Mk',
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
        printerName: store.get('printerName'),
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
// Get list of available printers from CUPS
electron_1.ipcMain.handle('get-printers', async () => {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        // Get list of printers
        const { stdout } = await execAsync('lpstat -p');
        // Parse printer names from output
        // Format: "printer PrinterName is idle/printing..."
        const lines = stdout.split('\n').filter((line) => line.startsWith('printer '));
        const printers = lines.map((line) => {
            const match = line.match(/^printer (\S+)/);
            return match ? match[1] : null;
        }).filter(Boolean);
        return { success: true, printers };
    }
    catch (error) {
        console.error('Error getting printers:', error);
        return { success: false, printers: [], error: error.message };
    }
});
// Get print queue status
electron_1.ipcMain.handle('get-print-queue', async () => {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        // Get print queue
        const { stdout } = await execAsync('lpstat -o');
        // Parse queue
        const lines = stdout.trim().split('\n').filter((line) => line.length > 0);
        const jobs = lines.map((line) => {
            // Format: "PrinterName-jobid user size date time"
            const parts = line.split(/\s+/);
            return {
                job: parts[0],
                user: parts[1],
                size: parts[2],
                date: parts.slice(3).join(' ')
            };
        });
        return { success: true, jobs };
    }
    catch (error) {
        // Empty queue returns error, that's normal
        if (error.message.includes('No entries')) {
            return { success: true, jobs: [] };
        }
        console.error('Error getting print queue:', error);
        return { success: false, jobs: [], error: error.message };
    }
});
// Print via ESC/POS (if printer connected directly to terminal)
electron_1.ipcMain.handle('print-receipt', async (_, orderData) => {
    try {
        console.log('Print request received:', orderData);
        // Check if printer is enabled
        if (!store.get('printerEnabled')) {
            console.log('Printer disabled in settings');
            return { success: true }; // Still return success to not block order completion
        }
        // Use CUPS directly on Linux via lp command
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        // Format receipt content
        const lines = [
            '\x1B\x40', // Initialize printer
        ];
        // Check if this is a kitchen docket
        const isKitchen = orderData.paymentMethod === 'kitchen';
        if (isKitchen) {
            // KITCHEN DOCKET FORMAT
            lines.push('\x1B\x61\x01'); // Center align
            lines.push('\x1B\x21\x30'); // Double width & height
            lines.push('KITCHEN ORDER\n\n');
            lines.push('\x1B\x21\x00'); // Normal size
            lines.push('\x1B\x61\x00'); // Left align
            lines.push('================================\n');
            lines.push('\x1B\x21\x20'); // Double width
            lines.push(`Order #${orderData.orderNumber}\n`);
            lines.push('\x1B\x21\x00'); // Normal size
            lines.push('================================\n');
            lines.push(`Time: ${new Date().toLocaleTimeString()}\n`);
            lines.push(`Type: ${orderData.orderType?.toUpperCase() || 'N/A'}\n`);
            if (orderData.customerName) {
                lines.push(`Customer: ${orderData.customerName}\n`);
            }
            lines.push('--------------------------------\n\n');
            // Items - larger and clearer for kitchen
            if (orderData.items && orderData.items.length > 0) {
                orderData.items.forEach((item) => {
                    const quantity = item.quantity || 1;
                    const name = item.name || item.product?.name || 'Item';
                    lines.push('\x1B\x21\x10'); // Double height
                    lines.push(`${quantity}x ${name}\n`);
                    lines.push('\x1B\x21\x00'); // Normal size
                    if (item.modifiers && item.modifiers.length > 0) {
                        item.modifiers.forEach((mod) => {
                            lines.push(`  >> ${mod.name}\n`);
                        });
                    }
                    lines.push('\n');
                });
            }
            lines.push('================================\n');
            lines.push('\x1B\x61\x01'); // Center align
            lines.push('\n-- KITCHEN COPY --\n');
        }
        else {
            // CUSTOMER RECEIPT FORMAT
            lines.push('\x1B\x61\x01'); // Center align
            lines.push('\x1B\x21\x30'); // Double width & height
            lines.push('AL-TAHER KEBAB\n\n');
            lines.push('\x1B\x21\x00'); // Normal size
            lines.push('\x1B\x61\x00'); // Left align
            lines.push(`Order #${orderData.orderNumber}\n`);
            lines.push(`Date: ${new Date().toLocaleString()}\n`);
            lines.push(`Customer: ${orderData.customerName || 'Guest'}\n`);
            lines.push(`Type: ${orderData.orderType}\n`);
            lines.push('--------------------------------\n');
            // Add items
            if (orderData.items && orderData.items.length > 0) {
                orderData.items.forEach((item) => {
                    const quantity = item.quantity || 1;
                    const name = item.name || item.product?.name || 'Item';
                    const price = item.price || item.unitPrice || 0;
                    lines.push(`${quantity}x ${name}\n`);
                    lines.push(`   $${price.toFixed(2)}\n`);
                    if (item.modifiers && item.modifiers.length > 0) {
                        item.modifiers.forEach((mod) => {
                            lines.push(`   + ${mod.name}\n`);
                        });
                    }
                });
            }
            lines.push('--------------------------------\n');
            lines.push(`Subtotal: $${(orderData.subtotal || 0).toFixed(2)}\n`);
            lines.push(`Tax: $${(orderData.tax || 0).toFixed(2)}\n`);
            lines.push('\x1B\x21\x10'); // Double height
            lines.push(`TOTAL: $${(orderData.total || 0).toFixed(2)}\n`);
            lines.push('\x1B\x21\x00'); // Normal size
            lines.push('--------------------------------\n');
            lines.push(`Payment: ${orderData.paymentMethod}\n`);
            lines.push('\x1B\x61\x01'); // Center align
            lines.push('\n\nThank you!\n\n\n\n');
        }
        lines.push('\n\n\n\n');
        lines.push('\x1D\x56\x00'); // Cut paper
        const receiptData = lines.join('');
        // Write to temporary file and print via lp
        const fs = require('fs');
        const path = require('path');
        const tmpFile = path.join(require('os').tmpdir(), 'receipt.txt');
        fs.writeFileSync(tmpFile, receiptData);
        // Print using lp command to CUPS printer
        const printerName = store.get('printerName') || 'Element_RW973_Mk';
        await execAsync(`lp -d ${printerName} -o raw ${tmpFile}`);
        // Clean up
        fs.unlinkSync(tmpFile);
        console.log('Receipt printed successfully');
        return { success: true };
    }
    catch (error) {
        console.error('Print error:', error);
        return { success: false, error: error.message };
    }
});
