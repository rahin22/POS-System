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
      }>;
      setSettings: (settings: Record<string, any>) => Promise<boolean>;
      toggleFullscreen: () => Promise<boolean>;
      getAppInfo: () => Promise<{
        version: string;
        platform: string;
        arch: string;
      }>;
      printReceipt: (orderData: any) => Promise<{ success: boolean; error?: string }>;
      getPrinters: () => Promise<{ success: boolean; printers: string[]; error?: string }>;
      getPrintQueue: () => Promise<{ success: boolean; jobs: Array<{ job: string; user: string; size: string; date: string }>; error?: string }>;
      vfd: {
        connect: (portPath?: string, baudRate?: number) => Promise<{ success: boolean; error?: string }>;
        disconnect: () => Promise<{ success: boolean }>;
        status: () => Promise<{ connected: boolean }>;
        listPorts: () => Promise<{ path: string; manufacturer?: string }[]>;
        welcome: () => Promise<{ success: boolean }>;
        total: (total: number) => Promise<{ success: boolean }>;
        clear: () => Promise<{ success: boolean }>;
      };
    };
  }
}
