import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('kioskAPI', {
  // Configuration
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: Record<string, any>) => ipcRenderer.invoke('set-settings', settings),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Printing
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceipt: (data: any) => ipcRenderer.invoke('print-receipt', data),
  printTest: () => ipcRenderer.invoke('print-test'),

  // EFTPOS (SmartConnect)
  eftpos: {
    pair: (pairingCode: string) => ipcRenderer.invoke('eftpos-pair', pairingCode),
    purchase: (amountCents: number) => ipcRenderer.invoke('eftpos-purchase', amountCents),
    onDelayed: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('eftpos-delayed', listener);
      return () => ipcRenderer.removeListener('eftpos-delayed', listener);
    },
  },

  // Kiosk lifecycle
  setBusy: (busy: boolean) => ipcRenderer.invoke('set-busy', busy),
  quit: () => ipcRenderer.invoke('quit-app'),

  // Updates
  updates: {
    getState: () => ipcRenderer.invoke('get-update-state'),
    check: () => ipcRenderer.invoke('check-for-updates'),
    installNow: () => ipcRenderer.invoke('install-update-now'),
    onState: (callback: (state: any) => void) => {
      const listener = (_event: unknown, state: any) => callback(state);
      ipcRenderer.on('update-state', listener);
      return () => ipcRenderer.removeListener('update-state', listener);
    },
  },
});
