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
const electron_updater_1 = require("electron-updater");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const electron_store_1 = __importDefault(require("electron-store"));
const vfd = __importStar(require("./vfd"));
// Initialize store for settings
const store = new electron_store_1.default({
    defaults: {
        apiUrl: 'https://kebab-posbackend-production.up.railway.app',
        kioskMode: false,
        printerEnabled: true,
        printerName: 'Element_RW973_Mk',
        vfdEnabled: false,
        vfdPort: '/dev/ttyUSB0',
        vfdBaudRate: 9600,
        customLogoPath: '', // Empty means use default
        customQrCodePath: '', // Empty means use default
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
// Auto-updater setup
function setupAutoUpdater() {
    // Configure auto-updater
    electron_updater_1.autoUpdater.autoDownload = false; // Don't auto-download, let user decide
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
    // Check for updates on startup
    electron_updater_1.autoUpdater.checkForUpdates().catch(err => {
        console.log('Update check failed:', err.message);
    });
    // Check for updates every 4 hours
    setInterval(() => {
        electron_updater_1.autoUpdater.checkForUpdates().catch(err => {
            console.log('Update check failed:', err.message);
        });
    }, 4 * 60 * 60 * 1000);
    // Update available
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version);
        if (mainWindow) {
            mainWindow.webContents.send('update-available', {
                version: info.version,
                releaseNotes: info.releaseNotes,
            });
        }
        // Show dialog asking user if they want to download
        electron_1.dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `A new version (${info.version}) is available!`,
            detail: 'Would you like to download it now? The update will be installed when you restart the app.',
            buttons: ['Download', 'Later'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 0) {
                electron_updater_1.autoUpdater.downloadUpdate();
            }
        });
    });
    // No update available
    electron_updater_1.autoUpdater.on('update-not-available', () => {
        console.log('App is up to date');
    });
    // Download progress
    electron_updater_1.autoUpdater.on('download-progress', (progress) => {
        console.log(`Download progress: ${progress.percent.toFixed(1)}%`);
        if (mainWindow) {
            mainWindow.webContents.send('update-download-progress', {
                percent: progress.percent,
                bytesPerSecond: progress.bytesPerSecond,
                total: progress.total,
                transferred: progress.transferred,
            });
        }
    });
    // Update downloaded
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info.version);
        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded', {
                version: info.version,
            });
        }
        // Ask user to restart
        electron_1.dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded!',
            detail: 'The update has been downloaded. Restart now to install it?',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 0) {
                electron_updater_1.autoUpdater.quitAndInstall(false, true);
            }
        });
    });
    // Error handling
    electron_updater_1.autoUpdater.on('error', (err) => {
        console.error('Auto-updater error:', err.message);
    });
}
// App lifecycle
electron_1.app.whenReady().then(() => {
    createWindow();
    // Setup auto-updater (only in production)
    if (electron_1.app.isPackaged) {
        setupAutoUpdater();
    }
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
        vfdEnabled: store.get('vfdEnabled'),
        vfdPort: store.get('vfdPort'),
        vfdBaudRate: store.get('vfdBaudRate'),
        customLogoPath: store.get('customLogoPath'),
        customQrCodePath: store.get('customQrCodePath'),
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
// Update-related IPC handlers
electron_1.ipcMain.handle('check-for-updates', async () => {
    if (!electron_1.app.isPackaged) {
        return { success: false, message: 'Updates only available in production' };
    }
    try {
        const result = await electron_updater_1.autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result?.updateInfo };
    }
    catch (err) {
        return { success: false, message: err.message };
    }
});
electron_1.ipcMain.handle('download-update', async () => {
    try {
        await electron_updater_1.autoUpdater.downloadUpdate();
        return { success: true };
    }
    catch (err) {
        return { success: false, message: err.message };
    }
});
electron_1.ipcMain.handle('install-update', () => {
    electron_updater_1.autoUpdater.quitAndInstall(false, true);
});
// Select custom logo image
electron_1.ipcMain.handle('select-logo-image', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        title: 'Select Logo Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
        properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        // Copy to app data folder for persistence
        const userDataPath = electron_1.app.getPath('userData');
        const customAssetsPath = path.join(userDataPath, 'custom-assets');
        if (!fs.existsSync(customAssetsPath)) {
            fs.mkdirSync(customAssetsPath, { recursive: true });
        }
        const destPath = path.join(customAssetsPath, 'custom-logo.png');
        fs.copyFileSync(selectedPath, destPath);
        store.set('customLogoPath', destPath);
        return { success: true, path: destPath };
    }
    return { success: false };
});
// Select custom QR code image
electron_1.ipcMain.handle('select-qrcode-image', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        title: 'Select QR Code Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
        properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        // Copy to app data folder for persistence
        const userDataPath = electron_1.app.getPath('userData');
        const customAssetsPath = path.join(userDataPath, 'custom-assets');
        if (!fs.existsSync(customAssetsPath)) {
            fs.mkdirSync(customAssetsPath, { recursive: true });
        }
        const destPath = path.join(customAssetsPath, 'custom-qrcode.png');
        fs.copyFileSync(selectedPath, destPath);
        store.set('customQrCodePath', destPath);
        return { success: true, path: destPath };
    }
    return { success: false };
});
// Reset to default logo
electron_1.ipcMain.handle('reset-logo', () => {
    store.set('customLogoPath', '');
    const userDataPath = electron_1.app.getPath('userData');
    const customLogoPath = path.join(userDataPath, 'custom-assets', 'custom-logo.png');
    if (fs.existsSync(customLogoPath)) {
        fs.unlinkSync(customLogoPath);
    }
    return { success: true };
});
// Reset to default QR code
electron_1.ipcMain.handle('reset-qrcode', () => {
    store.set('customQrCodePath', '');
    const userDataPath = electron_1.app.getPath('userData');
    const customQrPath = path.join(userDataPath, 'custom-assets', 'custom-qrcode.png');
    if (fs.existsSync(customQrPath)) {
        fs.unlinkSync(customQrPath);
    }
    return { success: true };
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
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        // Check if this is a kitchen docket
        const isKitchen = orderData.paymentMethod === 'kitchen';
        // Build ESC/POS commands
        const commands = [];
        // Helper to add text
        const addText = (text) => {
            for (let i = 0; i < text.length; i++) {
                commands.push(text.charCodeAt(i));
            }
        };
        // Helper to add raw bytes
        const addBytes = (...bytes) => {
            commands.push(...bytes);
        };
        // ESC/POS Commands
        const ESC = 0x1B;
        const GS = 0x1D;
        const LF = 0x0A;
        // Helper to format order type for display
        const formatOrderType = (type) => {
            if (!type)
                return 'TAKEAWAY';
            const normalized = type.toLowerCase().replace(/_/g, '-');
            const typeMap = {
                'dine-in': 'DINE IN',
                'dine_in': 'DINE IN',
                'takeaway': 'TAKEAWAY',
                'delivery': 'DELIVERY',
                'online': 'ONLINE',
            };
            return typeMap[normalized] || type.toUpperCase().replace(/[-_]/g, ' ');
        };
        // Initialize printer
        addBytes(ESC, 0x40);
        if (isKitchen) {
            // KITCHEN DOCKET FORMAT
            // Center align
            addBytes(ESC, 0x61, 0x01);
            // Double width & height
            addBytes(ESC, 0x21, 0x30);
            addText('KITCHEN ORDER');
            addBytes(LF, LF);
            // Normal size
            addBytes(ESC, 0x21, 0x00);
            // Left align
            addBytes(ESC, 0x61, 0x00);
            addText('================================');
            addBytes(LF);
            // Large order number
            addBytes(ESC, 0x21, 0x30); // Double width & height
            addText(`#${orderData.orderNumber}`);
            addBytes(LF);
            // Normal size
            addBytes(ESC, 0x21, 0x00);
            addText('================================');
            addBytes(LF);
            addText(`Time: ${new Date().toLocaleTimeString()}`);
            addBytes(LF);
            // Order type - fix undefined issue
            const orderType = formatOrderType(orderData.orderType || orderData.type);
            addText(`Type: ${orderType}`);
            addBytes(LF);
            if (orderData.customerName) {
                addText(`Customer: ${orderData.customerName}`);
                addBytes(LF);
            }
            addText('--------------------------------');
            addBytes(LF, LF);
            // Items - larger and clearer for kitchen
            if (orderData.items && orderData.items.length > 0) {
                orderData.items.forEach((item) => {
                    const quantity = item.quantity || 1;
                    const name = item.name || item.product?.name || 'Item';
                    // Double height for item names
                    addBytes(ESC, 0x21, 0x10);
                    addText(`${quantity}x ${name}`);
                    addBytes(LF);
                    // Normal size for modifiers
                    addBytes(ESC, 0x21, 0x00);
                    if (item.modifiers && item.modifiers.length > 0) {
                        item.modifiers.forEach((mod) => {
                            addText(`  >> ${mod.name}`);
                            addBytes(LF);
                        });
                    }
                    if (item.notes) {
                        addText(`  ** ${item.notes} **`);
                        addBytes(LF);
                    }
                    addBytes(LF);
                });
            }
            addText('================================');
            addBytes(LF);
            // Center align
            addBytes(ESC, 0x61, 0x01);
            addText('-- KITCHEN COPY --');
            addBytes(LF);
        }
        else {
            // CUSTOMER RECEIPT FORMAT
            // Determine logo path - use custom if set, otherwise default
            const customLogoPath = store.get('customLogoPath');
            let logoPath;
            if (customLogoPath && fs.existsSync(customLogoPath)) {
                logoPath = customLogoPath;
            }
            else {
                logoPath = electron_1.app.isPackaged
                    ? path.join(process.resourcesPath, 'assets', 'logo.png')
                    : path.join(__dirname, '../../assets/logo.png');
            }
            if (fs.existsSync(logoPath)) {
                try {
                    // Use escpos to print image
                    const escpos = require('escpos');
                    const Image = require('escpos').Image;
                    // Load and convert image to ESC/POS raster format
                    const image = await new Promise((resolve, reject) => {
                        Image.load(logoPath, (img) => {
                            if (img)
                                resolve(img);
                            else
                                reject(new Error('Failed to load image'));
                        });
                    });
                    // Center align for logo
                    addBytes(ESC, 0x61, 0x01);
                    // Get raster image data
                    const raster = image.toRaster();
                    const width = raster.width;
                    const height = raster.height;
                    const data = raster.data;
                    // GS v 0 - Print raster bit image
                    const xL = width & 0xFF;
                    const xH = (width >> 8) & 0xFF;
                    const yL = height & 0xFF;
                    const yH = (height >> 8) & 0xFF;
                    addBytes(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);
                    for (let i = 0; i < data.length; i++) {
                        commands.push(data[i]);
                    }
                    addBytes(LF);
                }
                catch (imgError) {
                    console.log('Could not print logo image:', imgError);
                    // Fallback to text header
                    addBytes(ESC, 0x61, 0x01);
                    addBytes(ESC, 0x21, 0x30);
                    addText('AL TAHER');
                    addBytes(LF);
                    addBytes(ESC, 0x21, 0x00);
                    addText('KEBABS & SWEETS');
                    addBytes(LF);
                }
            }
            else {
                console.log('Logo not found at:', logoPath);
                // Fallback to text header
                addBytes(ESC, 0x61, 0x01);
                addBytes(ESC, 0x21, 0x30);
                addText('AL TAHER');
                addBytes(LF);
                addBytes(ESC, 0x21, 0x00);
                addText('KEBABS & SWEETS');
                addBytes(LF);
            }
            // Business details (centered)
            addBytes(ESC, 0x61, 0x01);
            addText('Shop 7a/22 Mawson Pl, Mawson ACT 2607');
            addBytes(LF);
            addText('ALTAHER LIMITED | ABN: 79 689 402 051');
            addBytes(LF);
            // Left align
            addBytes(ESC, 0x61, 0x00);
            addText('================================');
            addBytes(LF);
            // Center align for order info
            addBytes(ESC, 0x61, 0x01);
            // Order type - fix undefined issue
            const orderType = formatOrderType(orderData.orderType || orderData.type);
            addBytes(ESC, 0x21, 0x10); // Double height
            addText(orderType);
            addBytes(LF);
            // Large order number - BIGGER
            addBytes(ESC, 0x21, 0x30); // Double width & height
            addText(`#${orderData.orderNumber}`);
            addBytes(LF);
            // Normal size
            addBytes(ESC, 0x21, 0x00);
            // Left align for details
            addBytes(ESC, 0x61, 0x00);
            addText(`Date: ${new Date().toLocaleString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`);
            addBytes(LF);
            if (orderData.customerName && orderData.customerName !== 'Guest') {
                addText(`Customer: ${orderData.customerName}`);
                addBytes(LF);
            }
            addText('--------------------------------');
            addBytes(LF);
            // Add items at normal size
            if (orderData.items && orderData.items.length > 0) {
                orderData.items.forEach((item) => {
                    const quantity = item.quantity || 1;
                    const name = item.name || item.product?.name || 'Item';
                    const price = item.totalPrice || item.price || item.unitPrice || 0;
                    addText(`${quantity}x ${name}`);
                    addBytes(LF);
                    addText(`   $${price.toFixed(2)}`);
                    addBytes(LF);
                    if (item.modifiers && item.modifiers.length > 0) {
                        item.modifiers.forEach((mod) => {
                            const modPrice = mod.price || 0;
                            if (modPrice > 0) {
                                addText(`   + ${mod.name} ($${modPrice.toFixed(2)})`);
                            }
                            else {
                                addText(`   + ${mod.name}`);
                            }
                            addBytes(LF);
                        });
                    }
                    if (item.notes) {
                        addText(`   Note: ${item.notes}`);
                        addBytes(LF);
                    }
                });
            }
            addText('--------------------------------');
            addBytes(LF);
            addText(`Subtotal: $${(orderData.subtotal || 0).toFixed(2)}`);
            addBytes(LF);
            addText(`GST: $${(orderData.tax || 0).toFixed(2)}`);
            addBytes(LF);
            // Bold and larger total
            addBytes(ESC, 0x21, 0x30); // 3x size (double width and height)
            addText(`TOTAL: $${(orderData.total || 0).toFixed(2)}`);
            addBytes(LF);
            addBytes(ESC, 0x21, 0x00); // Back to normal
            addText('--------------------------------');
            addBytes(LF);
            // Payment method
            const paymentMethod = orderData.paymentMethod || 'CASH';
            addText(`Paid by: ${paymentMethod.toUpperCase()}`);
            addBytes(LF, LF);
            // Center align for footer
            addBytes(ESC, 0x61, 0x01);
            addText('Thank you for your order!');
            addBytes(LF);
            addText('See you again soon');
            addBytes(LF, LF);
            // Determine QR code path - use custom if set, otherwise default
            const customQrCodePath = store.get('customQrCodePath');
            let reviewQrPath;
            if (customQrCodePath && fs.existsSync(customQrCodePath)) {
                reviewQrPath = customQrCodePath;
            }
            else {
                reviewQrPath = electron_1.app.isPackaged
                    ? path.join(process.resourcesPath, 'assets', 'review_qrcode.png')
                    : path.join(__dirname, '../../assets/review_qrcode.png');
            }
            try {
                const escpos = require('escpos');
                const Image = require('escpos').Image;
                // Print Review QR Code
                if (fs.existsSync(reviewQrPath)) {
                    const reviewImage = await new Promise((resolve, reject) => {
                        Image.load(reviewQrPath, (img) => {
                            if (img)
                                resolve(img);
                            else
                                reject(new Error('Failed to load review QR'));
                        });
                    });
                    addText('If you enjoyed your meal,');
                    addBytes(LF);
                    addText("we'd love a review!");
                    addBytes(LF);
                    const reviewRaster = reviewImage.toRaster();
                    const rxL = reviewRaster.width & 0xFF;
                    const rxH = (reviewRaster.width >> 8) & 0xFF;
                    const ryL = reviewRaster.height & 0xFF;
                    const ryH = (reviewRaster.height >> 8) & 0xFF;
                    addBytes(GS, 0x76, 0x30, 0x00, rxL, rxH, ryL, ryH);
                    for (let i = 0; i < reviewRaster.data.length; i++) {
                        commands.push(reviewRaster.data[i]);
                    }
                    addBytes(LF);
                }
            }
            catch (qrError) {
                console.log('Could not print QR code:', qrError);
            }
        }
        // Feed and cut - extra lines for tear-off
        addBytes(LF, LF, LF, LF, LF, LF, LF, LF);
        addBytes(GS, 0x56, 0x00); // Full cut
        // Write to temporary file
        const tmpFile = path.join(require('os').tmpdir(), 'receipt.bin');
        fs.writeFileSync(tmpFile, Buffer.from(commands));
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
// ============================================
// VFD Customer Display IPC Handlers
// ============================================
// Initialize VFD on app start if enabled
electron_1.app.whenReady().then(async () => {
    const vfdEnabled = store.get('vfdEnabled');
    if (vfdEnabled) {
        const vfdPort = store.get('vfdPort');
        const vfdBaudRate = store.get('vfdBaudRate');
        console.log(`[VFD] Auto-connecting to ${vfdPort}...`);
        await vfd.initVFD(vfdPort, vfdBaudRate);
    }
});
// Connect to VFD
electron_1.ipcMain.handle('vfd-connect', async (_, portPath, baudRate) => {
    const port = portPath || store.get('vfdPort');
    const baud = baudRate || store.get('vfdBaudRate');
    return await vfd.initVFD(port, baud);
});
// Disconnect VFD
electron_1.ipcMain.handle('vfd-disconnect', async () => {
    await vfd.closeVFD();
    return { success: true };
});
// Check VFD status
electron_1.ipcMain.handle('vfd-status', () => {
    return { connected: vfd.isVFDConnected() };
});
// List available serial ports
electron_1.ipcMain.handle('vfd-list-ports', async () => {
    return await vfd.listSerialPorts();
});
// Show welcome message
electron_1.ipcMain.handle('vfd-welcome', () => {
    vfd.showWelcome();
    return { success: true };
});
// Show item added with price and running total
electron_1.ipcMain.handle('vfd-item-added', (_, itemName, price, total) => {
    vfd.showItemAdded(itemName, price, total);
    return { success: true };
});
// Show total only
electron_1.ipcMain.handle('vfd-total', (_, total) => {
    vfd.showTotal(total);
    return { success: true };
});
// Clear display
electron_1.ipcMain.handle('vfd-clear', () => {
    vfd.clearDisplay();
    return { success: true };
});
