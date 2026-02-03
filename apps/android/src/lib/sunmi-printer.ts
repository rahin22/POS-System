/**
 * Sunmi Printer Service for Android
 * 
 * This module interfaces with Sunmi's built-in thermal printer via
 * a custom Capacitor plugin that bridges to the Sunmi Print SDK.
 * 
 * For development/testing without the Sunmi device, printing is simulated.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import receiptLogoUrl from '../assets/receipt_logo.png';
import reviewQrCodeUrl from '../assets/review_qrcode.png';

// Cache for base64 images
let receiptLogoBase64Cache: string | null = null;
let reviewQrCodeBase64Cache: string | null = null;

// Load image as base64 from URL
async function loadImageBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix (data:image/png;base64,)
        resolve(base64.split(',')[1] || base64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Failed to load image:', e);
    return null;
  }
}

// Get receipt logo as base64 (custom or default)
async function getReceiptLogoBase64(): Promise<string | null> {
  // Check for custom logo first
  const { value: customLogo } = await Preferences.get({ key: 'customLogoBase64' });
  if (customLogo) {
    return customLogo;
  }
  
  // Fall back to default
  if (receiptLogoBase64Cache) return receiptLogoBase64Cache;
  receiptLogoBase64Cache = await loadImageBase64(receiptLogoUrl);
  return receiptLogoBase64Cache;
}

// Get review QR code as base64 (custom or default)
async function getReviewQrCodeBase64(): Promise<string | null> {
  // Check for custom QR code first
  const { value: customQrCode } = await Preferences.get({ key: 'customQrCodeBase64' });
  if (customQrCode) {
    return customQrCode;
  }
  
  // Fall back to default
  if (reviewQrCodeBase64Cache) return reviewQrCodeBase64Cache;
  reviewQrCodeBase64Cache = await loadImageBase64(reviewQrCodeUrl);
  return reviewQrCodeBase64Cache;
}

// Register the Sunmi Printer plugin
export interface SunmiPrinterPlugin {
  printerInit(): Promise<void>;
  getPrinterStatus(): Promise<{ status: number; message: string }>;
  setAlignment(options: { alignment: number }): Promise<void>;
  setFontSize(options: { size: number }): Promise<void>;
  printText(options: { text: string }): Promise<void>;
  printTextWithFont(options: { text: string; typeface: string; fontSize: number }): Promise<void>;
  printTextStyled(options: { text: string; fontSize?: number; alignment?: number; bold?: boolean }): Promise<void>;
  printColumnsText(options: { texts: string[]; widths: number[]; aligns: number[] }): Promise<void>;
  printQRCode(options: { data: string; moduleSize?: number; errorLevel?: number; alignment?: number }): Promise<void>;
  printBitmap(options: { bitmap: string; width?: number; alignment?: number }): Promise<void>;
  lineWrap(options: { lines: number }): Promise<void>;
  cutPaper(): Promise<void>;
  openDrawer(): Promise<void>;
}

const SunmiPrinter = registerPlugin<SunmiPrinterPlugin>('SunmiPrinter');

// Types for print data
export interface PrintOrderData {
  orderId: string;
  orderNumber: number;
  orderType: 'dine-in' | 'takeaway' | 'delivery' | 'online';
  customerName?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    notes?: string;
    modifiers?: Array<{ name: string; price: number }>;
  }>;
  subtotal: number;
  gstAmount: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
}

export interface PrinterStatus {
  connected: boolean;
  paperStatus?: 'ok' | 'low' | 'empty';
  error?: string;
}

// Check if running on Sunmi device
function _isSunmiDevice(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  
  // Check for Sunmi-specific properties
  // This will be set by the native plugin
  return (window as any).SunmiPrinter !== undefined;
}

// Format currency
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Print a customer receipt
 */
export async function printReceipt(orderData: PrintOrderData): Promise<{ success: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Print simulated (web mode):', orderData);
    return { success: true };
  }

  try {
    // Initialize printer
    await SunmiPrinter.printerInit();

    // Print logo (centered)
    try {
      const logoBase64 = await getReceiptLogoBase64();
      if (logoBase64) {
        await SunmiPrinter.printBitmap({ bitmap: logoBase64, width: 384, alignment: 1 }); // CENTER
        await SunmiPrinter.printText({ text: '\n' });
      }
    } catch (logoError) {
      console.warn('Logo print failed:', logoError);
    }

    // Business header (centered using printTextStyled)
    await SunmiPrinter.printTextStyled({ text: 'Shop 7a/22 Mawson Pl, Mawson ACT 2607\n', fontSize: 24, alignment: 1 });
    await SunmiPrinter.printTextStyled({ text: 'ALTAHER LIMITED | ABN: 79 689 402 051\n', fontSize: 24, alignment: 1 });
    await SunmiPrinter.printTextStyled({ text: '================================\n', fontSize: 24, alignment: 1 });

    // Order type (centered)
    await SunmiPrinter.printTextStyled({ text: orderData.orderType.toUpperCase() + '\n', fontSize: 32, alignment: 1 });
    
    // Order number (large, centered)
    await SunmiPrinter.printTextStyled({ text: `#${orderData.orderNumber}\n`, fontSize: 48, alignment: 1 });
    
    await SunmiPrinter.setFontSize({ size: 24 });
    await SunmiPrinter.setAlignment({ alignment: 0 }); // Left
    
    // Date
    await SunmiPrinter.printText({ text: `Date: ${formatDate(orderData.createdAt)}\n` });
    
    // Customer name if not guest
    if (orderData.customerName && orderData.customerName !== 'Guest') {
      await SunmiPrinter.printText({ text: `Customer: ${orderData.customerName}\n` });
    }
    
    await SunmiPrinter.printText({ text: '--------------------------------\n' });

    // Items
    for (const item of orderData.items) {
      const itemLine = `${item.quantity}x ${item.name}`;
      const priceLine = formatCurrency(item.price * item.quantity);
      await SunmiPrinter.printColumnsText({
        texts: [itemLine, priceLine],
        widths: [28, 10],
        aligns: [0, 2]
      });
      
      // Modifiers
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          await SunmiPrinter.printText({ text: `  + ${mod.name}\n` });
        }
      }
      
      // Notes
      if (item.notes) {
        await SunmiPrinter.printText({ text: `  Note: ${item.notes}\n` });
      }
    }

    await SunmiPrinter.printText({ text: '--------------------------------\n' });

    // Totals
    await SunmiPrinter.printColumnsText({ texts: ['Subtotal:', formatCurrency(orderData.subtotal)], widths: [28, 10], aligns: [0, 2] });
    await SunmiPrinter.printColumnsText({ texts: ['GST:', formatCurrency(orderData.gstAmount)], widths: [28, 10], aligns: [0, 2] });
    
    await SunmiPrinter.setFontSize({ size: 32 });
    await SunmiPrinter.printColumnsText({ texts: ['TOTAL:', formatCurrency(orderData.total)], widths: [20, 10], aligns: [0, 2] });
    await SunmiPrinter.setFontSize({ size: 24 });

    await SunmiPrinter.printText({ text: '--------------------------------\n' });
    await SunmiPrinter.printText({ text: `Paid by: ${orderData.paymentMethod}\n` });

    // Footer (centered)
    await SunmiPrinter.printTextStyled({ text: '\n', fontSize: 24, alignment: 1 });
    await SunmiPrinter.printTextStyled({ text: 'Thank you for your order!\n', fontSize: 24, alignment: 1 });
    await SunmiPrinter.printTextStyled({ text: 'See you again soon\n', fontSize: 24, alignment: 1 });
    await SunmiPrinter.printTextStyled({ text: '\n', fontSize: 24, alignment: 1 });
    await SunmiPrinter.printTextStyled({ text: 'If you enjoyed your meal,\n', fontSize: 24, alignment: 1 });
    await SunmiPrinter.printTextStyled({ text: "we'd love a review!\n", fontSize: 24, alignment: 1 });
    await SunmiPrinter.printTextStyled({ text: '\n', fontSize: 24, alignment: 1 });

    // Print review QR code image (centered)
    try {
      const qrCodeBase64 = await getReviewQrCodeBase64();
      if (qrCodeBase64) {
        await SunmiPrinter.printBitmap({ bitmap: qrCodeBase64, width: 300, alignment: 1 }); // CENTER
      }
    } catch (qrError) {
      console.warn('QR code print failed:', qrError);
    }

    // Feed and cut
    await SunmiPrinter.lineWrap({ lines: 4 });
    await SunmiPrinter.cutPaper();

    return { success: true };
  } catch (error) {
    console.error('Print error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Print a kitchen docket
 */
export async function printKitchenDocket(orderData: PrintOrderData): Promise<{ success: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Kitchen docket simulated (web mode):', orderData);
    return { success: true };
  }

  try {
    await SunmiPrinter.printerInit();

    // Order number (very large)
    await SunmiPrinter.setAlignment({ alignment: 1 });
    await SunmiPrinter.setFontSize({ size: 64 });
    await SunmiPrinter.printTextWithFont({ text: `#${orderData.orderNumber}\n`, typeface: '', fontSize: 64 });
    
    // Order type
    await SunmiPrinter.setFontSize({ size: 32 });
    await SunmiPrinter.printTextWithFont({ text: orderData.orderType.toUpperCase() + '\n', typeface: '', fontSize: 32 });
    
    await SunmiPrinter.setFontSize({ size: 24 });
    await SunmiPrinter.printText({ text: '================================\n' });
    await SunmiPrinter.setAlignment({ alignment: 0 });

    // Items (large for kitchen visibility)
    await SunmiPrinter.setFontSize({ size: 28 });
    for (const item of orderData.items) {
      await SunmiPrinter.printText({ text: `${item.quantity}x ${item.name}\n` });
      
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          await SunmiPrinter.printText({ text: `  + ${mod.name}\n` });
        }
      }
      
      if (item.notes) {
        await SunmiPrinter.setFontSize({ size: 24 });
        await SunmiPrinter.printText({ text: `  ** ${item.notes} **\n` });
        await SunmiPrinter.setFontSize({ size: 28 });
      }
    }

    await SunmiPrinter.setFontSize({ size: 24 });
    await SunmiPrinter.printText({ text: '================================\n' });
    await SunmiPrinter.printText({ text: `Time: ${formatDate(orderData.createdAt)}\n` });

    // Feed and cut
    await SunmiPrinter.lineWrap({ lines: 4 });
    await SunmiPrinter.cutPaper();

    return { success: true };
  } catch (error) {
    console.error('Kitchen docket print error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get printer status
 */
export async function getPrinterStatus(): Promise<PrinterStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { connected: false, error: 'Web mode - no printer' };
  }

  try {
    const result = await SunmiPrinter.getPrinterStatus();
    
    return {
      connected: result.status === 1, // 1 = normal
      paperStatus: result.status === 1 ? 'ok' : result.status === 4 ? 'empty' : 'ok',
    };
  } catch (error) {
    return { connected: false, error: String(error) };
  }
}

/**
 * Open cash drawer (if connected)
 */
export async function openCashDrawer(): Promise<{ success: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Cash drawer open simulated (web mode)');
    return { success: true };
  }

  try {
    await SunmiPrinter.openDrawer();
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
