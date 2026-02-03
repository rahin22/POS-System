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

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
