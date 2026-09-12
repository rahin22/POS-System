/**
 * Stand-in for the Electron bridge when the renderer is opened in a plain
 * browser (`npm run dev:renderer` alone, or design review in Chrome).
 *
 * Only installs itself when `window.kioskAPI` is absent, so it can never shadow
 * the real preload bridge inside the packaged app. Card payments are simulated;
 * printing is a no-op that reports success.
 */

const DEFAULT_API_URL = 'https://kebab-posbackend-production.up.railway.app';

export function installBrowserShim() {
  if (window.kioskAPI) return;

  console.warn('[kiosk] Electron bridge missing — running with the browser shim');

  // Read by lib/api.ts to keep preview sessions from writing real orders
  (window as any).__KIOSK_PREVIEW__ = true;

  const settings = {
    apiUrl: import.meta.env.VITE_KIOSK_API_URL || DEFAULT_API_URL,
    kioskMode: false,
    printerEnabled: true,
    printerName: 'Preview Printer',
    paperWidthMm: 72,
    receiptCopies: 1,
    attractTimeoutSeconds: 60,
    adminPin: '1234',
    orderTypePrompt: true,
    eftposEnabled: true,
    eftposEnvironment: 'dev' as const,
    eftposRegisterID: 'preview-register',
    eftposRegisterName: 'Kiosk 1',
    eftposBusinessName: 'Al Taher Kebabs',
    eftposPrintReceipt: true,
  };

  window.kioskAPI = {
    getSettings: async () => ({ ...settings }),
    setSettings: async (patch) => {
      Object.assign(settings, patch);
      return true;
    },
    getAppInfo: async () => ({ version: 'preview', platform: 'browser', arch: 'x64' }),
    getPrinters: async () => [
      { name: 'Preview Printer', displayName: 'Preview Printer', isDefault: true },
    ],
    printReceipt: async () => ({ success: true }),
    printTest: async () => ({ success: true }),
    eftpos: {
      pair: async () => ({ success: true }),
      purchase: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        return {
          outcome: 'Accepted' as const,
          authId: 'PREVIEW123',
          cardPan: '**** 4242',
          cardType: 'VISA',
          receipt: 'PREVIEW EFTPOS RECEIPT',
        };
      },
      onDelayed: () => () => undefined,
    },
    setBusy: async () => true,
    quit: async () => true,
    updates: {
      getState: async () => ({ status: 'idle' as const }),
      check: async () => ({ success: true }),
      installNow: async () => ({ success: true }),
      onState: () => () => undefined,
    },
  };
}
