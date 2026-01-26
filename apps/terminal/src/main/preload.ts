import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: Record<string, any>) => ipcRenderer.invoke('set-settings', settings),
  
  // App control
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Printing
  printReceipt: (orderData: any) => ipcRenderer.invoke('print-receipt', orderData),
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<{
        apiUrl: string;
        kioskMode: boolean;
        printerEnabled: boolean;
      }>;
      setSettings: (settings: Record<string, any>) => Promise<boolean>;
      toggleFullscreen: () => Promise<boolean>;
      getAppInfo: () => Promise<{
        version: string;
        platform: string;
        arch: string;
      }>;
      printReceipt: (orderData: any) => Promise<{ success: boolean; error?: string }>;
    };
  }
}
