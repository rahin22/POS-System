export {};

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
        eftposEnabled: boolean;
        eftposEnvironment: 'dev' | 'prod';
        eftposRegisterID: string;
        eftposRegisterName: string;
        eftposBusinessName: string;
        eftposPrintReceipt: boolean;
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
      checkForUpdates?: () => Promise<{ success: boolean; updateInfo?: any; message?: string }>;
      downloadUpdate?: () => Promise<{ success: boolean; message?: string }>;
      installUpdate?: () => void;
      onUpdateAvailable?: (callback: (info: { version: string; releaseNotes?: string }) => void) => void;
      onUpdateDownloadProgress?: (callback: (progress: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void) => void;
      onUpdateDownloaded?: (callback: (info: { version: string }) => void) => void;
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
      eftpos: {
        pair: (pairingCode: string) => Promise<{ success: boolean; error?: string }>;
        purchase: (amountCents: number) => Promise<{
          outcome: 'Accepted' | 'Declined' | 'Cancelled' | 'DeviceOffline' | 'Failed';
          amountTotal?: number;
          authId?: string;
          acquirerRef?: string;
          terminalRef?: string;
          cardPan?: string;
          cardType?: string;
          receipt?: string;
          transactionId?: string;
          error?: string;
        }>;
        onDelayed: (callback: () => void) => () => void;
      };
    };
  }
}
