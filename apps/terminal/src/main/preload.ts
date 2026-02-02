import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: Record<string, any>) => ipcRenderer.invoke('set-settings', settings),
  
  // App control
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Custom receipt assets
  selectLogoImage: () => ipcRenderer.invoke('select-logo-image'),
  selectQrCodeImage: () => ipcRenderer.invoke('select-qrcode-image'),
  resetLogo: () => ipcRenderer.invoke('reset-logo'),
  resetQrCode: () => ipcRenderer.invoke('reset-qrcode'),
  
  // Auto-updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('update-download-progress', (_, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
  },
  
  // Printing
  printReceipt: (orderData: any) => ipcRenderer.invoke('print-receipt', orderData),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getPrintQueue: () => ipcRenderer.invoke('get-print-queue'),
  
  // VFD Customer Display
  vfd: {
    connect: (portPath?: string, baudRate?: number) => ipcRenderer.invoke('vfd-connect', portPath, baudRate),
    disconnect: () => ipcRenderer.invoke('vfd-disconnect'),
    status: () => ipcRenderer.invoke('vfd-status'),
    listPorts: () => ipcRenderer.invoke('vfd-list-ports'),
    welcome: () => ipcRenderer.invoke('vfd-welcome'),
    itemAdded: (itemName: string, price: number, total: number) => ipcRenderer.invoke('vfd-item-added', itemName, price, total),
    total: (total: number) => ipcRenderer.invoke('vfd-total', total),
    clear: () => ipcRenderer.invoke('vfd-clear'),
  },
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<{
        apiUrl: string;
        kioskMode: boolean;
        printerEnabled: boolean;
        printerName: string;
        vfdEnabled: boolean;
        vfdPort: string;
        vfdBaudRate: number;
        customLogoPath: string;
        customQrCodePath: string;
      }>;
      setSettings: (settings: Record<string, any>) => Promise<boolean>;
      toggleFullscreen: () => Promise<boolean>;
      getAppInfo: () => Promise<{
        version: string;
        platform: string;
        arch: string;
      }>;
      selectLogoImage: () => Promise<{ success: boolean; path?: string }>;
      selectQrCodeImage: () => Promise<{ success: boolean; path?: string }>;
      resetLogo: () => Promise<{ success: boolean }>;
      resetQrCode: () => Promise<{ success: boolean }>;
      checkForUpdates: () => Promise<{ success: boolean; updateInfo?: any; message?: string }>;
      downloadUpdate: () => Promise<{ success: boolean; message?: string }>;
      installUpdate: () => void;
      onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => void;
      onUpdateDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void) => void;
      onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
      printReceipt: (orderData: any) => Promise<{ success: boolean; error?: string }>;
      getPrinters: () => Promise<{ success: boolean; printers: string[]; error?: string }>;
      getPrintQueue: () => Promise<{ success: boolean; jobs: Array<{ job: string; user: string; size: string; date: string }>; error?: string }>;
      vfd: {
        connect: (portPath?: string, baudRate?: number) => Promise<{ success: boolean; error?: string }>;
        disconnect: () => Promise<{ success: boolean }>;
        status: () => Promise<{ connected: boolean }>;
        listPorts: () => Promise<{ path: string; manufacturer?: string }[]>;
        welcome: () => Promise<{ success: boolean }>;
        itemAdded: (itemName: string, price: number, total: number) => Promise<{ success: boolean }>;
        total: (total: number) => Promise<{ success: boolean }>;
        clear: () => Promise<{ success: boolean }>;
      };
    };
  }
}
