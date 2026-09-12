/**
 * Silent printing to the kiosk's integrated thermal receipt printer.
 *
 * The printer is exposed to Windows as an ordinary printer with its own driver,
 * so we render the receipt as HTML in an offscreen window and hand it to the
 * driver with `silent: true`. That keeps the Windows paper/cut settings intact
 * and avoids needing raw ESC/POS access.
 */

import { BrowserWindow, webContents } from 'electron';
import { buildReceiptHtml, ReceiptData } from './receipt';

export interface PrintResult {
  success: boolean;
  error?: string;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

/** Windows printers visible to Chromium. Requires at least one open window. */
export async function listPrinters(): Promise<PrinterInfo[]> {
  const target = BrowserWindow.getAllWindows()[0];
  if (!target) return [];

  try {
    const printers = await target.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
    }));
  } catch (err: any) {
    console.error('Failed to list printers:', err.message);
    return [];
  }
}

async function printHtml(html: string, deviceName: string, copies: number): Promise<PrintResult> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Receipt markup is generated locally; no remote content is ever loaded here
      sandbox: true,
    },
  });

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    // Give layout/fonts a moment to settle before handing the page to the driver
    await new Promise((resolve) => setTimeout(resolve, 250));

    const result = await new Promise<PrintResult>((resolve) => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: deviceName || undefined,
          copies: Math.max(1, copies),
          margins: { marginType: 'none' },
        },
        (success, failureReason) => {
          resolve(success ? { success: true } : { success: false, error: failureReason });
        }
      );
    });

    return result;
  } catch (err: any) {
    return { success: false, error: err.message };
  } finally {
    // Destroying immediately can cut the spool job short on some drivers
    setTimeout(() => {
      if (!printWindow.isDestroyed()) printWindow.destroy();
    }, 2000);
  }
}

export async function printCustomerReceipt(
  data: ReceiptData,
  options: { deviceName: string; copies?: number }
): Promise<PrintResult> {
  const html = buildReceiptHtml(data);
  return printHtml(html, options.deviceName, options.copies ?? 1);
}

/** Small self-test page used by the admin panel */
export async function printTestPage(options: { deviceName: string }): Promise<PrintResult> {
  const html = buildReceiptHtml({
    orderNumber: 88,
    orderType: 'takeaway',
    createdAt: new Date().toISOString(),
    items: [
      { name: 'Test Item', quantity: 1, totalPrice: 12.5, modifiers: [{ name: 'Extra sauce', price: 0.5 }] },
    ],
    subtotal: 13,
    tax: 1.18,
    total: 13,
    currencySymbol: '$',
    vatRate: 10,
    shopName: 'Al Taher Kebabs',
    receiptFooter: 'Printer test page',
  });

  return printHtml(html, options.deviceName, 1);
}

/** Frees any offscreen print contexts left behind (defensive; called on quit) */
export function destroyPrintContexts(): void {
  webContents.getAllWebContents().forEach((wc) => {
    const url = wc.getURL();
    if (url.startsWith('data:text/html')) {
      const win = BrowserWindow.fromWebContents(wc);
      if (win && !win.isDestroyed()) win.destroy();
    }
  });
}
