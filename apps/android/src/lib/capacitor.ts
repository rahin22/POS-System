import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function initializeCapacitor() {
  if (!Capacitor.isNativePlatform()) {
    console.log('Running in web mode - Capacitor plugins not available');
    return;
  }

  // Hide splash screen after app loads
  SplashScreen.hide();

  // Configure status bar
  StatusBar.setStyle({ style: Style.Dark });
  StatusBar.setBackgroundColor({ color: '#c2410c' }); // primary-700

  // Handle back button on Android
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) {
      // Don't exit the app, just ignore
      // Or show a confirmation dialog
    } else {
      window.history.back();
    }
  });

  console.log('Capacitor initialized');
}

/**
 * Tell the updater this bundle actually works.
 *
 * If a freshly downloaded bundle never calls this, the plugin assumes it is broken
 * and reverts to the one before it on the next launch. That rollback is the whole
 * safety net for shipping code to a till nobody is sitting at, so this must be
 * called once the app has genuinely rendered - not merely started loading.
 *
 * Imported dynamically so the web and Electron builds, which have no updater
 * plugin, are unaffected.
 */
export async function notifyAppReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
    console.log('Updater notified that this bundle is healthy');
  } catch (error) {
    // Swallowed on purpose: on a build without the plugin this is simply absent,
    // and throwing here would take down an app that is otherwise fine
    console.warn('Could not notify the updater:', error);
  }
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
