import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import Store from 'electron-store';

// Initialize store for settings
const store = new Store({
  defaults: {
    apiUrl: 'http://localhost:3001',
    kioskMode: false,
    printerEnabled: true,
  },
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const isKiosk = store.get('kioskMode') as boolean;

  mainWindow = new BrowserWindow({
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
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:3004');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create menu (hidden in kiosk mode)
  if (!isKiosk) {
    const menu = Menu.buildFromTemplate([
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
          { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
        ],
      },
    ]);
    Menu.setApplicationMenu(menu);
  }
}

function toggleKioskMode() {
  if (!mainWindow) return;

  const isFullScreen = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFullScreen);
  mainWindow.setKiosk(!isFullScreen);
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-settings', () => {
  return {
    apiUrl: store.get('apiUrl'),
    kioskMode: store.get('kioskMode'),
    printerEnabled: store.get('printerEnabled'),
  };
});

ipcMain.handle('set-settings', (_, settings: Record<string, any>) => {
  Object.entries(settings).forEach(([key, value]) => {
    store.set(key, value);
  });
  return true;
});

ipcMain.handle('toggle-fullscreen', () => {
  toggleKioskMode();
  return mainWindow?.isFullScreen();
});

ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  };
});

// Print via ESC/POS (if printer connected directly to terminal)
ipcMain.handle('print-receipt', async (_, orderData: any) => {
  try {
    // This would use escpos directly if printer is connected to this machine
    // For now, we'll delegate to the backend API
    console.log('Print request received:', orderData);
    return { success: true };
  } catch (error: any) {
    console.error('Print error:', error);
    return { success: false, error: error.message };
  }
});
