export {};

declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<{
        apiUrl: string;
        kioskMode: boolean;
        printerEnabled: boolean;
        printerName: string;
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
    };
  }
}
