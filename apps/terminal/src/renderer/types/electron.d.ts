export {};

declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<{ apiUrl: string; printerType: string }>;
      printReceipt: (orderId: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}
