/**
 * Platform abstraction layer
 * 
 * This module provides a unified API for platform-specific features
 * (printing, storage, etc.) that works across Electron and Capacitor.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { printReceipt as sunmiPrint, printKitchenDocket as sunmiKitchenPrint, getPrinterStatus } from './sunmi-printer';
import type { PrintOrderData } from './sunmi-printer';

// Detect platform
export const platform = {
  isAndroid: () => Capacitor.getPlatform() === 'android',
  isIOS: () => Capacitor.getPlatform() === 'ios',
  isWeb: () => Capacitor.getPlatform() === 'web',
  isNative: () => Capacitor.isNativePlatform(),
};

// Settings storage using Capacitor Preferences
export const settings = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const { value } = await Preferences.get({ key });
      if (value === null) return defaultValue;
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  },

  async set(key: string, value: any): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(value) });
  },

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  },

  async clear(): Promise<void> {
    await Preferences.clear();
  },
};

// Printer abstraction
export const printer = {
  async printReceipt(orderData: PrintOrderData): Promise<{ success: boolean; error?: string }> {
    return sunmiPrint(orderData);
  },

  async printKitchenDocket(orderData: PrintOrderData): Promise<{ success: boolean; error?: string }> {
    return sunmiKitchenPrint(orderData);
  },

  async getStatus(): Promise<{ connected: boolean; error?: string }> {
    return getPrinterStatus();
  },

  async getPrinters(): Promise<{ success: boolean; printers: string[] }> {
    // On Sunmi, there's only the built-in printer
    if (platform.isNative()) {
      const status = await getPrinterStatus();
      return {
        success: true,
        printers: status.connected ? ['Sunmi Built-in Printer'] : [],
      };
    }
    return { success: true, printers: [] };
  },
};

// App info
export const appInfo = {
  async get(): Promise<{ version: string; platform: string; arch: string }> {
    return {
      version: '1.0.4',
      platform: Capacitor.getPlatform(),
      arch: 'arm64',
    };
  },
};

// Create a window.electronAPI-like interface for compatibility
export function createCompatibilityLayer() {
  // Only create if not running in Electron
  if ((window as any).electronAPI) return;

  (window as any).electronAPI = {
    getSettings: async () => {
      return {
        apiUrl: await settings.get('apiUrl', 'https://kebab-posbackend-production.up.railway.app'),
        kioskMode: await settings.get('kioskMode', false),
        printerEnabled: await settings.get('printerEnabled', true),
        printerName: 'Sunmi Built-in',
        vfdEnabled: false,
        vfdPort: '',
        vfdBaudRate: 9600,
        customLogoPath: '',
        customQrCodePath: '',
      };
    },

    setSettings: async (newSettings: Record<string, any>) => {
      for (const [key, value] of Object.entries(newSettings)) {
        await settings.set(key, value);
      }
      return true;
    },

    toggleFullscreen: async () => {
      // Android handles fullscreen via Capacitor config
      return true;
    },

    getAppInfo: async () => appInfo.get(),

    printReceipt: async (orderData: any) => printer.printReceipt(orderData),

    getPrinters: async () => printer.getPrinters(),

    getPrintQueue: async () => ({ success: true, jobs: [] }),

    // VFD not supported on Sunmi T2s
    vfd: {
      connect: async () => ({ success: false, error: 'VFD not supported on this device' }),
      disconnect: async () => ({ success: true }),
      status: async () => ({ connected: false }),
      listPorts: async () => [],
      welcome: async () => ({ success: false }),
      itemAdded: async () => ({ success: false }),
      total: async () => ({ success: false }),
      clear: async () => ({ success: false }),
    },

    // Updates handled differently on Android
    updates: {
      checkForUpdates: async () => ({ updateAvailable: false }),
      downloadUpdate: async () => ({ success: false }),
      installUpdate: async () => {},
    },
  };
}
