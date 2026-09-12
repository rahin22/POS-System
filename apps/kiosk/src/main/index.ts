import { app, BrowserWindow, ipcMain, Menu, globalShortcut, powerSaveBlocker } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { randomUUID } from 'crypto';
import Store from 'electron-store';
import * as eftpos from './eftpos';
import { listPrinters, printCustomerReceipt, printTestPage, destroyPrintContexts } from './printer';
import type { ReceiptData } from './receipt';

const store = new Store({
  defaults: {
    apiUrl: 'https://kebab-posbackend-production.up.railway.app',
    kioskMode: true,
    // Printing
    printerEnabled: true,
    printerName: '',
    paperWidthMm: 72,
    receiptCopies: 1,
    // Ordering behaviour
    // 'cards' = category grid that opens a product sheet, 'scroll' = one long menu
    menuLayout: 'cards' as string,
    attractTimeoutSeconds: 60,
    adminPin: '1234',
    orderTypePrompt: true,
    // EFTPOS (SmartConnect)
    eftposEnabled: true,
    eftposEnvironment: 'prod' as string,
    eftposRegisterID: '' as string,
    eftposRegisterName: 'Kiosk 1' as string,
    eftposBusinessName: 'Al Taher Kebabs' as string,
    eftposPrintReceipt: true,
  },
});

// Stable per-device Register ID, generated once. Changing it invalidates pairing.
if (!store.get('eftposRegisterID')) {
  store.set('eftposRegisterID', randomUUID());
}

function configureEftpos() {
  eftpos.configure({
    environment: store.get('eftposEnvironment') as 'dev' | 'prod',
    posRegisterID: store.get('eftposRegisterID') as string,
    posRegisterName: store.get('eftposRegisterName') as string,
    posBusinessName: store.get('eftposBusinessName') as string,
  });
}

configureEftpos();

let mainWindow: BrowserWindow | null = null;
let powerBlockerId: number | null = null;

/**
 * The renderer reports whether a customer is mid-order. Updates are only
 * installed while the kiosk is idle on the attract screen.
 */
let kioskBusy = false;
let updateReady = false;
let updateState: {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
  error?: string;
} = { status: 'idle' };

function createWindow() {
  const isKiosk = store.get('kioskMode') as boolean;
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  mainWindow = new BrowserWindow({
    // Portrait: the Sin-M01 is a 15.6" panel mounted vertically (1080x1920).
    // In development we use a half-scale window so it fits a desktop monitor.
    width: isDev ? 540 : 1080,
    height: isDev ? 960 : 1920,
    fullscreen: isKiosk && !isDev,
    kiosk: isKiosk && !isDev,
    autoHideMenuBar: true,
    backgroundColor: '#0E0D0C',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3006');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Nothing in this app should ever navigate away or spawn a window
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:3006') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  Menu.setApplicationMenu(null);
}

function registerShortcuts() {
  // Staff escape hatch out of kiosk mode; the admin panel is reached from the UI
  globalShortcut.register('Control+Shift+K', () => {
    if (!mainWindow) return;
    const nowKiosk = !mainWindow.isKiosk();
    mainWindow.setKiosk(nowKiosk);
    mainWindow.setFullScreen(nowKiosk);
  });

  globalShortcut.register('Control+Shift+I', () => {
    mainWindow?.webContents.toggleDevTools();
  });
}

// ---------------------------------------------------------------- auto updater

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  // Never restart under a customer's hands; installs happen via maybeInstallUpdate()
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updateState = { status: 'checking' };
    sendUpdateState();
  });

  autoUpdater.on('update-available', (info) => {
    updateState = { status: 'downloading', version: info.version, percent: 0 };
    sendUpdateState();
  });

  autoUpdater.on('update-not-available', () => {
    updateState = { status: 'idle' };
    sendUpdateState();
  });

  autoUpdater.on('download-progress', (progress) => {
    updateState = { ...updateState, status: 'downloading', percent: progress.percent };
    sendUpdateState();
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    updateState = { status: 'ready', version: info.version };
    sendUpdateState();
    maybeInstallUpdate();
  });

  autoUpdater.on('error', (err) => {
    updateState = { status: 'error', error: err.message };
    sendUpdateState();
  });

  const check = () => {
    if (!app.isPackaged) return;
    autoUpdater.checkForUpdates().catch((err) => {
      console.log('Update check failed:', err.message);
    });
  };

  // First check shortly after boot, then every 2 hours
  setTimeout(check, 30 * 1000);
  setInterval(check, 2 * 60 * 60 * 1000);
}

function sendUpdateState() {
  mainWindow?.webContents.send('update-state', updateState);
}

/** Installs a downloaded update only when no customer is mid-order. */
function maybeInstallUpdate() {
  if (!updateReady || kioskBusy) return;
  setImmediate(() => {
    autoUpdater.quitAndInstall(true, true);
  });
}

// ------------------------------------------------------------------------- app

app.whenReady().then(() => {
  createWindow();
  registerShortcuts();
  setupAutoUpdater();

  // A kiosk must never sleep or blank mid-service
  powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  destroyPrintContexts();
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
  }
});

// ----------------------------------------------------------------- IPC: config

ipcMain.handle('get-settings', () => ({
  apiUrl: store.get('apiUrl'),
  kioskMode: store.get('kioskMode'),
  printerEnabled: store.get('printerEnabled'),
  printerName: store.get('printerName'),
  paperWidthMm: store.get('paperWidthMm'),
  receiptCopies: store.get('receiptCopies'),
  menuLayout: store.get('menuLayout'),
  attractTimeoutSeconds: store.get('attractTimeoutSeconds'),
  adminPin: store.get('adminPin'),
  orderTypePrompt: store.get('orderTypePrompt'),
  eftposEnabled: store.get('eftposEnabled'),
  eftposEnvironment: store.get('eftposEnvironment'),
  eftposRegisterID: store.get('eftposRegisterID'),
  eftposRegisterName: store.get('eftposRegisterName'),
  eftposBusinessName: store.get('eftposBusinessName'),
  eftposPrintReceipt: store.get('eftposPrintReceipt'),
}));

ipcMain.handle('set-settings', (_event, settings: Record<string, any>) => {
  // The Register ID is tied to the terminal pairing and must never be written over
  const { eftposRegisterID: _ignored, ...safeSettings } = settings;
  Object.entries(safeSettings).forEach(([key, value]) => store.set(key, value));
  configureEftpos();

  if (mainWindow && typeof safeSettings.kioskMode === 'boolean' && app.isPackaged) {
    mainWindow.setKiosk(safeSettings.kioskMode);
    mainWindow.setFullScreen(safeSettings.kioskMode);
  }

  return true;
});

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
}));

// --------------------------------------------------------------- IPC: printing

ipcMain.handle('get-printers', async () => listPrinters());

ipcMain.handle('print-receipt', async (_event, data: ReceiptData) => {
  if (!store.get('printerEnabled')) {
    return { success: true, skipped: true };
  }

  return printCustomerReceipt(
    { ...data, paperWidthMm: store.get('paperWidthMm') as number },
    {
      deviceName: store.get('printerName') as string,
      copies: store.get('receiptCopies') as number,
    }
  );
});

ipcMain.handle('print-test', async () =>
  printTestPage({ deviceName: store.get('printerName') as string })
);

// ----------------------------------------------------------------- IPC: eftpos

ipcMain.handle('eftpos-pair', async (_event, pairingCode: string) => eftpos.pair(pairingCode));

ipcMain.handle('eftpos-purchase', async (_event, amountCents: number) =>
  eftpos.purchase(amountCents, () => {
    mainWindow?.webContents.send('eftpos-delayed');
  })
);

// ------------------------------------------------------------- IPC: kiosk state

ipcMain.handle('set-busy', (_event, busy: boolean) => {
  kioskBusy = busy;
  // Returning to idle is the moment a pending update can safely be applied
  if (!busy) maybeInstallUpdate();
  return true;
});

ipcMain.handle('get-update-state', () => updateState);

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { success: false, message: 'Updates only run in a packaged build' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, version: result?.updateInfo?.version };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('install-update-now', () => {
  if (!updateReady) return { success: false, message: 'No update downloaded' };
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
  return { success: true };
});

ipcMain.handle('quit-app', () => {
  app.quit();
  return true;
});
