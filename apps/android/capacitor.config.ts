import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.kebabpos.terminal',
  appName: 'KebabPOS',
  webDir: 'dist',
  // Only use dev server in development mode
  ...(isDev ? {
    server: {
      url: 'http://192.168.0.14:5173',
      cleartext: true
    }
  } : {}),
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
