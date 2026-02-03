import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kebabpos.terminal',
  appName: 'KebabPOS',
  webDir: 'dist',
  server: {
    // For development, use live reload
    url: 'http://192.168.0.14:5173',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a1a',
    },
  },
  android: {
    // Allow mixed content for local assets
    allowMixedContent: true,
    // Fullscreen mode for POS
    // backgroundColor: '#1a1a1a',
  },
};

export default config;
